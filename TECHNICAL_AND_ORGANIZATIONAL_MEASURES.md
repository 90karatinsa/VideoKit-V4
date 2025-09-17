# VideoKit - Teknik ve Organizasyonel Tedbirler (TOMs)

**Son Güncelleme:** 16 Eylül 2025

Bu belge, VideoKit'in müşteri verilerinin gizliliğini, bütünlüğünü ve erişilebilirliğini korumak amacıyla GDPR Madde 32 uyarınca aldığı teknik ve organizasyonel güvenlik tedbirlerini detaylandırmaktadır.

### 1. Bilgi Güvenliği Politikaları
* Şirket içinde tüm çalışanların uymakla yükümlü olduğu, veri sınıflandırma, kabul edilebilir kullanım, erişim kontrolü ve olay müdahalesi gibi konuları kapsayan kapsamlı bir bilgi güvenliği politikaları seti mevcuttur.
* Bu politikalar düzenli olarak gözden geçirilir ve güncellenir.

### 2. Erişim Kontrolü
* **Fiziksel Erişim Kontrolü:** Üretim altyapımız, biyometrik kontroller, 7/24 güvenlik personeli, video gözetimi ve izinsiz girişe karşı çok katmanlı koruma sağlayan lider bulut sağlayıcılarının (örn: AWS, GCP) veri merkezlerinde barındırılmaktadır. VideoKit personelinin bu veri merkezlerine fiziksel erişimi yoktur.
* **Sistem Erişim Kontrolü:**
    * Üretim sistemlerine erişim, "en az ayrıcalık" (least privilege) ilkesine göre, yalnızca görevi gereği yetkili olan personele, rol bazlı (RBAC) olarak verilir.
    * Tüm erişimler, merkezi bir kimlik yönetimi sistemi üzerinden yönetilir.
    * Tüm sunucu ve hizmetlere erişim, SSH anahtarları veya benzeri güvenli kimlik doğrulama yöntemleri ile sağlanır. Parola ile doğrudan erişim devre dışı bırakılmıştır.
    * Tüm yönetimsel erişimler için Çok Faktörlü Kimlik Doğrulama (MFA) zorunludur.

### 3. Şifreleme
* **Aktarım Halindeki Verilerin Şifrelenmesi (Encryption in Transit):** Müşteri portalı, API'ler ve tüm harici iletişim kanalları, güçlü ve güncel şifre paketleri ile yapılandırılmış TLS 1.2 ve üzeri protokollerle korunmaktadır.
* **Depolanan Verilerin Şifrelenmesi (Encryption at Rest):**
    * Müşteriler tarafından yüklenen video dosyaları ve diğer içerikler, depolandıkları nesne depolama (object storage) sistemlerinde AES-256 şifrelemesi ile korunur.
    * Veritabanları, önbellekler (Redis) ve yedeklemeler de dahil olmak üzere tüm depolama birimleri, endüstri standardı şifreleme ile korunmaktadır.

### 4. Veri Bütünlüğü ve Sistem Güvenliği
* **Ağ Güvenliği:** Üretim ortamımız, sanal özel bulut (VPC) içinde izole edilmiştir. Güvenlik grupları (security groups) ve ağ erişim kontrol listeleri (ACL'ler) ile ağ trafiği sıkı bir şekilde kısıtlanmıştır.
* **Yazılım Geliştirme Yaşam Döngüsü (SDLC):** Güvenlik, yazılım geliştirme sürecinin ayrılmaz bir parçasıdır. Kodlar, üretime alınmadan önce statik kod analizi (SAST) ve güvenlik taramalarından geçirilir.
* **Zafiyet Yönetimi:** İşletim sistemleri, kütüphaneler ve bağımlılıklar, bilinen zafiyetlere karşı düzenli olarak taranır. Kritik güvenlik yamaları en kısa sürede uygulanır.
* **Loglama ve İzleme:** Tüm sistem ve uygulama logları merkezi bir sistemde toplanır. Yetkisiz erişim denemeleri ve şüpheli aktiviteler için otomatik alarmlar ve izleme mekanizmaları mevcuttur.

### 5. Olay Yönetimi ve İş Sürekliliği
* **Güvenlik Olayı Müdahale Planı:** Potansiyel bir veri ihlali veya güvenlik olayını tespit etme, analiz etme, kontrol altına alma, ortadan kaldırma ve sonrasında iyileştirme adımlarını içeren resmi bir olay müdahale planımız bulunmaktadır.
* **Felaket Kurtarma ve Yedekleme:** Müşteri hesap verileri ve kritik sistem konfigürasyonları düzenli olarak yedeklenir. Altyapımız, yüksek erişilebilirlik sağlamak ve tek bir veri merkezindeki arızalardan etkilenmemek için birden fazla coğrafi bölgeye (multi-AZ) dağıtılmıştır.

### 6. Personel Güvenliği
* Tüm çalışanlar, işe başlamadan önce gizlilik sözleşmesi (NDA) imzalar.
* Tüm personel, görev ve sorumluluklarına uygun olarak düzenli aralıklarla bilgi güvenliği ve veri koruma eğitimleri alır.

### 7. Veri İmhası
* VideoKit'e doğrulama/mühürleme amacıyla gönderilen müşteri içerik verileri, işlem tamamlandıktan veya başarısız olduktan sonra en kısa süre içinde (genellikle 24 saat içinde) çalışan (worker) sistemlerimizden kalıcı olarak silinir.
* Müşteriler, sözleşme sona erdiğinde tüm hesap verilerinin ve API anahtarlarının platformumuzdan silinmesini talep edebilir.