# VideoKit - CLI & REST API Sunucusu

Bu belge, VideoKit platformunun CLI aracını ve REST API sunucusunu tek dokümanda açıklayan çalıştırma/runbook rehberidir. Amaç, yeni bir geliştiricinin sistemi dakikalar içinde ayağa kaldırabilmesi ve operasyonel olarak sürdürebilmesidir.

## Genel Bakış
- **Mimari**: Node.js tabanlı API (Express) + Worker süreçleri, Redis (rate limit, kuyruklar, idempotency), PostgreSQL (planlar, kullanım istatistikleri) ve isteğe bağlı HashiCorp Vault entegrasyonu.
- **Tenant ID**: Tüm servislerde ve şemalarda `text` olarak tutulur; UUID değerler dahi string olarak işlenir. Yeni tablolar/entegrasyonlar aynı tipte kalmalıdır.
- **Gizlilik**: API olay günlüğü (`api_events`) yalnızca metadata saklar; PII loglanmaz. Log seviyeleri `LOG_LEVEL` ile kontrol edilir.
- **Idempotency**: Yazma işlemleri `Idempotency-Key` başlığıyla güvence altına alınır. Aynı anahtar ikinci kez faturalandırma veya yan etki üretmez (`redis` + `idempotency_keys` tablosu, TTL 24 saat).
- **Ücretsiz GET Politikası**: GET istekleri kota ve kredi tüketmez; sadece yazma operasyonları (POST/PUT/PATCH/DELETE) faturalandırılır.

## Hızlı Başlangıç (Lokal Sandbox)
1. **Bağımlılıklar**: Docker & Docker Compose, Node.js 18+, npm, Redis/PostgreSQL için Docker görüntüleri.
2. **Depoyu hazırlayın**:
   ```bash
   npm install
   ```
3. **İmzalama anahtarlarını üretin** (`/stamp` için zorunlu):
   ```bash
   ./vk-cli.js keygen
   ```
4. **Örnek verileri seed edin** (Redis plan ve API anahtarları):
   ```bash
   npm run seed
   ```
5. **Tüm servisleri başlatın** (API, worker, Redis, PostgreSQL, Prometheus, Grafana):
   ```bash
   docker-compose up --build
   ```
   - API: http://localhost:3000
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:4000 (admin / admin)
6. **Durdurmak için** `docker-compose down` komutunu kullanın.

> **Not**: Sandbox konfigürasyonu için `docker-compose -f docker-compose.sandbox.yml up --build` ve `npm run seed:sandbox` komutları kullanılabilir.

## CLI Kurulumu ve Kullanımı
- **Kurulum**: Gelecekte Homebrew tap veya `curl -fsSL https://URL_TO_YOUR/install.sh | sh` betiği.
- **Temel Komutlar**: `vk verify`, `vk stamp --author`, `vk keygen`, `vk stream-capture`, `vk config set|get|list`, `vk klv to-json/from-json`, `vk self-update`.

