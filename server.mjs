// FILE: server.mjs

// === TÜM STATİK IMPORT'LAR BURAYA TAŞINDI ===
import "./instrument.mjs";
import * as Sentry from "@sentry/node";
import cron from 'node-cron'; 
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import crypto from 'crypto';
import http from 'http';
import { WebSocketServer } from 'ws';
import JSZip from 'jszip';
import path from 'path';
import { fileURLToPath } from 'url';
import promClient from 'prom-client';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import pg from 'pg';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import config, { initialize as initializeConfig } from './config.js';
import { createBillingMiddleware } from './middleware/billing.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { getSigner, PolicyViolationError } from './videokit-signer.js';
import *as audit from './videokit-audit.js';
import { initI18n, getLang, t } from './i18n.js';
import createAuthRouter from './routes/auth.js';
import { create } from "./shims/contentauth.mjs"; // c2pa create fonksiyonu için gerekli import
// === IMPORT BLOK SONU ===

// --- İZLEME VE HATA BİLDİRİMİ BAŞLATMA ---
// BU KOD BLOGU, TÜM STATİK IMPORT'LARDAN SONRA ÇAĞRILMALIDIR!
if (process.env.TRACING_ENABLED === '1') {
    // Bu dinamik bir import olduğu için burada kalabilir.
    import('./tracing.js').catch(e =>
        console.warn('[tracing] disabled:', e?.message || e)
    );
}
// --- İZLEME KODU SONU ---

const C2PA_ENABLED = process.env.C2PA_ENABLED !== 'false';
// C2PA kullanan endpoint'leri sadece C2PA_ENABLED true ise register et
if (!C2PA_ENABLED) {
    console.warn('C2PA devre dışı (C2PA_ENABLED=false).');
}

// --- Yapılandırılmış Loglama Kurulumu ---
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const httpLogger = pinoHttp({
    logger,
    genReqId: function (req, res) {
        const existingId = req.id ?? req.headers["x-request-id"] ?? req.headers["x-correlation-id"];
        if (existingId) return existingId;
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
    },
});

// --- Dosya Yolları için Ayarlar ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMP_UPLOAD_DIR = path.join(UPLOADS_DIR, 'tmp');
const DEFAULT_MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25MB
const configuredMaxUploadSize = Number.parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? '', 10);
const MAX_UPLOAD_SIZE_BYTES = Number.isFinite(configuredMaxUploadSize) && configuredMaxUploadSize > 0
    ? configuredMaxUploadSize
    : DEFAULT_MAX_UPLOAD_SIZE;

// --- Uygulama Başlangıcı ve Sır Yönetimi ---
await initializeConfig();
await initI18n(); // i18n sistemini başlat

// --- Veritabanı Bağlantısı (PostgreSQL) ---
const dbPool = new pg.Pool({
    connectionString: config.database.connectionString,
});

// Veritabanı bağlantısını test et
try {
    const client = await dbPool.connect();
    logger.info('✅ PostgreSQL veritabanına başarıyla bağlanıldı.');
    client.release();
} catch (err) {
    logger.error({ err }, 'PostgreSQL veritabanına bağlanılamadı. Lütfen yapılandırmayı kontrol edin.');
    process.exit(1); // Bağlantı başarısız olursa uygulamayı sonlandır
}

// --- Kuyruk ve Redis Bağlantısı ---
const redisConnection = new Redis(config.secrets.redisUrl, {
    maxRetriesPerRequest: null,
});
redisConnection.on('error', (err) => logger.error({ err }, 'Redis bağlantı hatası'));
const redisSubscriber = new Redis(config.secrets.redisUrl);

const verifyQueue = new Queue('verify-queue', { connection: redisConnection });

// --- Express Uygulaması ---
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;


// === Loglama ve Metrik Middleware'leri ===
app.use(httpLogger);

const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'videokit_api_' });

const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'videokit_api_http_request_duration_ms',
    help: 'API isteklerinin milisaniye cinsinden süresi',
    labelNames: ['method', 'route', 'code'],
    buckets: [50, 100, 200, 300, 500, 1000, 2500]
});

const httpRequestsTotal = new promClient.Counter({
    name: 'videokit_api_http_requests_total',
    help: 'Alınan toplam HTTP istek sayısı',
    labelNames: ['method', 'route', 'code']
});

app.use((req, res, next) => {
    req.lang = getLang(req);

    const pathsToSkip = ['/metrics', '/healthz', '/readyz', '/uploads'];
    if (pathsToSkip.some(path => req.path.startsWith(path))) {
        return next();
    }

    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
        const route = req.route ? req.route.path : 'unknown_route';
        end({ route, code: res.statusCode, method: req.method });
        httpRequestsTotal.inc({ route, code: res.statusCode, method: req.method });
    });
    next();
});

