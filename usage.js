import Redis from 'ioredis';
import config from '../config.js';

// Bu middleware, 'protect' middleware'inden SONRA çalışmalıdır.
// `req.user` nesnesinin var olduğunu varsayar.

const checkUsage = (plans) => {
    const redis = new Redis(config.secrets.redisUrl);

    return async (req, res, next) => {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant ID bulunamadı.' });
        }
        
        // REDIS'ten tenant bilgilerini al (plan vs.)
        // Not: Gerçek bir uygulamada bu bilgi JWT içinde veya ayrı bir DB sorgusu ile gelebilir.
        // Şimdilik Redis'ten alıyoruz.
        const tenantData = await redis.hgetall(`tenant:${tenantId}`);
        const planName = tenantData.plan || 'free';
        const plan = plans[planName];

        if (!plan) {
            return res.status(403).json({ error: 'Geçersiz abonelik planı.' });
        }
        
        // Kota bazlı planlar için kontrol
        if (plan.monthlyQuota !== null) {
            const date = new Date();
            const monthKey = `usage:${tenantId}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            
            const currentUsage = await redis.get(monthKey);
            const usage = currentUsage ? parseInt(currentUsage, 10) : 0;
            
            if (usage >= plan.monthlyQuota) {
                return res.status(429).json({ error: 'Aylık kotanız doldu.' });
            }
            
            res.set('X-Quota-Limit', plan.monthlyQuota);
            res.set('X-Quota-Remaining', plan.monthlyQuota - (usage + 1));
            
            // Kullanımı artır
            await redis.incr(monthKey);

        } else { // Kredi bazlı planlar için kontrol
            const credits = await redis.get(`credits:${tenantId}`);
            const remainingCredits = credits ? parseInt(credits, 10) : 0;
            
            if (remainingCredits <= 0) {
                return res.status(429).json({ error: 'Krediniz bitti.' });
            }
            
            res.set('X-Credits-Remaining', remainingCredits - 1);

            // Krediyi düşür
            await redis.decr(`credits:${tenantId}`);
        }
        
        next();
    };
};

export { checkUsage };