# Frontend Doğrulaması — Kota Aşımı & Analitik Durumları

## Kota Aşımı Deneyimi
- Mock portalda oturum açıldığında faturalama servisi kota kalanını `0` döndürdüğü için üst bölümdeki uyarı bandı tetikleniyor ve API anahtarı oluşturma düğmesi devre dışı kalıyor. 【F:reports/final/assets/quota-network.json†L1-L9】
- Aşağıdaki ekran görüntüsü, hem uyarı bandını hem de devre dışı bırakılan "Yeni Anahtar Oluştur" düğmesini birlikte gösterir:  
  ![Quota aşıldığında oluşan uyarı bandı ve devre dışı düğme](assets/quota-exceeded.png)

## Analytics UI Durumları
Mock sunucu, `/analytics` isteğine verilen tarihe göre üç farklı görünüm döndürüyor; her bir durum için hem arayüz hem de ağ isteği doğrulandı.

### 1. Yükleniyor Ekranı
- Tarih filtresi değiştirildiğinde istek 2.8 saniyelik gecikme ile cevaplandığı için kart içinde "Yükleniyor" yer tutucusu beliriyor.
- `analytics-network.json` kaydında, `startDate=2024-01-05` parametresiyle `/analytics` çağrısının 200 yanıt aldığı görülebilir. 【F:reports/final/assets/analytics-network.json†L9-L15】
- İlgili görünüm:  
  ![Analytics kartı yüklenirken gösterilen yer tutucular](assets/analytics-loading.png)

### 2. Boş Sonuçlar
- `startDate=1999-01-02` gönderildiğinde API boş özet ve aktivite listesi döndürüyor; tablo "aktivite bulunamadı" mesajına geçiyor. 【F:reports/final/assets/analytics-network.json†L16-L25】
- Görsel doğrulama:  
  ![Veri bulunamadığında analytics kartı](assets/analytics-empty.png)

### 3. Hata Ekranı
- `startDate=1999-01-01` isteği mock sunucuda 500 hata tetikliyor; kart "Simulated analytics failure" mesajını ve boş istatistikleri gösteriyor. 【F:reports/final/assets/analytics-network.json†L26-L32】
- Görsel doğrulama:  
  ![Analytics kartının hata durumundaki görünümü](assets/analytics-error.png)
