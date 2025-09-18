# RTL Hazard Check

- **Direction switching eksikliği:** Dil seçiminde `document.documentElement.lang` güncelleniyor fakat `dir` niteliği yönetilmiyor. RTL locale eklendiğinde sayfa LTR kalacağından tüm grid/tablolar ve metin hizaları yanlış konumlanır. (app.js satır 6-38)
- **Navigasyon vurgusu sol kenara sabitli:** `.main-nav a::after` çizgisi `left: 0` ve `transform-origin: left` ile tanımlı; RTL'de altı çizgi metnin başlangıcı yerine sol uçtan açılır. (style.css satır 82-111)
- **Dashboard tablo hizası LTR sabitli:** `.activities-table` hücreleri `text-align: left` kullanıyor; RTL'de metin ve sayılar yanlış hizalanır. (style.css satır 571-588)
- **Toplu işlem tablosu hizası LTR sabitli:** Toplu işlem sayfasındaki `#file-list-table` hücreleri `text-align: left` ile sabit. RTL diller için sütun içeriği sola yaslanmaya devam eder. (batch.css satır 43-60)

files changed: reports/i18n/rtl-notes.md
