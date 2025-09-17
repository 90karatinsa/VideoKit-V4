# VideoKit - Resmi Node.js SDK

VideoKit REST API'si ile etkileşim kurmak için resmi TypeScript/Node.js istemci kütüphanesi.

## Kurulum

npm veya tercih ettiğiniz paket yöneticisini kullanarak paketi kurun:

```bash
npm install @videokit/sdk-js
Kullanım
İstemciyi Başlatma
SDK'yı projenize dahil edin ve API anahtarınızla bir istemci örneği oluşturun.

JavaScript

import { VideoKit } from '@videokit/sdk-js';

const apiKey = process.env.VIDEOKIT_API_KEY; // API anahtarınızı ortam değişkeninden okumanız önerilir

const videokit = new VideoKit({ apiKey });
Bir Videoyu Doğrulama
Bir videoyu doğrulamak için verify metodunu kullanabilirsiniz. Bu metot, varsayılan olarak API'den anında bir jobId alır.

Ancak, çoğu kullanım senaryosu için en pratik yöntem, waitForResult: true seçeneğini kullanarak SDK'nın doğrulama işlemi tamamlanana kadar beklemesini ve nihai sonucu döndürmesini sağlamaktır.

JavaScript

import { VideoKit, VideoKitError } from '@videokit/sdk-js';

async function verifyMyVideo(filePath) {
  const videokit = new VideoKit({ apiKey: process.env.VIDEOKIT_API_KEY });
  
  try {
    console.log(`Dosya doğrulanıyor: ${filePath}`);

    // waitForResult: true, işlemin sonucunu bekler ve tam Job nesnesini döndürür.
    const jobResult = await videokit.verify(filePath, { waitForResult: true });

    if (jobResult.state === 'completed') {
      console.log('Doğrulama başarılı!');
      console.log('Karar:', jobResult.result.verdict);
      console.log('Mesaj:', jobResult.result.message);
    } else {
      console.error('Doğrulama başarısız oldu:', jobResult.error);
    }

  } catch (error) {
    if (error instanceof VideoKitError) {
      // API'den gelen spesifik hataları yakala
      console.error(`API Hatası (HTTP ${error.status}):`, error.responseBody);
    } else {
      // Diğer hatalar (örn: dosya bulunamadı)
      console.error('Beklenmedik bir hata oluştu:', error.message);
    }
  }
}

// Örnek kullanım:
// verifyMyVideo('/path/to/your/video.mp4');
Örnek Kodu Çalıştırma
Proje içindeki examples/verify_video.js betiğini çalıştırarak SDK'yı test edebilirsiniz.

Gerekli bağımlılıkları yükleyin:

Bash

npm install
Ortam değişkenlerini ayarlayın:

Bash

export VIDEOKIT_API_KEY="YOUR_API_KEY_HERE"
export VIDEO_FILE_PATH="/path/to/your/video.mp4"
Örnek betiği çalıştırın:

Bash

node examples/verify_video.js
Bu komut, belirttiğiniz video dosyasını doğrulamak için API'ye bir istek gönderecek ve sonucu konsola yazdıracaktır.