// === SAĞLIK KONTROLÜ ENDPOINT'LERİ ===
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/readyz', async (req, res) => {
    try {
        const redisStatus = redisConnection.status;
        const dbClient = await dbPool.connect();
        dbClient.release();

        if (redisStatus === 'ready') {
            res.status(200).json({ status: 'ready', checks: { redis: 'ok', postgres: 'ok' } });
        } else {
            req.log.warn({ redisStatus }, '/readyz kontrolü başarısız: Redis hazır değil.');
            res.status(503).json({ status: 'unavailable', checks: { redis: `failed (status: ${redisStatus})`, postgres: 'ok' } });
        }
    } catch (error) {
        req.log.error({ err: error }, '/readyz kontrolü sırasında istisna oluştu.');
        const redisStatus = redisConnection.status;
        res.status(503).json({
            status: 'unavailable',
            checks: {
                redis: redisStatus === 'ready' ? 'ok' : `failed (status: ${redisStatus})`,
                postgres: 'failed'
            }
        });
    }
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

// === Diğer Middleware'ler ===
app.use(express.json());
app.use(cookieParser());

// YENİ: CORS ayarları
// Sadece geliştirme ortamında cross-origin isteklerine izin veriyoruz.
// Production ortamında origin kısıtlaması daha sıkı olmalıdır.
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const defaultDevOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];
const allowedOrigins = new Set([
    ...(isProduction ? [] : defaultDevOrigins),
    ...configuredOrigins,
]);
const allowAllOrigins = allowedOrigins.has('*');
if (allowAllOrigins) {
    allowedOrigins.delete('*');
}

app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            // Same-origin requests (or tools like curl) have no origin header.
            return callback(null, true);
        }
        if (allowAllOrigins || allowedOrigins.has(origin)) {
            return callback(null, true);
        }
        if (!isProduction && origin === 'null') {
            // Allow file:// origins in non-production environments for easier local testing.
            return callback(null, true);
        }
        logger.warn({ origin }, '[CORS] Engellenen origin');
        return callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Idempotency-Key'],
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Multer Ayarları ---
const fileUploadStorage = multer.diskStorage({
    destination(req, file, cb) {
        fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true })
            .then(() => cb(null, TEMP_UPLOAD_DIR))
            .catch((error) => cb(error));
    },
    filename(req, file, cb) {
        const extension = path.extname(file.originalname);
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        cb(null, `${uniqueSuffix}${extension}`);
    },
});

const fileUpload = multer({
    storage: fileUploadStorage,
    limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

const logoStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = UPLOADS_DIR;
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const tenantId = req.params.tenantId;
        const extension = path.extname(file.originalname);
        const uniqueSuffix = Date.now();
        cb(null, `${tenantId}-logo-${uniqueSuffix}${extension}`);
    }
});
const logoUpload = multer({
    storage: logoStorage,
    limits: { fileSize: 1 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|svg\+xml|svg/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('İzin verilmeyen dosya türü. Sadece JPEG, PNG, SVG geçerlidir.'));
    }
});

// === WebSocket Sunucusu Kurulumu ===
const wss = new WebSocketServer({ server });
const batchConnections = new Map();

wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.slice(1));
    const batchId = urlParams.get('batchId');
    if (!batchId) {
        logger.warn('[WebSocket] Bağlantı reddedildi: batchId eksik.');
        ws.close();
        return;
    }
    logger.info({ batchId }, `[WebSocket] İstemci bağlandı.`);
    batchConnections.set(batchId, ws);
    ws.on('close', () => {
        logger.info({ batchId }, `[WebSocket] İstemci bağlantısı kesildi.`);
        batchConnections.delete(batchId);
    });
    ws.on('error', (error) => {
        logger.error({ batchId, err: error }, `[WebSocket] Hata.`);
    });
});

const JOB_UPDATES_CHANNEL = 'job-updates';
redisSubscriber.subscribe(JOB_UPDATES_CHANNEL, (err) => {
    if (err) {
        logger.error({ err }, 'Redis Pub/Sub kanalına abone olunamadı:');
    } else {
        logger.info(`✅ Redis kanalı dinleniyor: ${JOB_UPDATES_CHANNEL}`);
    }
});

redisSubscriber.on('message', (channel, message) => {
    if (channel === JOB_UPDATES_CHANNEL) {
        try {
            const update = JSON.parse(message);
            const { batchId, jobId, status, result, error } = update;
            const ws = batchConnections.get(batchId);
            if (ws && ws.readyState === ws.OPEN) {
                logger.info({ batchId, jobId }, `[Pub/Sub] ${batchId} için iş güncellemesi gönderiliyor (Job: ${jobId})`);
                ws.send(JSON.stringify({ type: 'job_update', jobId, status, result, error }));
            }
        } catch (e) {
            logger.error({ err: e }, '[Pub/Sub] Gelen mesaj işlenirken hata oluştu:');
        }
    }
});

// --- Abonelik Planları Tanımı ---
const plans = {
    free: { name: 'Free Tier', rateLimitPerMinute: 10, monthlyQuota: null, apiKeyLimit: 1 },
    pro: { name: 'Pro Tier', rateLimitPerMinute: 100, monthlyQuota: 1000, apiKeyLimit: 5 },
    'pay-as-you-go': { name: 'Pay as you go', rateLimitPerMinute: 120, monthlyQuota: null, apiKeyLimit: 10 },
    trial: { name: 'Trial Version', rateLimitPerMinute: 20, monthlyQuota: 500, apiKeyLimit: 2 },
};

// --- Auth & Billing Middleware ---
const authMiddleware = createAuthMiddleware({ dbPool, config });
const { protect, authorize } = authMiddleware;
const [resolveTenant, startTimer, enforceQuota, finalizeAndLog] = createBillingMiddleware({
    dbPool,
    redis: redisConnection,
    logger,
});

