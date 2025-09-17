import Redis from 'ioredis';

// Komut satırı argümanlarını işle
const isSandbox = process.argv.includes('--sandbox');

// Ortama göre Redis URL'sini ve anahtar önekini belirle
const redisUrl = isSandbox ? 'redis://127.0.0.1:6380' : (process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const keyPrefix = isSandbox ? 'vk_test_' : 'vk_live_';

console.log(`Veritabanı hazırlık betiği çalışıyor...`);
console.log(`Ortam: ${isSandbox ? 'Sandbox' : 'Production'}`);
console.log(`Redis Adresi: ${redisUrl}`);

// Örnek abonelik planları
const plans = {
  free: {
    name: 'Free Tier',
    rateLimit: 10,
    quota: null,
    credits: 100,
  },
  pro: {
    name: 'Pro Tier',
    rateLimit: 100,
    quota: 1000,
    credits: 0,
  },
  'pay-as-you-go': {
    name: 'Pay as you go',
    rateLimit: 120,
    quota: null,
    credits: 500,
  },
  trial: { // YENİ: Deneme sürümü planı
    name: 'Trial Version',
    rateLimit: 20,
    quota: 500, // Kota bazlı
    credits: 0,
  }
};

// Örnek kiracılar (tenants) ve API anahtarları
const tenants = [
  {
    id: 'tenant_A_123',
    name: 'Organization A (Pro Plan)',
    apiKey: 'PRO_PLAN_KEY',
    plan: 'pro',
  },
  {
    id: 'tenant_B_456',
    name: 'Organization B (Pay as you go)',
    apiKey: 'PAYG_PLAN_KEY',
    plan: 'pay-as-you-go',
  },
  {
    id: 'tenant_C_789',
    name: 'Test User (Free Plan)',
    apiKey: 'FREE_PLAN_KEY',
    plan: 'free',
  },
  {
    id: 'tenant_D_000',
    name: 'Tester (Kredisi Biten)',
    apiKey: 'PAYG_NO_CREDITS_KEY',
    plan: 'pay-as-you-go',
    creditsOverride: 0,
  },
  {
    id: 'tenant_E_111',
    name: 'Tester (Kotası Dolmak Üzere)',
    apiKey: 'PRO_ALMOST_FULL_KEY',
    plan: 'pro',
    usageOverride: 999,
  },
];

async function seedDatabase() {
  const redis = new Redis(redisUrl);
  console.log('Redis bağlantısı kuruldu. Veritabanı temizleniyor...');
  
  await redis.flushdb();
  console.log('Veritabanı temizlendi. Yeni veriler ekleniyor...');

  const pipeline = redis.pipeline();

  for (const tenant of tenants) {
    const plan = plans[tenant.plan];
    const credits = tenant.creditsOverride ?? plan.credits;
    const finalApiKey = `${keyPrefix}${tenant.apiKey}`;

    pipeline.hset(`tenant:${tenant.id}`, {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
    });
    pipeline.set(`api_key:${finalApiKey}`, tenant.id);
    pipeline.sadd(`keys_for_tenant:${tenant.id}`, finalApiKey);
    pipeline.set(`credits:${tenant.id}`, credits);

    if (tenant.usageOverride !== undefined) {
      const date = new Date();
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      pipeline.set(`usage:${tenant.id}:${monthKey}`, tenant.usageOverride);
    }
  }
  
  console.log('Örnek marka ayarları ekleniyor...');
  pipeline.hset('branding:tenant_A_123', {
    logoUrl: '/default-logo.svg',
    primaryColor: '#007bff',
    backgroundColor: '#f0f2f5'
  });
  pipeline.hset('branding:tenant_B_456', {
    primaryColor: '#db6f00',
    backgroundColor: '#fff8f0'
  });

  await pipeline.exec();
  
  console.log(`✅ Veritabanına örnek kiracı verileri (${isSandbox ? 'Sandbox' : 'Production'}) başarıyla eklendi.`);
  console.log('Örnek API Anahtarları:');
  tenants.forEach(t => console.log(`  - ${t.name}: ${keyPrefix}${t.apiKey}`));
  
  await redis.quit();
}

seedDatabase().catch(console.error);