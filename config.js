import vault from 'node-vault';
import dotenv from 'dotenv';

// .env dosyasındaki değişkenleri process.env'e yükle
dotenv.config();

// Uygulama genelinde kullanılacak yapılandırma ve sırlar
const config = {
  isInitialized: false,
  isSandbox: process.env.NODE_ENV === 'sandbox',
  storage: {
    ttlDays: parseInt(process.env.STORAGE_TTL_DAYS, 10) || 30,
  },
  vault: {
    address: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
    token: process.env.VAULT_TOKEN,
  },
  // Veritabanı bağlantı bilgisi
  database: {
    connectionString: process.env.DATABASE_URL,
  },
  // JWT ayarları
  jwt: {
      expiresIn: '30d',
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

  // Veritabanı bağlantı dizesinin varlığını kontrol et
  if (!config.database.connectionString) {
      console.error('[Config] HATA: DATABASE_URL ortam değişkeni ayarlanmamış. Uygulama başlatılamıyor.');
      process.exit(1);
  }

  // Vault kullanımı opsiyonel, token yoksa atla ama logla
  if (!config.vault.token) {
    console.warn('[Config] UYARI: VAULT_TOKEN ayarlanmamış. Sırlar ortam değişkenlerinden alınacak.');
    
    // Gerekli sırları ortam değişkenlerinden (veya varsayılanlardan) al
    config.secrets = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      managementKey: process.env.MANAGEMENT_KEY || 'SUPER_SECRET_MANAGEMENT_KEY',
      jwtSecret: process.env.JWT_SECRET || 'SUPER_SECRET_JWT_KEY_REPLACE_IN_PROD',
      email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
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
      redisUrl: redisSecret?.data?.data?.url || process.env.REDIS_URL,
      hsmPin: hsmSecret?.data?.data?.pin,
      privateKey: fileKeysSecret?.data?.data?.privateKey,
      certificate: fileKeysSecret?.data?.data?.certificate,
      managementKey: mgmtSecret?.data?.data?.key || 'SUPER_SECRET_MANAGEMENT_KEY',
      jwtSecret: jwtSecret?.data?.data?.secret || process.env.JWT_SECRET,
      email: {
        host: emailSecret?.data?.data?.host,
        port: parseInt(emailSecret?.data?.data?.port, 10) || 587,
        secure: emailSecret?.data?.data?.secure === 'true', // Vault string saklar
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