const attachFinalizeOnce = (req, res) => {
    if (req.billing?.__billingFinalizeAttached) {
        return;
    }

    finalizeAndLog(req, res);

    if (!req.billing) {
        req.billing = {};
    }

    req.billing.__billingFinalizeAttached = true;
};

const resolveTenantWithFinalize = (req, res, next) => {
    attachFinalizeOnce(req, res);
    return resolveTenant(req, res, next);
};

const billingReadChain = [resolveTenantWithFinalize, startTimer];
const billingWriteChain = [...billingReadChain, enforceQuota];

const withFinalize = (handler) => async (req, res, next) => {
    attachFinalizeOnce(req, res);

    try {
        await handler(req, res, next);
    } catch (error) {
        return next(error);
    }

    return next();
};

const finalizeAfter = (req, res, next) => {
    if (req.billing?.__billingFinalizeAttached) {
        return next();
    }

    finalizeAndLog(req, res, next);

    if (req.billing) {
        req.billing.__billingFinalizeAttached = true;
    }
};

const hashApiKey = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex');

const maskApiKey = (apiKey) => {
    if (!apiKey || apiKey.length <= 8) {
        return apiKey || '';
    }
    const prefixLength = Math.min(12, Math.max(4, Math.floor(apiKey.length / 3)));
    const suffixLength = Math.min(4, apiKey.length - prefixLength);
    return `${apiKey.slice(0, prefixLength)}...${apiKey.slice(apiKey.length - suffixLength)}`;
};

const cleanupUploadedFile = async (file) => {
    if (!file?.path) return;
    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn({ err: error, path: file.path }, '[Upload] Geçici dosya silinemedi.');
        }
    }
};

const readUploadedFileBuffer = async (file) => {
    if (!file) {
        throw new Error('Uploaded file metadata missing.');
    }
    if (file.buffer) {
        return file.buffer;
    }
    if (file.path) {
        return fs.readFile(file.path);
    }
    throw new Error('Uploaded file is not accessible.');
};

const getMp4CreationTime = async (file) => {
    if (!file) return null;
    let searchBuffer;
    if (file.buffer) {
        searchBuffer = file.buffer.slice(0, 65536);
    } else if (file.path) {
        try {
            const handle = await fs.open(file.path, 'r');
            const sliceBuffer = Buffer.alloc(65536);
            const { bytesRead } = await handle.read(sliceBuffer, 0, sliceBuffer.length, 0);
            await handle.close();
            searchBuffer = sliceBuffer.subarray(0, bytesRead);
        } catch (error) {
            logger.warn({ err: error, path: file.path }, '[Upload] Dosya başlangıcı okunamadı.');
            return null;
        }
    } else {
        return null;
    }

    const size = searchBuffer.length;
    const EPOCH_OFFSET = 2082844800;
    for (let i = 0; i < size - 8; i++) {
        const boxSize = searchBuffer.readUInt32BE(i);
        const boxType = searchBuffer.toString('ascii', i + 4, i + 8);
        if (boxType === 'moov' && boxSize > 8) {
            for (let j = i + 8; j < i + boxSize - 8; j++) {
                const innerSize = searchBuffer.readUInt32BE(j);
                const innerType = searchBuffer.toString('ascii', j + 4, j + 8);
                if (innerType === 'mvhd' && innerSize > 20) {
                    const version = searchBuffer.readUInt8(j + 8);
                    let timeOffset = j + 8 + 4;
                    let creationTime;
                    if (version === 1) {
                        creationTime = searchBuffer.readBigUInt64BE(timeOffset);
                    } else {
                        creationTime = searchBuffer.readUInt32BE(timeOffset);
                    }
                    if (creationTime > EPOCH_OFFSET) {
                        const jsTimestamp = (Number(creationTime) - EPOCH_OFFSET) * 1000;
                        return new Date(jsTimestamp);
                    }
                }
                if (innerSize === 0 || j + innerSize > i + boxSize) break;
                j += innerSize - 1;
            }
        }
        if (boxSize === 0 || i + boxSize > size) break;
        i += boxSize - 1;
    }
    return null;
};
const idempotencyHandler = async (req, res, next) => {
    if (req.method !== 'POST') {
        return next();
    }
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
        return next();
    }
    const redisKey = `idempotency:${idempotencyKey}`;
    try {
        const cachedResponse = await redisConnection.get(redisKey);
        if (cachedResponse) {
            req.log.info({ idempotencyKey }, `[Idempotency] Önbellekten yanıt veriliyor.`);
            const { status, headers, body, _isBuffer } = JSON.parse(cachedResponse);
            const responseBody = _isBuffer ? Buffer.from(body, 'base64') : body;
            res.status(status).set(headers).send(responseBody);
            return;
        }
        const lock = await redisConnection.set(redisKey, JSON.stringify({ status: 'in_progress' }), 'EX', 300, 'NX');
        if (!lock) {
            req.log.warn({ idempotencyKey }, `[Idempotency] Çakışma tespit edildi.`);
            return res.status(409).json({ error: t('error_idempotency_conflict', req.lang) });
        }
        const originalSend = res.send.bind(res);
        res.send = (body) => {
            const isBuffer = Buffer.isBuffer(body);
            const bodyToCache = isBuffer ? body.toString('base64') : body;
            const cachePayload = {
                status: res.statusCode,
                headers: res.getHeaders(),
                body: bodyToCache,
                _isBuffer: isBuffer
            };
            if (res.statusCode >= 200 && res.statusCode < 400) {
                redisConnection.set(redisKey, JSON.stringify(cachePayload), 'EX', 86400);
                req.log.info({ idempotencyKey }, `[Idempotency] Sonuç önbelleğe alındı.`);
            } else {
                redisConnection.del(redisKey);
            }
            return originalSend(body);
        };
        next();
    } catch (error) {
        req.log.error({ err: error, idempotencyKey }, '[Idempotency] Redis hatası:');
        next(error);
    }
};
// === API ENDPOINTS ===

