# VideoKit API Contracts — Usage & Analytics

Bu doküman, VideoKit API'sindeki `/usage` ve `/analytics` uç noktalarının sözleşmelerini ve standart hata yanıt formatını tanımlar. Buradaki bilgiler, `server.mjs` ve `http-error.js` dosyalarındaki gerçek uygulama ile bire bir uyumludur.

## Genel İlkeler

- **Tenant kimliği:** Tüm uç noktalar, `TEXT` tipinde tutulan tenant kimlikleri ile çalışır. Oturum bağlamındaki tenant ile istekte iletilen tenant her zaman eşleşmelidir.
- **Kimlik doğrulama:** Her iki uç nokta da `protect` middleware'i ile korunur. Kimlik doğrulaması geçerli bir oturum çerezi (`videokit_session`) ya da `Authorization: Bearer <token>` başlığı ile yapılır. `X-API-Key` başlığı ile yapılan anahtar temelli erişim de desteklenir.
- **Ücretlendirme ve kota:** Tüm `GET` çağrıları ücretsizdir ancak T6 seviyesinde okuma oranı sınırına tabidir. Oran sınırı aşıldığında `429 READ_RATE_LIMIT_EXCEEDED` hatası döner; yanıt başlıklarında `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` ve gerekirse `Retry-After` sağlanır.
- **Idempotency:** `GET` istekleri için idempotency anahtarı gerekmez; aynı `Idempotency-Key` değerinin tekrarlanması ek ücret oluşturmaz.
- **Gizlilik:** PII loglanmaz; `api_events` tablosuna yalnızca metadata yazılır.

## Standart Hata Yanıtı Şeması

Tüm hata yanıtları `http-error.js` içerisindeki `sendError` fonksiyonunun ürettiği aşağıdaki JSON şemasına uyar:

```
{
  "code": "STRING",
  "message": "STRING",
  "requestId": "UUID",
  "details": { "...": "OPTIONAL" }
}
```

- `code`: Uygulamaya özgü hata kodu (ör. `AUTHENTICATION_REQUIRED`, `INVALID_FROM`).
- `message`: İnsan tarafından okunabilir açıklama.
- `requestId`: Her isteğe özgü benzersiz kimlik (istek başlığındaki `X-Request-Id` veya sunucunun ürettiği UUID).
- `details`: (Opsiyonel) Hata ile ilgili ek alanlar; yalnızca mevcutsa döner.

## GET /usage

Tenant'ın mevcut faturalandırılabilir istek kullanımını döner.

### İstek

- **Yöntem:** `GET`
- **URL:** `/usage`
- **Kimlik doğrulama:** Zorunlu (oturum veya API anahtarı)
- **Sorgu parametreleri:** Yok

### Başlıklar

- `Authorization: Bearer <jwt>` (opsiyonel; oturum çerezi yoksa)
- `X-API-Key: <key>` (opsiyonel alternatif)
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (yanıtta; plan bazlı limitler)

### Başarılı Yanıt

- **Durum Kodu:** `200 OK`
- **Gövde:**

```
{
  "requests_used": 42
}
```

`requests_used` değeri, isteği yapan tenant'ın içinde bulunulan UTC ayındaki toplam doğrulama/stamp çağrılarının sayısını temsil eder.

### Hata Durumları

