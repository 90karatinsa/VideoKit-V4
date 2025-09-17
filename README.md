# VideoKit - CLI & REST API Sunucusu

Bu belge, VideoKit platformunun CLI (Komut Satırı Aracı) ve REST API sunucusunun nasıl kurulacağını ve kullanılacağını açıklar.

## 1. CLI Kurulumu ve Kullanımı

### Kurulum

**Homebrew (macOS):**
```bash
# (Gelecekte tap reposu oluşturulduğunda)
# brew tap YourOrg/homebrew-tap
# brew install videokit
Kurulum Betiği (Linux & macOS):

Bash

# Not: Bu betik, GitHub'da yayınlanmış ve imzalanmış release dosyalarını bekler.
curl -fsSL https://URL_TO_YOUR/install.sh | sh
CLI Komutları
vk verify <dosya>: Bir video dosyasını doğrular.

vk stamp <dosya> --author "Yazar Adı": Bir video için manifest oluşturur.

vk keygen: İmzalama için yeni anahtar ve sertifika oluşturur.

vk stream-capture <dosya>: Bir akışı yakalar ve segment bazlı manifest oluşturur.

vk config set/get/list: CLI ayarlarını yönetir.

vk klv to-json/from-json: KLV dosyalarını dönüştürür.

vk --version: Mevcut CLI sürümünü gösterir.

CLI'yı Güncelleme
CLI aracını en son sürüme güvenli bir şekilde güncellemek için aşağıdaki komutu kullanın. Bu komut, yeni sürümü GitHub'dan indirir, Sigstore ile kriptografik olarak doğrular ve mevcut sürümün üzerine yazar.

Bash

vk self-update
2. REST API Sunucusu
2.1. Ön Gereksinimler
Docker ve Docker Compose: Tüm servisleri (Redis, API, Worker, Prometheus, Grafana) çalıştırmak için gereklidir.

Node.js & npm: Bağımlılıkları yüklemek ve vk-cli.js gibi betikleri çalıştırmak için.

2.2. Ortam Değişkenleri (Environment Variables)
Uygulama, .env dosyasından veya doğrudan sistem ortam değişkenlerinden yapılandırılır. Bazı önemli değişkenler şunlardır:

VAULT_ADDR: HashiCorp Vault sunucusunun adresi.

VAULT_TOKEN: Vault'a erişim için token.

REDIS_URL: Redis bağlantı adresi (Vault'tan alınamazsa fallback olarak kullanılır).

LOG_LEVEL: Loglama seviyesi (örn: info, debug).

STORAGE_TTL_DAYS: Yüklenen geçici dosyaların (örn. logolar) kaç gün sonra otomatik olarak silineceğini belirler. Varsayılan değer 30'dur.

2.3. Kurulum ve Başlatma
Projenin ihtiyaç duyduğu tüm servisleri tek bir komutla başlatabilirsiniz.

Projenin kök dizininde aşağıdaki adımları izleyin:

1. İmzalama Anahtarlarını Oluşturun (Eğer Mevcut Değilse):
/stamp endpoint'i için bir özel anahtar (private.key) ve sertifika (public.pem) gereklidir.

Bash

# Proje kök dizinindeyken çalıştırın
./vk-cli.js keygen
2. Örnek Verileri Veritabanına Yükleyin:
API'yi test etmek için Redis veritabanına örnek müşteri ve API anahtarı verileri ekleyin.

Bash

node seed-db.js
3. Tüm Servisleri Başlatın:
Bu komut, docker-compose.yml dosyasındaki tüm servisleri (API, Worker, Redis, Prometheus, Grafana) ayağa kaldıracaktır.

Bash

docker-compose up --build
Servisler şu adreslerde erişilebilir olacaktır:

VideoKit API: http://localhost:3000

Prometheus UI: http://localhost:9090

Grafana UI: http://localhost:4000 (kullanıcı: admin, şifre: admin)

2.4. API Kullanımı
Tüm korumalı endpoint'lere istek gönderirken X-API-Key başlığını eklemeniz gerekmektedir. Örnek anahtarlar için seed-db.js betiğinin çıktısına bakınız.

POST /verify (Asenkron)
Bir video dosyasının C2PA manifestini doğrulamak için bir iş başlatır. API, anında bir iş ID'si döndürür.

Bu endpoint, iş tamamlandığında bildirim almak için iki ek form-data parametresi kabul eder:

webhookUrl: İşin sonucu POST edilecek olan URL.

webhookSecret: Webhook isteğini imzalamak için kullanılacak gizli anahtarınız.

curl Örneği (Webhook ile):

Bash

curl -X POST http://localhost:3000/verify \
  -H "X-API-Key: API_KEY_PRO_ALMOST_FULL" \
  -F "file=@/path/to/your/video.mp4" \
  -F "webhookUrl=[https://your-server.com/callback](https://your-server.com/callback)" \
  -F "webhookSecret=your-very-secret-key-123"
Anında Gelen Yanıt (202 Accepted):

JSON

{
  "jobId": "1" 
}
GET /jobs/{jobId}
Başlatılan bir işin durumunu ve sonucunu sorgular.

curl Örneği:

Bash

# Yukarıdaki yanıttan aldığınız jobId'yi kullanın
curl http://localhost:3000/jobs/1
İş Başarıyla Tamamlandığında Yanıt:

JSON

{
  "jobId": "1",
  "state": "completed",
  "result": {
    "verdict": "green",
    "message": "İmza ve sertifika zinciri başarıyla doğrulandı.",
    "file": { "name": "video.mp4" },
    ...
  }
}
Webhook Bildirimini Doğrulama
Eğer /verify isteğinde webhookUrl belirttiyseniz, iş tamamlandığında sunucunuz bu URL'ye bir POST isteği alacaktır. Güvenlik için, gelen isteğin gerçekten VideoKit'ten geldiğini doğrulamalısınız. Bu doğrulama X-Videokit-Signature başlığı ile yapılır.

Aşağıdaki Node.js/Express kodu, gelen webhook'un doğruluğunu nasıl kontrol edebileceğinizi gösterir:

JavaScript

const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = 'your-very-secret-key-123'; // Bu, VideoKit'e gönderdiğiniz sır ile aynı olmalı

// Express'in JSON body'sini string olarak da alabilmesi için özel bir middleware
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.post('/callback', (req, res) => {
  const receivedSignature = req.get('X-Videokit-Signature');
  
  if (!receivedSignature) {
    return res.status(400).send('İmza başlığı eksik.');
  }

  const calculatedSignature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody) // Ham, string olmayan body'yi kullan
    .digest('hex');

  if (crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(calculatedSignature))) {
    console.log('✅ İmza doğrulandı! İş sonucu:', req.body);
    // Burada kendi iş mantığınızı çalıştırın (örn: veritabanını güncelle)
    res.status(200).send('Alındı.');
  } else {
    console.error('❌ İmza geçersiz!');
    res.status(403).send('Geçersiz imza.');
  }
});

app.listen(8080, () => console.log('Webhook dinleyici sunucu http://localhost:8080 adresinde çalışıyor'));
POST /stamp
Bir video dosyası için manifest oluşturur, imzalar ve bir .c2pa yan dosyası olarak yanıt döner. Bu işlem senkron çalışır ve Idempotency-Key destekler.

curl Örneği:
Aşağıdaki komut, signed-video.c2pa adında bir dosya oluşturacaktır.

Bash

curl -X POST http://localhost:3000/stamp \
  -H "X-API-Key: API_KEY_PRO_ALMOST_FULL" \
  -H "Idempotency-Key: a-unique-key-for-this-request" \
  -F "file=@/path/to/your/video.mp4" \
  -F "author=VideoKit Product Team" \
  -o "signed-video.c2pa"
2.5. Kullanım ve Faturalandırma Endpoint'leri
Bu endpoint'ler, müşterilerin abonelik planları ve kullanımları hakkında bilgi almasını sağlar.

GET /usage

Bash

curl -H "X-API-Key: API_KEY_PRO_ALMOST_FULL" http://localhost:3000/usage
GET /quota

Bash

curl -H "X-API-Key: API_KEY_PRO_ALMOST_FULL" http://localhost:3000/quota
GET /billing

Bash

curl -H "X-API-Key: API_KEY_PRO_ALMOST_FULL" http://localhost:3000/billing
3. İzleme (Monitoring) ve Raporlama (SLA)
Platformun sağlığını, performansını ve SLA hedeflerine uygunluğunu izlemek için Prometheus ve Grafana tabanlı bir sistem kurulmuştur.

3.1. Mimarinin Bileşenleri
prom-client (Uygulama İçi): server.js içine entegre edilen bu kütüphane, /metrics adında bir endpoint oluşturur. Bu endpoint, uygulama metriklerini (istek sayısı, süreleri, hata oranları vb.) Prometheus'un okuyabileceği bir formatta sunar.

Prometheus (Harici Servis): api-server:3000/metrics endpoint'ini düzenli aralıklarla sorgulayarak (scraping) metrikleri toplar ve zaman serisi veritabanında saklar.

Grafana (Harici Servis): Prometheus'taki verileri kullanarak görsel dashboard'lar oluşturur. SLA takibi, anlık performans izleme ve uyarı (alerting) mekanizmaları Grafana üzerinden yapılandırılır.

3.2. SLA İzleme ve Uyarı (Alerting)
SLA Hedefleri: Yanıt süresi, hata oranı ve sistem erişilebilirliği gibi hedefler Grafana'da tanımlanır. Örneğin, "95. persentil yanıt süresinin son 5 dakikadır 200ms'yi aşması" gibi bir kural oluşturulabilir.

Uyarı Mekanizması: Tanımlanan kurallar ihlal edildiğinde, Grafana'nın uyarı (alerting) yöneticisi devreye girer. Bu yönetici, PagerDuty, Slack, E-posta gibi farklı kanallara bildirim gönderecek şekilde yapılandırılabilir. Bu konfigürasyon, Grafana arayüzü üzerinden yönetilir ve uygulama kodundan tamamen bağımsızdır.

3.3. Aylık Raporlama
Otomatik Raporlar: Grafana, belirli bir zaman aralığını (örneğin, geçen ay) kapsayan dashboard'ları PDF formatında dışa aktarma yeteneğine sahiptir. Grafana'nın raporlama özelliği kullanılarak veya Prometheus API'sini sorgulayan ayrı bir zamanlanmış betik (cron job) aracılığıyla, her ay sonunda müşterilere özel SLA performans raporları oluşturulup e-posta ile gönderilebilir. Bu süreç, operasyonel bir görev olup, temelini bizim kurduğumuz bu izleme altyapısı oluşturur.