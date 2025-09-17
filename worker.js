// --- İZLEME VE HATA BİLDİRİMİ BAŞLATMA ---
// BU KOD BLOGU, TÜM DİĞER IMPORT'LARDAN ÖNCE ÇAĞRILMALIDIR!
import { initializeTracing } from './tracing.js';
await initializeTracing('videokit-worker');
// --- İZLEME KODU SONU ---

import { Worker, Queue } from 'bullmq';
import fs from 'fs/promises';
import Redis from 'ioredis';
import c2pa from 'c2pa';
const { read } = c2pa;
import crypto from 'crypto';
import pino from 'pino';
import * as Sentry from '@sentry/node'; // Sentry'i import et

import config, { initialize as initializeConfig } from './config.js';

// --- Yapılandırılmış Loglama Kurulumu ---
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// --- Uygulama Başlangıcı ve Sır Yönetimi ---
await initializeConfig();

// --- Redis ve Kuyruk Bağlantıları ---
const redisConnection = new Redis(config.secrets.redisUrl, {
  maxRetriesPerRequest: null,
});
redisConnection.on('error', (err) => logger.error({ err }, 'Worker Redis bağlantı hatası'));

const redisPublisher = new Redis(config.secrets.redisUrl);
const JOB_UPDATES_CHANNEL = 'job-updates';

// Webhook gönderme işlerini yönetecek yeni bir kuyruk oluştur
const webhookQueue = new Queue('webhook-queue', { connection: redisConnection });

/**
 * c2pa-node'dan gelen sonucu basitleştirilmiş bir rapor formatına dönüştürür.
 */
function createJsonReport(result, fileName) {
    if (!result || !result.manifestStore) {
        return {
            verdict: 'red',
            message: 'Manifest bulunamadı veya dosya okunamadı.',
            file: { name: fileName },
        };
    }
    const manifest = result.manifestStore.activeManifest;
    const validationStatus = manifest?.validationStatus || [];
    const codes = validationStatus.map(s => s.code);

    // İptal durumunu öncelikli olarak kontrol et
    const isRevoked = codes.some(c => c.includes('revoked'));
    if (isRevoked) {
        return {
            verdict: 'red',
            message: 'Sertifika iptal edilmiş (CRL/OCSP kontrolü).',
            file: { name: fileName },
            summary: {
                issuer: manifest?.signatureInfo?.issuer,
                time: manifest?.signatureInfo?.time,
                claimGenerator: manifest?.claimGenerator,
            },
            validationCodes: codes,
        };
    }

    const hasError = codes.some(c => c.includes('error') || c.includes('invalid') || c.includes('mismatch'));
    const hasUntrusted = codes.some(c => c.includes('untrusted'));

    let verdict = 'yellow';
    let message = 'Doğrulama tamamlandı, ancak tam bir imza zinciri bulunamadı.';

    if (hasError) {
        verdict = 'red';
        message = 'Doğrulama sırasında kritik hatalar bulundu.';
    } else if (hasUntrusted) {
        verdict = 'yellow';
        message = 'İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.';
    } else if (codes.some(c => c.includes('signature.validated'))) {
        verdict = 'green';
        message = 'İmza ve sertifika zinciri başarıyla doğrulandı.';
    }

    return {
        verdict, message,
        file: { name: fileName },
        summary: {
            issuer: manifest?.signatureInfo?.issuer,
            time: manifest?.signatureInfo?.time,
            claimGenerator: manifest?.claimGenerator,
        },
        validationCodes: codes,
    };
}

// --- Worker Tanımları ---

// 1. C2PA Doğrulama İşçisi
const loadJobFileBuffer = async (jobData) => {
    if (jobData.filePath) {
        return fs.readFile(jobData.filePath);
    }
    if (jobData.fileBuffer) {
        return Buffer.from(jobData.fileBuffer);
    }
    throw new Error('Job payload missing file data.');
};

const cleanupJobFile = async (filePath, jobLogger) => {
    if (!filePath) return;
    try {
        await fs.unlink(filePath);
        jobLogger.debug({ filePath }, '[VerifyWorker] Geçici dosya silindi.');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            jobLogger.warn({ err: error, filePath }, '[VerifyWorker] Geçici dosya silinemedi.');
        }
    }
};