| Durum | Kod                         | Açıklama |
|-------|-----------------------------|----------|
| 401   | `AUTHENTICATION_REQUIRED`   | Kimlik doğrulaması eksik veya geçersiz. |
| 403   | `TENANT_MISSING`            | Oturum bağlamında tenant yok (koruyucu middleware'lerden gelebilir). |
| 429   | `READ_RATE_LIMIT_EXCEEDED`  | Planın GET oran sınırı aşıldı. |
| 500   | `TENANT_RESOLUTION_FAILED`  | Tenant bağlamı çözülemedi (iç hata). |
| 500   | `READ_RATE_LIMIT_FAILURE`   | Okuma oranı sınırlayıcısı kullanılamıyor (geçici hata). |

Tüm hata yanıtları standart hata şemasını kullanır.

## GET /analytics

Tenant'ın API etkinliklerini toplu olarak raporlar. Yanıt, `api_events` tablosuna işlenen telemetriyi temel alır.

### İstek

- **Yöntem:** `GET`
- **URL:** `/analytics`
- **Kimlik doğrulama:** Zorunlu

### Sorgu Parametreleri

| Ad         | Tip    | Zorunlu | Açıklama |
|------------|--------|---------|----------|
| `tenantId` | `TEXT` | Hayır   | Oturum tenant'ı dışında bir tenant sorgulanacaksa belirtilir. Sadece kendi tenant'ınızı sorgulayabilirsiniz; aksi halde `403 TENANT_MISMATCH`. |
| `from`     | `ISO-8601 tarih/zaman` | Hayır | Raporun başlangıç zamanı. Yoksa varsayılan olarak `to` değerinden geriye 30 gün alınır. `startDate` ile eşdeğerdir. |
| `to`       | `ISO-8601 tarih/zaman` | Hayır | Raporun bitiş zamanı (dahil). Yoksa şu an kullanılır. `endDate` ile eşdeğerdir. |
| `groupBy`  | `STRING` (`hour` \| `day`) | Hayır | Zaman kovası granülerliği; varsayılan `day`. |

> Not: `from` ve `to` parametreleri `Date` yapıcı ile ayrıştırılır; geçersiz biçimler `400 INVALID_FROM` veya `400 INVALID_TO` hatasıyla reddedilir. `from` > `to` olduğunda `400 INVALID_RANGE` döner.

### Başarılı Yanıt

- **Durum Kodu:** `200 OK`
- **Gövde:**

```
{
  "totals": [
    {
      "bucket": "2024-10-01T00:00:00.000Z",
      "total": 120,
      "success": 110,
      "errors": {
        "4xx": 8,
        "5xx": 2
      },
      "successRate": 0.9167
    }
  ],
  "successRate": 0.925,
  "errors": {
    "4xx": 20,
    "5xx": 5
  },
  "latency": {
    "avg": 235.4,
    "p95": 980.1
  },
  "topEndpoints": [
    { "endpoint": "/verify", "count": 240 },
    { "endpoint": "/stamp", "count": 56 }
  ]
}
```

Alanlar:

- `totals`: Her zaman kovası için özet istatistikler. `bucket` ISO-8601 zaman damgasıdır.
- `successRate`: Tüm dönem için genel başarı oranı (`success / total`). Başarılı çağrı yoksa `0` döner.
- `errors`: Genel 4xx ve 5xx sayıları.
- `latency`: `api_events.metadata.duration_ms` alanından hesaplanan ortalama (`avg`) ve %95 dilim (`p95`) gecikme değerleri. Veri yoksa `null` döner.
- `topEndpoints`: En sık çağrılan 5 normalleştirilmiş uç nokta ve çağrı sayıları.

### Hata Durumları

| Durum | Kod                          | Açıklama |
|-------|------------------------------|----------|
| 400   | `TENANT_REQUIRED`            | Oturumda tenant yok ve `tenantId` sağlanmadı. |
| 400   | `INVALID_GROUP_BY`           | `groupBy` parametresi `hour`/`day` dışında. |
| 400   | `INVALID_FROM`               | `from` veya `startDate` parse edilemedi. |
| 400   | `INVALID_TO`                 | `to` veya `endDate` parse edilemedi. |
| 400   | `INVALID_RANGE`              | `from` değeri `to` değerinden büyük. |
| 403   | `TENANT_MISMATCH`            | Oturum tenant'ı dışında bir tenant talep edildi. |
| 401   | `AUTHENTICATION_REQUIRED`    | Kimlik doğrulaması yok. |
| 429   | `READ_RATE_LIMIT_EXCEEDED`   | Okuma oran sınırı aşıldı. |
| 500   | `TENANT_RESOLUTION_FAILED`   | Tenant bağlamı çözülemedi (iç hata). |
| 500   | `ANALYTICS_FETCH_FAILED`     | Analitik verileri alınırken beklenmeyen hata. |
| 500   | `READ_RATE_LIMIT_FAILURE`    | Okuma oranı sınırlayıcısı başarısız oldu. |

Tüm hata gövdeleri standart hata şemasını izler.

## Örnek Başlıklar

Başarılı GET isteklerinde sunucu aşağıdaki başlıkları dönebilir:

- `X-Request-Id`: İsteğe ait benzersiz kimlik.
- `X-RateLimit-Limit`: Planın dakika başına izin verdiği GET isteği sayısı (tenant planından alınır).
- `X-RateLimit-Remaining`: Oran penceresindeki kalan GET isteği sayısı.
- `X-RateLimit-Reset`: Oran penceresinin saniye cinsinden yenileneceği Unix zamanı.
- `Retry-After`: (Sadece oran sınırı aşıldığında) Kaç saniye sonra tekrar denenebileceği.

## Dosya Geçmişi

Bu sözleşme dosyası, VideoKit API deposundaki gerçek uygulama koduna dayanarak hazırlanmıştır ve güncel davranışı yansıtır.