const authRouter = createAuthRouter({
    dbPool,
    redis: redisConnection,
    config,
    auth: authMiddleware,
});

app.use('/auth', authRouter);

app.post('/verify', protect, ...billingWriteChain, fileUpload.single('file'), withFinalize(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: t('error_file_not_uploaded', req.lang) });
    }
    const { webhookUrl, webhookSecret } = req.body;
    req.log.info({ file: req.file.originalname, size: req.file.size, webhook: !!webhookUrl }, `[/verify] İstek alındı`);

    let jobQueued = false;
    try {
        const job = await verifyQueue.add('verify-c2pa', {
            filePath: req.file.path,
            originalname: req.file.originalname,
            webhookUrl: webhookUrl,
            webhookSecret: webhookSecret,
            tenantId: req.tenant.id,
            correlationId: req.id
        });
        jobQueued = true;
        req.log.info({ jobId: job.id }, `[/verify] İş kuyruğa eklendi.`);
        res.status(202).json({ jobId: job.id });
    } catch (error) {
        req.log.error({ err: error }, '[/verify] İş kuyruğa eklenirken hata oluştu');
        res.status(500).json({ error: t('error_job_creation_failed', req.lang) });
    } finally {
        if (!jobQueued) {
            await cleanupUploadedFile(req.file);
        }
    }
}), finalizeAfter);

app.get('/jobs/:jobId', protect, ...billingReadChain, withFinalize(async (req, res) => {
    const { jobId } = req.params;
    const job = await verifyQueue.getJob(jobId);

    if (!job) {
        return res.status(404).json({ error: t('error_job_not_found', req.lang) });
    }

    if (job.data.tenantId !== req.tenant.id) {
        req.log.warn({ tenantId: req.tenant.id, jobOwner: job.data.tenantId, jobId }, `[AUTH] Yetkisiz iş erişimi denemesi.`);
        return res.status(403).json({ error: t('error_forbidden_job_access', req.lang) });
    }

    const state = await job.getState();
    const response = { jobId: job.id, state: state };
    if (state === 'completed') {
        response.result = job.returnvalue;
    } else if (state === 'failed') {
        response.error = job.failedReason;
    }
    res.status(200).json(response);
}), finalizeAfter);

app.post('/stamp', protect, ...billingWriteChain, idempotencyHandler, fileUpload.single('file'), withFinalize(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: t('error_file_not_uploaded', req.lang) });
    }
    const { author, action = 'c2pa.created', agent = 'VideoKit API v1.0', captureOnly } = req.body;
    if (!author) {
        return res.status(400).json({ error: t('error_author_missing', req.lang) });
    }
    const isCaptureOnly = captureOnly === 'true' || captureOnly === true;
    if (isCaptureOnly) {
        const creationTime = await getMp4CreationTime(req.file);
        if (creationTime) {
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            if (creationTime.getTime() < twentyFourHoursAgo) {
                const errorMessage = t('error_policy_violation', req.lang, { creationTime: creationTime.toISOString() });
                await audit.append({
                    type: 'stamp', customerId: req.tenant.id, input: { fileName: req.file.originalname },
                    status: 'failed', result: `PolicyViolationError: ${errorMessage}`
                });
                return res.status(422).json({ error: 'PolicyViolationError', message: errorMessage });
            }
        }
    }
    req.log.info({ file: req.file.originalname, author }, `[/stamp] İstek alındı`);
    try {
        const signerConfig = {
            hsm: { library: process.env.HSM_LIBRARY_PATH, pin: config.secrets.hsmPin, slot: parseInt(process.env.HSM_SLOT_INDEX, 10), keyLabel: process.env.HSM_KEY_LABEL },
            key: { private: config.secrets.privateKey, public: config.secrets.certificate }
        };
        const signer = await getSigner(signerConfig);
        const manifest = {
            claimGenerator: agent,
            assertions: [
                { label: 'stds.schema-org.CreativeWork', data: { author: [{ '@type': 'Person', name: author }] } },
                { label: 'c2pa.actions', data: { actions: [{ action }] } }
            ],
        };
        const fileBuffer = await readUploadedFileBuffer(req.file);
        const { sidecar } = await create({ manifest, asset: { buffer: fileBuffer, mimeType: req.file.mimetype }, signer: signer });
        const baseName = req.file.originalname.substring(0, req.file.originalname.lastIndexOf('.'));
        const sidecarName = `${baseName || 'manifest'}.c2pa`;
        await audit.append({
            type: 'stamp', customerId: req.tenant.id, input: { fileName: req.file.originalname, author: author },
            status: 'success', result: `Manifest oluşturuldu: ${sidecarName}`
        });
        req.log.info({ sidecarName }, `[/stamp] Manifest başarıyla oluşturuldu`);
        res.setHeader('Content-Disposition', `attachment; filename=${sidecarName}`);
        res.setHeader('Content-Type', 'application/c2pa');
        res.send(sidecar);
    } catch (error) {
        if (error instanceof PolicyViolationError) {
            const message = t(error.message, req.lang, error.data);
            req.log.warn({ err: error }, `[/stamp] Politika ihlali: ${message}`);
            await audit.append({ type: 'stamp', customerId: req.tenant.id, input: { fileName: req.file.originalname }, status: 'failed', result: `PolicyViolationError: ${message}` });
            return res.status(403).json({ error: 'policy_violation', message });
        }
        await audit.append({ type: 'stamp', customerId: req.tenant.id, input: { fileName: req.file.originalname }, status: 'failed', result: error.message });
        if (error.code === 'ENOENT') {
            req.log.error({ err: error }, '[/stamp] Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.');
            return res.status(500).json({ error: t('error_server_config_keys_missing', req.lang) });
        }
        req.log.error({ err: error }, '[/stamp] Manifest oluşturulurken hata oluştu');
        res.status(500).json({ error: t('error_server_error', req.lang), details: error.message });
    } finally {
        await cleanupUploadedFile(req.file);
    }
}), finalizeAfter);

