# API Contract Doğrulama — `/usage`, `/analytics`

## Kapsam
- `GET /usage`
- `GET /analytics`
- Standart hata yanıtı şeması

## Uygulama İncelemesi
- Hata yanıtları `http-error.js` içindeki `sendError` fonksiyonu tarafından üretilir ve her yanıta `code`, `message`, `requestId` alanlarını ekler; varsa `details` alanı da döner. 【F:http-error.js†L5-L49】
- Kimliği doğrulanmış isteklerde tenant bağlamı `resolveTenant` ile çözümlenir; başarısız durumlarda standart hata şeması ve sözleşmedeki kodlar (`TENANT_MISSING`, `AUTHENTICATION_REQUIRED`, `TENANT_RESOLUTION_FAILED`) kullanılır. 【F:middleware/billing.js†L443-L492】

### `GET /usage`
- Uç nokta tenant'ın içinde bulunulan ay için toplam faturalandırılabilir çağrı sayısını `requests_used` alanı ile döner. 【F:server.mjs†L813-L819】
- Başarılı yanıtlarda plan bazlı oran limitleri için `X-RateLimit-*` başlıkları middleware tarafından ayarlanır. 【F:middleware/billing.js†L471-L488】
- Hata durumları dokümandaki tablo ile örtüşür: kimlik doğrulaması eksikse `401 AUTHENTICATION_REQUIRED`, tenant çözümlenemediğinde `403 TENANT_MISSING`, okuma oran limiti aşıldığında `429 READ_RATE_LIMIT_EXCEEDED`, içsel çözümleme hatalarında `500 TENANT_RESOLUTION_FAILED`/`READ_RATE_LIMIT_FAILURE`. 【F:middleware/billing.js†L443-L492】【F:docs/api-contracts.md†L63-L71】

### `GET /analytics`
- Sorgu parametreleri `tenantId`, `from`/`to` (`startDate`/`endDate` eşdeğeri) ve `groupBy` (`hour` veya `day`) olarak ayrıştırılır; geçersiz değerlerde uygun `400` kodları döner. 【F:server.mjs†L853-L893】
- Yanıt gövdesi toplamlar, başarı oranı, hata kırılımları, gecikme metrikleri ve en çok çağrılan uç noktaları içerir; değerler SQL sorguları ile hesaplanır ve sözleşmedeki alan adları bire bir eşleşir. 【F:server.mjs†L900-L999】
- Tenant çözümleme ve oran limiti hataları `/usage` ile aynı kodları üretir; analitik derleme sırasında beklenmeyen hata oluşursa `500 ANALYTICS_FETCH_FAILED` döner. 【F:server.mjs†L900-L1003】【F:docs/api-contracts.md†L139-L151】

## Doküman Güncellemesi
- `docs/api-contracts.md` hata tabloları, uygulamadaki `TENANT_RESOLUTION_FAILED` kodunu da kapsayacak şekilde güncellendi. 【F:docs/api-contracts.md†L63-L151】

## Sonuç
- Yapılan düzeltmelerle birlikte uygulama yanıtları ile dokümantasyon bire bir uyumludur; sapma tespit edilmemiştir.
