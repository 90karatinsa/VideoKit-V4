// Bu betik, VideoKit Node.js SDK'sının nasıl kullanılacağını gösterir.
// Çalıştırmadan önce:
// 1. SDK'yı projenize ekleyin: npm install @videokit/sdk-js
// 2. Aşağıdaki ortam değişkenlerini ayarlayın:
//    export VIDEOKIT_API_KEY="YOUR_API_KEY_HERE"
//    export VIDEO_FILE_PATH="/path/to/your/video.mp4"

import { VideoKit, VideoKitError } from '@videokit/sdk-js';
import { fileURLToPath } from 'url';
import path from 'path';

// ES Modüllerinde __dirname eşdeğeri
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const apiKey = process.env.VIDEOKIT_API_KEY;
  let filePath = process.env.VIDEO_FILE_PATH;

  if (!apiKey) {
    console.error('Hata: Lütfen VIDEOKIT_API_KEY ortam değişkenini ayarlayın.');
    process.exit(1);
  }

  // Eğer dosya yolu belirtilmemişse, örnek bir dosya yolu kullan
  // Bu, test için kolaylık sağlar. Gerçek kullanımda yolu dışarıdan almalısınız.
  if (!filePath) {
      console.warn('Uyarı: VIDEO_FILE_PATH ortam değişkeni ayarlanmamış. Örnek bir dosya yolu varsayılıyor.');
      console.warn('Lütfen bu yolu kendi video dosyanızla değiştirin.');
      filePath = path.join(__dirname, '..', '..', 'sample-video.mp4'); // Ana proje dizinindeki örnek videoyu varsayalım
  }
  
  console.log(`VideoKit SDK başlatılıyor...`);
  console.log(`Video dosyası doğrulanıyor: ${filePath}`);

  // VideoKit istemcisini başlat
  // Yerel bir API sunucusu için baseUrl parametresini geçebilirsiniz:
  // const videokit = new VideoKit({ apiKey, baseUrl: 'http://localhost:3000' });
  const videokit = new VideoKit({ apiKey });

  try {
    // `waitForResult: true` SDK'nın iş tamamlanana kadar beklemesini sağlar.
    // Bu, çoğu komut satırı veya betik uygulaması için en kullanışlı yöntemdir.
    const result = await videokit.verify(filePath, { waitForResult: true });

    console.log('\n--- Doğrulama Sonucu ---');
    console.log(`İş ID: ${result.jobId}`);
    console.log(`Durum: ${result.state}`);
    
    if (result.state === 'completed' && result.result) {
        console.log(`Karar: ${result.result.verdict}`);
        console.log(`Mesaj: "${result.result.message}"`);
    } else if (result.state === 'failed') {
        console.error(`Hata: ${result.error}`);
    }

    console.log('\nİşlem başarıyla tamamlandı.');

  } catch (error) {
    console.error('\n--- Bir Hata Oluştu ---');
    if (error instanceof VideoKitError) {
      console.error(`HTTP Durumu: ${error.status}`);
      console.error(`API Mesajı: ${error.message}`);
      console.error('API Yanıtı:', JSON.stringify(error.responseBody, null, 2));
    } else {
      console.error('Beklenmedik bir hata:', error.message);
    }
    process.exit(1);
  }
}

main();