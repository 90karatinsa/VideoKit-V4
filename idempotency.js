import { sendError } from './http-error.js';

/**
 * Express için bir idempotency middleware (ara yazılım) oluşturur.
 * Bu middleware, aynı 'Idempotency-Key' başlığına sahip tekrar eden isteklerin
 * birden çok kez işlenmesini engelleyerek istenmeyen yan etkilerin önüne geçer.
 * * @param {import('ioredis').Redis} redis - Bağlı bir ioredis istemci örneği.
 * @returns {import('express').RequestHandler} Express middleware fonksiyonu.
 */
export const createIdempotencyMiddleware = (redis) => {
  return async (req, res, next) => {
    // Middleware'i sadece POST gibi durum değiştiren metotlara uygula
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.get('Idempotency-Key');
    // Eğer başlık yoksa, bu isteği standart bir şekilde işle
    if (!idempotencyKey) {
      return next();
    }

    const redisKey = `idempotency:${idempotencyKey}`;
    
    // 1. Önbellekte mevcut bir sonuç veya devam eden bir işlem olup olmadığını kontrol et
    const storedValue = await redis.get(redisKey);

    if (storedValue) {
      try {
        const data = JSON.parse(storedValue);
        // Başka bir isteğin bu anahtarı şu anda işlediğini belirten bir kilit var mı?
        if (data.status === 'processing') {
          console.log(`[Idempotency] CONFLICT: ${idempotencyKey} anahtarı için zaten bir işlem sürüyor.`);
          return sendError(res, req, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress.');
        } else {
          // Önbellekte tamamlanmış bir sonuç var. Onu döndür.
          console.log(`[Idempotency] HIT: ${idempotencyKey} anahtarı için önbellekteki yanıt döndürülüyor.`);
          res.status(data.statusCode);
          res.set(data.headers);
          // Gövde base64 olarak saklandığı için çözümlenip gönderilir.
          return res.send(Buffer.from(data.body, 'base64'));
        }
      } catch (err) {
        // Redis'teki veri bozuk olabilir. Güvenli olması için anahtarı silip isteği yeniden işle.
        console.error(`[Idempotency] HATA: ${redisKey} anahtarındaki veri bozuk. Anahtar silinip devam ediliyor.`, err);
        await redis.del(redisKey);
      }
    }

    // 2. Yeni bir istek için atomik olarak kilit oluştur
    // 'NX' (if Not eXists) seçeneği, sadece anahtar yoksa değeri yazar.
    // Kilit, işlemin takılı kalmaması için 5 dakika (300sn) sonra otomatik olarak silinir.
    const lockAcquired = await redis.set(redisKey, JSON.stringify({ status: 'processing' }), 'EX', 300, 'NX');
    
    if (!lockAcquired) {
      // Bu, çok nadir bir race condition durumudur: İlk 'get' ile bu 'set' arasına başka bir istek girdi.
      // Bu durumu da devam eden bir işlem olarak kabul edip 409 döndür.
      return sendError(res, req, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress.');
    }

    console.log(`[Idempotency] MISS: ${idempotencyKey} anahtarı için yeni istek işleniyor.`);

    // 3. Yanıtı yakalamak ve önbelleğe almak için 'res.send' metodunu üzerine yaz
    const originalSend = res.send;
    res.send = function(body) {
      // Sadece başarılı (2xx) veya yönlendirme (3xx) yanıtlarını önbelleğe al
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const responseToStore = {
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          // Gövde binary veri olabileceğinden, tutarlılık için hep base64'e çevir
          body: Buffer.isBuffer(body) ? body.toString('base64') : Buffer.from(body).toString('base64'),
        };
        // Sonucu 24 saat boyunca önbellekte tut
        redis.set(redisKey, JSON.stringify(responseToStore), 'EX', 86400);
      } else {
        // Eğer istek başarısız olursa (4xx, 5xx), anahtarı silerek yeniden denemeye izin ver
        redis.del(redisKey);
      }
      // Orijinal 'send' fonksiyonunu çağırarak yanıtı istemciye gönder
      return originalSend.apply(res, arguments);
    };
    
    // 4. İstemci bağlantıyı erken kapatırsa kilidi temizle
    res.on('close', async () => {
      // Eğer yanıt daha gönderilmemişse (writableEnded false ise)
      if (!res.writableEnded) {
        console.log(`[Idempotency] CANCEL: Bağlantı kapandı, ${idempotencyKey} kilidi serbest bırakılıyor.`);
        await redis.del(redisKey);
      }
    });

    next();
  };
};