## Ortam Değişkenleri
| Adı | Zorunlu | Varsayılan / Not | Açıklama |
| --- | --- | --- | --- |
| `NODE_ENV` | Hayır | `development` | `development` / `sandbox` / `production` / `test`. `sandbox` Vault pathlerini değiştirir. |
| `DATABASE_URL` | Evet | - | PostgreSQL bağlantısı. |
| `REDIS_URL` | Evet | - | Redis bağlantısı. Vault yoksa doğrudan kullanılır. |
| `DEFAULT_PLAN_LIMIT` | Evet | - | Varsayılan aylık kota (int). |
| `BILLING_ENFORCEMENT` | Evet | - | `true/false` ⇒ kota/kredi zorlaması. |
| `ANALYTICS_LOGGING` | Evet | - | Analytics event toplama kontrolü. |
| `STORAGE_TTL_DAYS` | Hayır | `30` | Geçici dosya silme süresi (gün). |
| `VAULT_ADDR` | Hayır | `http://127.0.0.1:8200` | HashiCorp Vault URL'si. |
| `VAULT_TOKEN` | Hayır | - | Vault erişim token'ı. Yoksa sırlar `.env`'den okunur. |
| `MANAGEMENT_KEY`, `JWT_SECRET` | Hayır | Yedek değerler atanır | Yönetim API anahtarı & JWT sırrı. Üretimde Vault'tan alınmalıdır. |
| `JWT_EXPIRES_IN` | Hayır | `30d` | JWT geçerlilik süresi. |
| `EMAIL_HOST`/`PORT`/`SECURE`/`USER`/`PASS` | Hayır | `587`, `false` vb. | Bildirim e-postaları için SMTP. |
| `PORT` | Hayır | `3000` | API dinleme portu. |
| `LOG_LEVEL` | Hayır | `info` | `pino` logger seviyesi. |
| `MAX_UPLOAD_SIZE_BYTES` | Hayır | - | Upload boyutu sınırı. |
| `CORS_ALLOWED_ORIGINS` | Hayır | - | Virgülle ayrılmış izinli origin listesi. |
| `TRACING_ENABLED` | Hayır | `0` | `1` ⇒ OpenTelemetry enstrümantasyonu (`tracing.js`). |
| `OTEL_SERVICE_NAME` / `OTEL_SERVICE_VERSION` / `OTEL_SERVICE_NAMESPACE` | Hayır | Paket metadatası | OTEL kaynak bilgileri. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `_TRACES_ENDPOINT` / `_HEADERS` | Hayır | - | OTLP exporter konfigürasyonu. |
| `SENTRY_DSN` | Hayır | - | `instrument.mjs` aracılığıyla hata izleme. |
| `C2PA_ENABLED` | Hayır | `true` | `false` ⇒ C2PA kullanan endpoint'ler kayıt edilmez. |
| `HSM_LIBRARY_PATH` / `HSM_SLOT_INDEX` / `HSM_KEY_LABEL` | Hayır | - | Donanımsal imzalama için. Vault'tan `hsmPin` beklenir. |
| `SIGNING_POLICY_HARDWARE_ONLY` | Hayır | `false` | CLI imzalarının yalnızca HSM ile yapılması. |
| `ROLLUP_PURGE_ENABLED`, `PURGE_ROLLUPS`, `ENABLE_ROLLUP_PURGE` | Hayır | `false` | Purge job'larında 12 aylık rollup temizliği için herhangi birini `true` yapın. |
| `TEST_EMAIL_RECIPIENT` | Hayır | - | `npm run test:email` hedefi için. |

> Vault aktif değilse `config.js`, zorunlu sırları ortam değişkenlerinden yükler ve log'a uyarı yazar.

## Feature Flag / Toggle Matrisi
| Bayrak | Kaynak | Etki |
| --- | --- | --- |
| `BILLING_ENFORCEMENT` | `config.defaults` | Kota aşımlarında 429 / 402 döndürülür. |
| `ANALYTICS_LOGGING` | `config.defaults` | `api_events` kayıtlarının toplanmasını tetikler. |
| `C2PA_ENABLED` | `server.mjs` | C2PA tabanlı doğrulama & damgalama endpoint'lerini aç/kapat. |
| `TRACING_ENABLED` | `server.mjs` | OpenTelemetry kolektörüne span gönderimi. |
| `ROLLUP_PURGE_ENABLED` (ve eş değerleri) | `jobs/purge.mjs` | `api_events_rollup_*` tablolarında 12 aylık veri temizliği. |
| `SIGNING_POLICY_HARDWARE_ONLY` | `videokit-signer.js` | CLI imzalarının yalnızca HSM ile yapılması. |

## Veritabanı ve Migrasyonlar
- Migrasyon aracı: `node-pg-migrate`.
- Komutlar:
  ```bash
  npm run migrate:up     # Tüm migrasyonları uygular
  npm run migrate:down   # Son migrasyonu geri alır
  npm run migrate        # Varsayılan (yukarı)
  ```
