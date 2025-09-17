import fetch, { Response } from 'node-fetch';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import FormData from 'form-data';

// --- Type Tanımları ---

/**
 * VideoKit istemcisini yapılandırmak için kullanılan seçenekler.
 */
export interface VideoKitOptions {
  apiKey: string;
  baseUrl?: string;
}

/**
 * /verify endpoint'i için ek seçenekler.
 */
export interface VerifyOptions {
  webhookUrl?: string;
  webhookSecret?: string;
  /**
   * `true` olarak ayarlanırsa, SDK iş tamamlanana kadar bekler ve nihai sonucu döndürür.
   * `false` (varsayılan) ise, anında iş kimliğini (jobId) döndürür.
   */
  waitForResult?: boolean;
  /**
   * `waitForResult` true olduğunda, yoklama denemeleri arasındaki milisaniye cinsinden bekleme süresi.
   * Varsayılan: 2000ms
   */
  pollingInterval?: number;
  /**
   * `waitForResult` true olduğunda, sonuç alınamadan önce SDK'nın ne kadar süre bekleyeceği (milisaniye cinsinden).
   * Varsayılan: 60000ms
   */
  pollingTimeout?: number;
}

/**
 * Bir işin (job) durumunu temsil eden arayüz.
 */
export interface Job<T = any> {
  jobId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  result?: T;
  error?: string;
}

/**
 * Başarılı bir doğrulama işleminin sonucunu temsil eden arayüz.
 */
export interface VerificationResult {
  verdict: 'green' | 'red' | 'yellow';
  message: string;
  file: {
    name: string;
  };
  // Gelecekte eklenebilecek diğer detaylar
}

// --- Hata Sınıfı ---

export class VideoKitError extends Error {
  public readonly status: number;
  public readonly responseBody: any;

  constructor(message: string, status: number, responseBody: any) {
    super(message);
    this.name = 'VideoKitError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

// --- Ana SDK İstemcisi ---

export class VideoKit {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: VideoKitOptions) {
    if (!options.apiKey) {
      throw new Error('API anahtarı (apiKey) gereklidir.');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
  }

  private async _request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = { error: 'Yanıt gövdesi JSON formatında değil.' };
      }
      throw new VideoKitError(
        `API hatası: ${response.statusText} (${response.status})`,
        response.status,
        errorBody
      );
    }

    return response;
  }
  
  /**
   * Belirtilen kimliğe sahip bir işin durumunu ve sonucunu alır.
   * @param jobId İşin kimliği.
   * @returns İşin durumunu içeren bir Job nesnesi.
   */
  public async getJob(jobId: string): Promise<Job<VerificationResult>> {
    const response = await this._request(`/jobs/${jobId}`);
    return response.json() as Promise<Job<VerificationResult>>;
  }

  /**
   * Bir video dosyasını doğrulamak için yeni bir iş başlatır.
   * @param filePath Doğrulanacak video dosyasının yolu.
   * @param options Doğrulama işlemi için ek seçenekler.
   * @returns `waitForResult` seçeneğine bağlı olarak ya iş kimliğini ya da doğrulama sonucunu döndürür.
   */
  public async verify(
    filePath: string,
    options: VerifyOptions = {}
  ): Promise<{ jobId: string } | Job<VerificationResult>> {
    await fs.access(filePath); // Dosyanın var olup olmadığını kontrol et

    const form = new FormData();
    form.append('file', createReadStream(filePath), path.basename(filePath));
    if (options.webhookUrl) form.append('webhookUrl', options.webhookUrl);
    if (options.webhookSecret) form.append('webhookSecret', options.webhookSecret);

    const response = await this._request('/verify', {
      method: 'POST',
      body: form,
    });
    
    const initialResponse = await response.json() as { jobId: string };

    if (!options.waitForResult) {
      return initialResponse;
    }

    // --- Sonuç için Bekleme (Polling) Mantığı ---
    const { pollingInterval = 2000, pollingTimeout = 60000 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const intervalId = setInterval(async () => {
        if (Date.now() - startTime > pollingTimeout) {
          clearInterval(intervalId);
          return reject(new Error(`İş sonucu ${pollingTimeout}ms içinde alınamadı.`));
        }

        try {
          const job = await this.getJob(initialResponse.jobId);
          if (job.state === 'completed') {
            clearInterval(intervalId);
            resolve(job);
          } else if (job.state === 'failed') {
            clearInterval(intervalId);
            reject(new VideoKitError(job.error || 'İş başarısız oldu.', 500, job));
          }
          // 'waiting' veya 'active' durumunda bir sonraki denemeyi bekle
        } catch (error) {
          clearInterval(intervalId);
          reject(error);
        }
      }, pollingInterval);
    });
  }
}