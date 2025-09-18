import vault from 'node-vault';
import dotenv from 'dotenv';
import { z } from 'zod';

// .env dosyasındaki değişkenleri process.env'e yükle
dotenv.config();

const booleanFromEnv = (options = { required: true }) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return options.required ? value : undefined;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }
    }

    return value;
  }, options.required ? z.boolean() : z.boolean().optional());

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'sandbox', 'production', 'test'])
      .default('development'),
    DATABASE_URL: z
      .string({ required_error: 'DATABASE_URL ortam değişkeni zorunludur.' })
      .min(1, 'DATABASE_URL ortam değişkeni boş olamaz.'),
    REDIS_URL: z
      .string({ required_error: 'REDIS_URL ortam değişkeni zorunludur.' })
      .min(1, 'REDIS_URL ortam değişkeni boş olamaz.'),
    DEFAULT_PLAN_LIMIT: z.coerce
      .number({ invalid_type_error: 'DEFAULT_PLAN_LIMIT sayısal bir değer olmalıdır.' })
      .int('DEFAULT_PLAN_LIMIT tam sayı olmalıdır.')
      .nonnegative('DEFAULT_PLAN_LIMIT negatif olamaz.'),
    BILLING_ENFORCEMENT: booleanFromEnv(),
    ANALYTICS_LOGGING: booleanFromEnv(),
    STORAGE_TTL_DAYS: z.coerce
      .number({ invalid_type_error: 'STORAGE_TTL_DAYS sayısal bir değer olmalıdır.' })
      .int('STORAGE_TTL_DAYS tam sayı olmalıdır.')
      .positive('STORAGE_TTL_DAYS 0\'dan büyük olmalıdır.')
      .default(30),
    VAULT_ADDR: z
      .string()
      .url('VAULT_ADDR geçerli bir URL olmalıdır.')
      .optional(),
    VAULT_TOKEN: z.string().optional(),
    MANAGEMENT_KEY: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    JWT_EXPIRES_IN: z.string().optional(),
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce
      .number({ invalid_type_error: 'EMAIL_PORT sayısal bir değer olmalıdır.' })
      .int('EMAIL_PORT tam sayı olmalıdır.')
      .positive('EMAIL_PORT 0\'dan büyük olmalıdır.')
      .optional(),
    EMAIL_SECURE: booleanFromEnv({ required: false }),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
  })
  .passthrough();

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  const formattedErrors = envResult.error.errors
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');

  console.error('[Config] HATA: Ortam değişkenleri doğrulanamadı. Uygulama sonlandırılıyor.');
  console.error(`[Config] Ayrıntılar: ${formattedErrors}`);
  process.exit(1);
}

const env = envResult.data;

// Uygulama genelinde kullanılacak yapılandırma ve sırlar
const config = {
  isInitialized: false,
  isSandbox: env.NODE_ENV === 'sandbox',
  defaults: {
    planLimit: env.DEFAULT_PLAN_LIMIT,
    billingEnforcement: env.BILLING_ENFORCEMENT,
    analyticsLogging: env.ANALYTICS_LOGGING,
  },
  storage: {
    ttlDays: env.STORAGE_TTL_DAYS,
  },
  vault: {
    address: env.VAULT_ADDR || 'http://127.0.0.1:8200',
    token: env.VAULT_TOKEN,
  },
  // Veritabanı bağlantı bilgisi
  database: {
    connectionString: env.DATABASE_URL,
  },
  // JWT ayarları
  jwt: {
    expiresIn: env.JWT_EXPIRES_IN || '30d',
  },
  secrets: {}, // Vault'tan veya ortam değişkenlerinden çekilen sırlar burada saklanacak
};

/**
 * Vault'a bağlanır ve gerekli tüm sırları çekip config.secrets nesnesine doldurur.
 * Başarısız olursa uygulama "fail-safe" olarak kendini sonlandırır.
 */
export async function initialize() {
  if (config.isInitialized) {
    return;
  }

  // Vault kullanımı opsiyonel, token yoksa atla ama logla
  if (!config.vault.token) {
    console.warn('[Config] UYARI: VAULT_TOKEN ayarlanmamış. Sırlar ortam değişkenlerinden alınacak.');

    // Gerekli sırları ortam değişkenlerinden (veya varsayılanlardan) al
    config.secrets = {
      redisUrl: env.REDIS_URL,
      managementKey: env.MANAGEMENT_KEY || 'SUPER_SECRET_MANAGEMENT_KEY',
      jwtSecret: env.JWT_SECRET || 'SUPER_SECRET_JWT_KEY_REPLACE_IN_PROD',
      email: {
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT || 587,
        secure: env.EMAIL_SECURE ?? false,
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    };

    config.isInitialized = true;
    console.log('[Config] Yapılandırma ortam değişkenlerinden yüklendi.');
    return;
  }

  try {
    const vaultClient = vault({
      apiVersion: 'v1',
      endpoint: config.vault.address,
      token: config.vault.token,
    });

    const vaultPrefix = config.isSandbox ? 'kv/data/sandbox/videokit' : 'kv/data/videokit';
    console.log(`[Config] Ortam: ${config.isSandbox ? 'Sandbox' : 'Production'}. Vault yolu: ${vaultPrefix}`);

    // Sırları Vault'taki yollarından al
    const redisSecret = await vaultClient.read(`${vaultPrefix}/redis`);
    const hsmSecret = await vaultClient.read(`${vaultPrefix}/hsm`);
    const fileKeysSecret = await vaultClient.read(`${vaultPrefix}/file-keys`);
    const mgmtSecret = await vaultClient.read(`${vaultPrefix}/management`);
    const emailSecret = await vaultClient.read(`${vaultPrefix}/email`);
    const jwtSecret = await vaultClient.read(`${vaultPrefix}/jwt`);


    // Alınan sırları merkezi config nesnesine ata
    config.secrets = {
      redisUrl: redisSecret?.data?.data?.url || env.REDIS_URL,
      hsmPin: hsmSecret?.data?.data?.pin,
      privateKey: fileKeysSecret?.data?.data?.privateKey,
      certificate: fileKeysSecret?.data?.data?.certificate,
      managementKey: mgmtSecret?.data?.data?.key || env.MANAGEMENT_KEY || 'SUPER_SECRET_MANAGEMENT_KEY',
      jwtSecret: jwtSecret?.data?.data?.secret || env.JWT_SECRET,
      email: {
        host: emailSecret?.data?.data?.host,
        port: parseInt(emailSecret?.data?.data?.port, 10) || env.EMAIL_PORT || 587,
        secure:
          emailSecret?.data?.data?.secure === 'true'
          || emailSecret?.data?.data?.secure === true
          || env.EMAIL_SECURE
          || false, // Vault string saklar
        user: emailSecret?.data?.data?.user,
        pass: emailSecret?.data?.data?.pass, // SendGrid, vb. için API Key
      },
    };

    // Gerekli tüm sırların varlığını kontrol et
    if (!config.secrets.redisUrl || !config.secrets.email?.host || !config.secrets.jwtSecret) {
        throw new Error('Gerekli sırlardan bazıları Vault\'ta bulunamadı (redisUrl, email.host, jwtSecret).');
    }

    config.isInitialized = true;
    console.log('[Config] Sırlar başarıyla Vault\'tan yüklendi.');

  } catch (error) {
    console.error('[Config] HATA: Vault\'tan sırlar alınamadı. Uygulama güvenli modda sonlandırılıyor.', error.message);
    process.exit(1); // Fail-safe: Sırlar olmadan çalışma
  }
}

export default config;