- Başlıca migrasyonlar:
  - `1726430400000_initial-schema.cjs`: Kullanıcı/rol iskeleti (uuid->text dönüşüm planlanıyorsa yeni migrasyonla yönetilir).
  - `1769300000000_create-api-events-and-usage-counters.cjs`: `api_events`, `usage_counters` (metadata odaklı, tenant_id TEXT).
  - `1769300001000_create-idempotency-keys.cjs`: Idempotency kayıtları (expires_at, TTL kontrolleri).
  - `1769300002000_update-tenants-and-plan-entitlements.cjs`: Plan hakları ve tenant plan atamaları.
  - `1769300003000_create_core_billing_tables.cjs`: Faturalandırma / idempotency / plan tabloları (tenant_id TEXT, plan entitlements).

## Test ve Kalite Kontrolleri
- Birim testleri: `npm test`
- E-posta entegrasyon testi (SMTP mock'u): `npm run test:email`
- Seed ve reset scriptleri: `npm run seed`, `npm run reset:sandbox`

## Arka Plan İşleri (Cron Önerileri)
| Komut | Önerilen Zamanlama (UTC) | Amaç |
| --- | --- | --- |
| `npm run job:flush-usage` | Her saat başı | Redis `usage:*` anahtarlarını PostgreSQL `usage_counters` tablosuna yazar; kota raporlaması.
| `npm run job:rollup-analytics` | 15 dakikada bir | `api_events` tablosundan saatlik/günlük rollup üretir (`analytics_rollup_state`).
| `npm run job:purge` | Günlük 02:00 UTC | 90 günden eski `api_events` ve 12 aydan eski rollup verilerini temizler (PII saklanmaz).

Cron çalıştırmadan önce `npm run migrate:up` ile tabloların mevcut olduğundan emin olun. İşler advisory lock kullanır; paralel koşum güvenlidir.

## Kota ve Faturalandırma Modeli
- Plan tanımları `server.mjs` içindeki `plans` map'inde sabitlenmiştir:
  - **free**: 10 istek/dk, aylık kota yok (kredi tabanlı), 1 API anahtarı.
  - **pro**: 100 istek/dk, aylık 1000 yazma işlemi, 5 API anahtarı.
  - **pay-as-you-go**: 120 istek/dk, aylık kota yok, kredi bazlı.
  - **trial**: 20 istek/dk, aylık 500 yazma işlemi, 2 API anahtarı.
- Kota anahtarları `usage:{tenantId}:{YYYY-MM}` formatındadır; ay sonuna göre UTC olarak sıfırlanır.
- Kredili planlarda (`monthlyQuota === null`) `credits:{tenantId}` Redis anahtarı kullanılır.
- Yanıt başlıkları: `X-RateLimit-*`, `X-Quota-*`, `X-Credits-Remaining`.
- Billable ağırlıklar `src/core/billing-map.mjs` dosyasında tutulur. Yeni endpoint eklerken bu dosyaya kayıt ekleyin.

## Billable Map Referansı
- Konum: `src/core/billing-map.mjs`
- Normalizasyon: `normalizeEndpoint` helper'ı path parametrelerini (`/jobs/:id`) stabilize eder.
- Ağırlıklar (`weight`) kotaların hangi hızla tükeneceğini belirler. Varsayılan `1`.

## Veri Saklama Politikaları
- `api_events`: 90 gün (bkz. `jobs/purge.mjs`).
- Rollup tabloları (`api_events_rollup_hourly/daily`): 12 ay.
- Idempotency kayıtları: Redis kilidi 5 dk, başarı cache'i 24 saat; PostgreSQL `idempotency_keys` tablosu `expires_at` alanına göre temizlenmelidir (gelecekteki bakım job'u).
- Geçici dosyalar: `STORAGE_TTL_DAYS` gün sonunda silinir (`server.mjs` içindeki upload temizleme).