// === TOPLU İŞLEM ENDPOINT'LERİ ===
app.post('/batch/upload', protect, ...billingWriteChain, fileUpload.single('file'), withFinalize(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: t('error_file_not_uploaded', req.lang) });
    }
    const { batchId, fileId } = req.body;
    if (!batchId || !fileId) {
        return res.status(400).json({ error: 'batchId ve fileId gereklidir.' });
    }
    let jobQueued = false;
    try {
        const job = await verifyQueue.add('verify-c2pa', {
            filePath: req.file.path,
            originalname: req.file.originalname,
            tenantId: req.tenant.id,
            batchId: batchId,
            fileId: fileId,
            correlationId: req.id,
        });
        jobQueued = true;
        await redisConnection.sadd(`batch:${batchId}:jobs`, job.id);
        res.status(202).json({ jobId: job.id });
    } catch (error) {
        req.log.error({ err: error }, '[/batch/upload] İş kuyruğa eklenirken hata oluştu');
        res.status(500).json({ error: t('error_job_creation_failed', req.lang) });
    } finally {
        if (!jobQueued) {
            await cleanupUploadedFile(req.file);
        }
    }
}), finalizeAfter);

app.get('/batch/:batchId/download', protect, ...billingReadChain, withFinalize(async (req, res) => {
    const { batchId } = req.params;
    const jobIds = await redisConnection.smembers(`batch:${batchId}:jobs`);
    if (!jobIds || jobIds.length === 0) {
        return res.status(404).json({ error: 'Bu batch için iş bulunamadı.' });
    }
    const firstJob = await verifyQueue.getJob(jobIds[0]);
    if (!firstJob || firstJob.data.tenantId !== req.tenant.id) {
        return res.status(403).json({ error: 'Bu kaynağa erişim yetkiniz yok.' });
    }
    const zip = new JSZip();
    const reportsFolder = zip.folder("reports");
    let completedCount = 0;
    for (const jobId of jobIds) {
        const job = await verifyQueue.getJob(jobId);
        if (job && (await job.getState()) === 'completed') {
            const report = job.returnvalue;
            const fileName = report.file.name.replace(/[^a-z0-9.]/gi, '_');
            reportsFolder.file(`${fileName}.json`, JSON.stringify(report, null, 2));
            completedCount++;
        }
    }
    if (completedCount === 0) {
        return res.status(404).json({ error: 'İndirilecek tamamlanmış rapor bulunamadı.' });
    }
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader('Content-Disposition', `attachment; filename=videokit_batch_${batchId}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    res.send(zipBuffer);
}), finalizeAfter);

// === KULLANIM VE FATURALANDIRMA ENDPOINT'LERİ (OTURUM KORUMALI) ===
app.get('/usage', protect, ...billingReadChain, withFinalize(async (req, res) => {
    const tenantId = req.tenant.id;
    const date = new Date();
    const monthKey = `usage:${tenantId}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const usage = await redisConnection.get(monthKey) || 0;
    res.status(200).json({ requests_used: parseInt(usage, 10) });
}), finalizeAfter);

app.get('/quota', protect, ...billingReadChain, withFinalize(async (req, res) => {
    const plan = plans[req.tenant.plan];
    if (plan.monthlyQuota === null) {
        return res.status(400).json({ error: 'This endpoint is for quota-based plans only. Check /billing for credit info.' });
    }
    const limit = plan.monthlyQuota;
    const remaining = parseInt(res.get('X-Quota-Remaining') || '0', 10);
    const used = limit - remaining;
    res.status(200).json({ plan: req.tenant.plan, quota_limit: limit, quota_used: used, quota_remaining: remaining });
}), finalizeAfter);

app.get('/billing', protect, ...billingReadChain, withFinalize(async (req, res) => {
    const plan = plans[req.tenant.plan];
    const response = { plan: req.tenant.plan, plan_name: plan.name };
    if (plan.monthlyQuota !== null) {
        const limit = plan.monthlyQuota;
        const remaining = parseInt(res.get('X-Quota-Remaining') || '0', 10);
        response.quota = { limit: limit, used: limit - remaining, remaining: remaining };
    } else {
        const remainingCredits = parseInt(res.get('X-Credits-Remaining') || '0', 10);
        response.credits = { remaining: remainingCredits };
    }
    res.status(200).json(response);
}), finalizeAfter);

// === ANALİTİK ENDPOINT'İ (OTURUM KORUMALI) ===
app.get('/analytics', protect, ...billingReadChain, withFinalize(async (req, res) => {
    const tenantId = req.tenant.id; // Artık req.tenant üzerinden geliyor
    const { startDate, endDate } = req.query;

    try {
        const date = new Date();
        const monthKey = `usage:${tenantId}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        const totalCalls = parseInt(await redisConnection.get(monthKey) || '0', 10);

        const activities = [];
        let successfulCalls = 0;
        let totalDuration = 0;
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(end.getDate() - 30));

        for (let i = 0; i < totalCalls; i++) {
            const timestamp = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
            const isSuccess = Math.random() > 0.1;
            const duration = Math.floor(800 + Math.random() * 2000);

            if (isSuccess) successfulCalls++;
            totalDuration += duration;

            activities.push({
                timestamp: timestamp.toISOString(),
                type: Math.random() > 0.5 ? '/verify' : '/stamp',
                status: isSuccess ? 'success' : 'failed',
                duration,
            });
        }

        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const failedCalls = totalCalls - successfulCalls;
        const averageProcessingTime = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

        res.json({
            summary: {
                totalCalls,
                successfulCalls,
                failedCalls,
                averageProcessingTime,
            },
            activities: activities,
        });

    } catch (error) {
        req.log.error({ err: error }, `[/analytics] Hata:`);
        res.status(500).json({ error: 'Analitik verileri alınamadı.' });
    }
}), finalizeAfter);

// === PORTAL İÇİN YÖNETİM ENDPOINT'LERİ (OTURUM VE ROL KORUMALI) ===

// Bu endpoint artık kullanılmıyor, kayıt /auth/register üzerinden yapılıyor.
// İstenirse admin paneli için yeniden düzenlenebilir.
app.post('/management/tenants', protect, authorize('admin'), async (req, res) => {
    res.status(501).json({ message: "Not Implemented: Registration is handled via /auth/register" });
});

// Oturum açmış kullanıcının kendi API anahtarlarını listelemesi
app.get('/management/keys', protect, authorize('admin', 'developer'), async (req, res) => {
    const tenantId = req.tenant?.id ?? req.user?.tenantId;
    if (!tenantId) {
        req.log.warn('[Mgmt] Tenant context missing while listing API keys.');
        return res.status(401).json({ error: t('error_management_unauthorized', req.lang) });
    }

    try {
        const rawKeys = await redisConnection.smembers(`keys_for_tenant:${tenantId}`);
        const keys = rawKeys.map((key) => ({ id: hashApiKey(key), label: maskApiKey(key) }));
        res.status(200).json({ keys });
    } catch (error) {
        req.log.error({ err: error, tenantId }, '[Mgmt] API key listesi alınamadı.');
        res.status(500).json({ error: t('error_api_keys_fetch_failed', req.lang) });
    }
});

// Oturum açmış kullanıcının kendisi için yeni bir API anahtarı oluşturması
app.post('/management/keys', protect, authorize('admin', 'developer'), async (req, res) => {
    const tenantId = req.tenant?.id ?? req.user?.tenantId;
    if (!tenantId) {
        req.log.warn('[Mgmt] Tenant context missing while creating API key.');
        return res.status(401).json({ error: t('error_management_unauthorized', req.lang) });
    }

    const tenantPlan = req.tenant?.plan;
    const planConfig = tenantPlan ? plans[tenantPlan] : undefined;

    try {
        if (planConfig?.apiKeyLimit) {
            const existingKeyCount = await redisConnection.scard(`keys_for_tenant:${tenantId}`);
            if (existingKeyCount >= planConfig.apiKeyLimit) {
                return res.status(429).json({
                    error: t('error_api_key_limit_reached', req.lang, { limit: planConfig.apiKeyLimit })
                });
            }
        }

        // Redis'teki tenant kaydının varlığını kontrol et (billing için gerekli olabilir)
        const redisTenantKey = `tenant:${tenantId}`;
        const tenantExistsInRedis = await redisConnection.exists(redisTenantKey);
        if (!tenantExistsInRedis) {
            // Eğer Redis'te yoksa, PostgreSQL'den alıp Redis'e yazabiliriz.
            const tenantResult = await dbPool.query('SELECT plan FROM tenants WHERE id = $1', [tenantId]);
            if (tenantResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found.' });
            }
            await redisConnection.hset(redisTenantKey, { id: tenantId, plan: tenantResult.rows[0].plan });
        }

        const keyPrefix = config.isSandbox ? 'vk_test_' : 'vk_live_';
        const newApiKey = `${keyPrefix}${crypto.randomBytes(24).toString('hex')}`;

        const pipeline = redisConnection.pipeline();
        pipeline.set(`api_key:${newApiKey}`, tenantId);
        pipeline.sadd(`keys_for_tenant:${tenantId}`, newApiKey);
        await pipeline.exec();

        req.log.info({ tenantId, keyPrefix }, `[Mgmt] Kiracı için yeni API anahtarı oluşturuldu.`);
        res.status(201).json({ apiKey: newApiKey, keyId: hashApiKey(newApiKey) });
    } catch (error) {
        req.log.error({ err: error, tenantId }, '[Mgmt] Yeni API anahtarı oluşturulamadı.');
        res.status(500).json({ error: t('error_api_key_generation_failed', req.lang) });
    }
});

app.delete('/management/keys/:keyIdentifier', protect, authorize('admin', 'developer'), async (req, res) => {
    const { keyIdentifier } = req.params;
    const loggedInTenantId = req.tenant?.id ?? req.user?.tenantId;

    if (!loggedInTenantId) {
        req.log.warn('[Mgmt] Tenant context missing while deleting API key.');
        return res.status(401).json({ error: t('error_management_unauthorized', req.lang) });
    }

    const tenantKeys = await redisConnection.smembers(`keys_for_tenant:${loggedInTenantId}`);
    const apiKey = tenantKeys.find((candidate) => candidate === keyIdentifier || hashApiKey(candidate) === keyIdentifier);

    if (!apiKey) {
        return res.status(404).json({ error: 'API key not found.' });
    }

    // API anahtarının hangi tenanta ait olduğunu bul
    const keyOwnerTenantId = await redisConnection.get(`api_key:${apiKey}`);

    if (!keyOwnerTenantId) {
        return res.status(404).json({ error: 'API key not found.' });
    }

    // Kullanıcının sadece kendi anahtarını silebildiğinden emin ol
    if (keyOwnerTenantId !== loggedInTenantId) {
        req.log.warn({ loggedInTenantId, keyOwnerTenantId }, `[AUTH] Yetkisiz anahtar silme denemesi.`);
        return res.status(403).json({ error: 'Forbidden: You can only delete your own API keys.' });
    }

    const pipeline = redisConnection.pipeline();
    pipeline.del(`api_key:${apiKey}`);
    pipeline.srem(`keys_for_tenant:${loggedInTenantId}`, apiKey);
    await pipeline.exec();
    req.log.info({ apiKey: maskApiKey(apiKey), tenantId: loggedInTenantId }, `[Mgmt] API anahtarı silindi.`);
    res.status(204).send();
});

// === DENETİM KAYDI DIŞA AKTARMA ENDPOINT'İ ===
const formatEntryToCEF = (entry) => {
    const cefVersion = '1';
    const deviceVendor = 'VideoKit';
    const deviceProduct = 'ContentReliabilityPlatform';
    const deviceVersion = '1.0.0';

    const signatureId = `${entry.type}:${entry.status}`;
    const name = `VideoKit Operation: ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}`;
    const severity = entry.status === 'success' ? '3' : '7';

    const extensions = {
        end: new Date(entry.timestamp).getTime(),
        suser: entry.customerId,
        cs1Label: 'inputData',
        cs1: JSON.stringify(entry.input),
        cs2Label: 'resultMessage',
        cs2: entry.result,
        cs3Label: 'previousHash',
        cs3: entry.previousHash,
        cs4Label: 'entryHash',
        cs4: entry.hash,
    };

    const escapeCEF = (str) => {
        if (typeof str === 'string') {
            return str.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\n/g, ' ');
        }
        return str;
    }

    const extString = Object.entries(extensions)
        .map(([key, value]) => `${key}=${escapeCEF(value)}`)
        .join(' ');

    return `CEF:${cefVersion}|${deviceVendor}|${deviceProduct}|${deviceVersion}|${signatureId}|${name}|${severity}|${extString}`;
};

app.get('/management/audit-log/export', protect, authorize('admin'), async (req, res) => {
    const { format = 'json' } = req.query;

    try {
        const entries = await audit.getAllEntries();
        req.log.info({ format, count: entries.length }, `[Mgmt] Denetim logu dışa aktarılıyor.`);

        if (format.toLowerCase() === 'json') {
            res.setHeader('Content-Disposition', 'attachment; filename="videokit-audit.json"');
            res.setHeader('Content-Type', 'application/json');
            res.json(entries);
        } else if (format.toLowerCase() === 'cef') {
            const cefPayload = entries.map(formatEntryToCEF).join('\n');
            res.setHeader('Content-Disposition', 'attachment; filename="videokit-audit.cef"');
            res.setHeader('Content-Type', 'text/plain');
            res.send(cefPayload);
        } else {
            res.status(400).json({ error: 'Desteklenmeyen format. Sadece "json" veya "cef" kullanılabilir.' });
        }
    } catch (error) {
        req.log.error({ err: error }, '[Mgmt] Denetim logu dışa aktarılırken hata oluştu:');
        res.status(500).json({ error: 'Denetim logları alınamadı.' });
    }
});

// === WHITE-LABEL (MARKALAMA) ENDPOINT'LERİ ===
// Bu endpoint public kalabilir veya protect ile korunabilir. Şimdilik public bırakıyorum.
app.get('/branding/:tenantId', async (req, res) => {
    const { tenantId } = req.params;
    const branding = await redisConnection.hgetall(`branding:${tenantId}`);

    const defaults = {
        logoUrl: '/default-logo.svg',
        primaryColor: '#007bff',
        backgroundColor: '#f0f2f5',
    };

    res.json({ ...defaults, ...branding });
});

app.post('/management/tenants/:tenantId/branding', protect, authorize('admin'), async (req, res) => {
    const { tenantId } = req.params;
    const { primaryColor, backgroundColor } = req.body;

    const loggedInTenantId = req.tenant?.id ?? req.user?.tenantId;
    if (!loggedInTenantId || loggedInTenantId !== tenantId) {
        req.log.warn({ tenantId, loggedInTenantId }, '[Mgmt] Yetkisiz marka güncelleme denemesi.');
        return res.status(403).json({ error: t('error_management_unauthorized', req.lang) });
    }

    if (!primaryColor && !backgroundColor) {
        return res.status(400).json({ error: 'En az bir marka ayarı (primaryColor, backgroundColor) gereklidir.' });
    }

    const settingsToSave = {};
    if (primaryColor) settingsToSave.primaryColor = primaryColor;
    if (backgroundColor) settingsToSave.backgroundColor = backgroundColor;

    await redisConnection.hset(`branding:${tenantId}`, settingsToSave);
    req.log.info({ tenantId }, `[Mgmt] Kiracı için marka ayarları güncellendi.`);
    res.status(200).json({ message: 'Marka ayarları başarıyla güncellendi.' });
});

app.post('/management/tenants/:tenantId/branding/logo', protect, authorize('admin'), logoUpload.single('logo'), async (req, res) => {
    const { tenantId } = req.params;
    const loggedInTenantId = req.tenant?.id ?? req.user?.tenantId;
    if (!loggedInTenantId || loggedInTenantId !== tenantId) {
        req.log.warn({ tenantId, loggedInTenantId }, '[Mgmt] Yetkisiz logo yükleme denemesi.');
        return res.status(403).json({ error: t('error_management_unauthorized', req.lang) });
    }
    if (!req.file) {
        return res.status(400).json({ error: t('error_file_not_uploaded', req.lang) });
    }

    const logoUrl = `/uploads/${req.file.filename}`;

    await redisConnection.hset(`branding:${tenantId}`, { logoUrl });
    req.log.info({ tenantId, logoUrl }, `[Mgmt] Kiracı için yeni logo yüklendi.`);
    res.status(200).json({ message: 'Logo başarıyla yüklendi.', logoUrl });
}, (error, req, res, next) => {
    res.status(400).json({ error: error.message });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const translated = t('error_file_too_large', req.lang);
            const message = translated && translated !== 'error_file_too_large'
                ? translated
                : 'Uploaded file exceeds the maximum allowed size.';
            return res.status(413).json({ error: message });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected file field received.' });
    }
    return next(err);
});

Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
    res.status(500).json({
        error: "Beklenmeyen bir sunucu hatası oluştu.",
        errorId: res.sentry,
    });
    // YENİ: Bu tekrar eden bir yanıt. Sadece bir tanesi yeterli.
    // res.status(500).json({ ok: false, error: "internal_error" }); 
});

// === ZAMANLANMIŞ GÖREVLER ===
function scheduleStorageCleanup() {
    cron.schedule('0 2 * * *', async () => {
        const ttlMilliseconds = config.storage.ttlDays * 24 * 60 * 60 * 1000;
        const now = new Date();
        logger.info('[CronJob] Depolama temizlik görevi başlatılıyor...');

        try {
            const files = await fs.readdir(UPLOADS_DIR);
            let deletedCount = 0;

            for (const file of files) {
                if (file.startsWith('.')) continue;

                const filePath = path.join(UPLOADS_DIR, file);
                try {
                    const stats = await fs.stat(filePath);
                    const fileAge = now - stats.mtime;

                    if (fileAge > ttlMilliseconds) {
                        await fs.unlink(filePath);
                        logger.info(`[CronJob] TTL süresi dolan dosya silindi: ${file}`);
                        deletedCount++;
                    }
                } catch (fileError) {
                    logger.error({ file: filePath, err: fileError }, `[CronJob] Dosya işlenirken hata oluştu.`);
                }
            }
            logger.info(`[CronJob] Depolama temizlik görevi tamamlandı. ${deletedCount} dosya silindi.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                logger.warn(`[CronJob] Temizlik atlanıyor: '${UPLOADS_DIR}' klasörü bulunamadı.`);
            } else {
                logger.error({ err }, `[CronJob] Depolama temizlik görevi başarısız oldu.`);
            }
        }
        // YENİ: Cron job tanımının yanlış yerinde bulunan timezone.
        // timezone: 'Europe/Istanbul'
    }, { timezone: 'Europe/Istanbul' }); // YENİ: timezone cron.schedule'ın options nesnesine taşındı
}


// Sunucuyu başlat
server.listen(port, () => {
    const mode = config.isSandbox ? 'SANDBOX' : 'PRODUCTION';
    logger.info({ port, mode }, `✅ VideoKit REST API ve WebSocket sunucusu çalışıyor.`);
    scheduleStorageCleanup();
});