const verifyWorker = new Worker('verify-queue', async (job) => {
    const { fileBuffer, filePath, originalname, webhookUrl, webhookSecret, batchId, fileId, correlationId } = job.data;
    
    // Her iş için context içeren bir alt logger oluştur
    const jobLogger = logger.child({
        jobId: job.id,
        file: originalname,
        correlationId: correlationId,
        batchId: batchId,
    });
    
    jobLogger.info(`[VerifyWorker] İş alınıyor`);

    try {
        const buffer = await loadJobFileBuffer({ fileBuffer, filePath });
        const result = await read(buffer, { online: true });
        const report = createJsonReport(result, originalname);

        jobLogger.info({ verdict: report.verdict }, `[VerifyWorker] İş tamamlandı`);
        
        if (webhookUrl && webhookSecret) {
            jobLogger.info({ webhookUrl }, `[VerifyWorker] Webhook işi tetikleniyor`);
            await webhookQueue.add('send-webhook', {
                report,
                url: webhookUrl,
                secret: webhookSecret,
                parentJobId: job.id,
                correlationId: correlationId,
            });
        }
        
        if (batchId) {
            const update = { batchId, jobId: job.id, fileId, status: 'completed', result: report };
            await redisPublisher.publish(JOB_UPDATES_CHANNEL, JSON.stringify(update));
        }

        return report; 
    } catch (error) {
        jobLogger.error({ err: error }, `[VerifyWorker] İş başarısız`);
        
        // Hatayı Sentry'e manuel olarak bildir
        Sentry.captureException(error, { extra: { jobId: job.id, file: originalname } });

        if (batchId) {
            const update = { batchId, jobId: job.id, fileId, status: 'failed', error: error.message };
            await redisPublisher.publish(JOB_UPDATES_CHANNEL, JSON.stringify(update));
        }
        
        throw error;
    } finally {
        await cleanupJobFile(filePath, jobLogger);
    }
}, { connection: redisConnection });

// 2. Webhook Gönderme İşçisi
const webhookWorker = new Worker('webhook-queue', async (job) => {
    const { report, url, secret, parentJobId, correlationId } = job.data;
    
    const jobLogger = logger.child({
        jobId: job.id,
        parentJobId: parentJobId,
        correlationId: correlationId,
        webhookUrl: url,
    });
    
    jobLogger.info(`[WebhookWorker] Gönderim işi alınıyor`);

    const payload = JSON.stringify(report);
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Videokit-Signature': `sha256=${signature}`,
                'X-Correlation-Id': correlationId, // Correlation ID'yi giden isteğe ekle
            },
            body: payload
        });

        if (!response.ok) {
            throw new Error(`Webhook hedefi ${response.status} koduyla yanıt verdi.`);
        }
        
        jobLogger.info({ status: response.status }, `[WebhookWorker] Başarıyla gönderildi`);
        return { status: response.status, statusText: response.statusText };

    } catch (error) {
        jobLogger.error({ err: error }, `[WebhookWorker] Gönderim başarısız`);
        
        // Hatayı Sentry'e manuel olarak bildir
        Sentry.captureException(error, { extra: { jobId: job.id, parentJobId: parentJobId, url: url } });

        throw error;
    }
}, { 
    connection: redisConnection,
    attempts: 5,
    backoff: {
        type: 'exponential',
        delay: 1000,
    }
});


logger.info('✅ VideoKit Worker başlatıldı ve işleri bekliyor...');

verifyWorker.on('completed', job => {
  logger.info({ jobId: job.id }, `[VerifyWorker] İş başarıyla tamamlandı.`);
});

verifyWorker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err: err }, `[VerifyWorker] İş başarısız oldu.`);
});

webhookWorker.on('completed', job => {
  logger.info({ jobId: job.id, parentJobId: job.data.parentJobId }, `[WebhookWorker] İş başarıyla tamamlandı.`);
});

webhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, parentJobId: job.data.parentJobId, err: err }, `[WebhookWorker] İş son denemeden sonra başarısız oldu.`);
});