## Rollback Playbook
1. **Sorunu tespit et**: Grafana alarmı → ilgili Request-ID ile `api_events` kaydını sorgula.
2. **Yeni sürümü durdur**: `docker-compose down` (veya orkestrasyon aracı). Worker ve API aynı anda durdurulmalı.
3. **Veritabanı geri alımı**: Son migrasyon problemliyse `npm run migrate:down` (tekrarlı çalıştırarak) ile geri dön.
4. **Önceki imajı başlat**: Stabil sürüm tag'iyle `docker-compose up -d --build --no-deps api worker`.
5. **Redis temizliği**: Gerekirse problemli `usage:` veya `idempotency:` anahtarlarını silin (tenant bazlı). GET istekleri ücretsiz olduğundan geri dönüş sırasında ekstra faturalandırma olmaz.
6. **Doğrulama**: Aşağıdaki smoke set (Request-ID zorunlu) ile kontrol edin ve Grafana dashboard'larını izleyin.

## Operasyonel İzleme
- **Healthcheck**: `GET /usage` veya `GET /quota` (GET ücretsizdir) 200 döndürmeli.
- **Metrics**: `GET /metrics` Prometheus formatında (docker-compose'da otomatik scrape edilir).
- **Tracing**: `TRACING_ENABLED=1` ve OTEL exporter ayarları ile span akışı sağlayın. Sentry DSN ayarlanırsa istisnalar raporlanır.

## cURL Smoke Set (Request-ID Dahil)
Aşağıdaki komutlarda `API_KEY` ortam değişkenine seed edilen anahtarı yerleştirin. Her istekte benzersiz `X-Request-Id` başlığı kullanın (örn. `uuidgen`).

```bash
export API=http://localhost:3000
export API_KEY=API_KEY_PRO_ALMOST_FULL
export RID=$(uuidgen)

# 1) Kota sorgusu (GET ücretsiz)
curl -sS -H "X-API-Key: $API_KEY" -H "X-Request-Id: $RID-usage" "$API/quota"

# 2) İmza doğrulama işi oluştur (Idempotency örneği)
curl -sS -X POST "$API/verify" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Request-Id: $RID-verify" \
  -H "Idempotency-Key: smoke-$RID" \
  -F "file=@/path/to/video.mp4"

# 3) İş durumu kontrolü
curl -sS -H "X-API-Key: $API_KEY" -H "X-Request-Id: $RID-job" "$API/jobs/1"

# 4) Kota & kullanım raporu (faturalandırma logu kontrolü)
curl -sS -H "X-API-Key: $API_KEY" -H "X-Request-Id: $RID-usage2" "$API/usage"
```

> **Request-ID Notu**: `X-Request-Id` başlığı sağlanmazsa sunucu UUID üretir; fakat olay analizi için istemci tarafında üretmeniz önerilir.

## Ek Kaynaklar
- `docs/api-contracts.md`: Endpoint detayları.
- `src/core/billing-map.mjs`: Billable map.
- `jobs/*.mjs`: Cron job implementasyonları.
- `config.js`: Ortam değişkeni şeması ve Vault entegrasyonu.

## Sık Karşılaşılan Sorunlar
- **Vault erişimi yok**: `VAULT_TOKEN` ayarlanmadığında uygulama `.env` girdilerini kullanır ve log'a uyarı yazar. Üretimde Vault zorunludur.
- **Rate limit aşıldı**: Yanıtta `X-RateLimit-*` başlıklarını kontrol edin. Gerekirse plan değiştirin veya kredileri artırın.
- **Webhook doğrulaması**: `X-Videokit-Signature` başlığı HMAC-SHA256 ile kontrol edilir (örnek kod README eski sürümünde mevcuttu; `WEBHOOK_SECRET` ile doğrulayın).

---

files changed: README.md
