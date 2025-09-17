/**
 * Bu betik, e-posta gönderim servisinin yapılandırmasını ve çalışmasını test etmek için kullanılır.
 * * KULLANIM:
 * 1. Proje kök dizininde bir .env dosyası oluşturun ve aşağıdaki değişkenleri tanımlayın:
 * DATABASE_URL=... (geçerli bir postgres url olmalı, config'in çalışması için gerekli)
 * EMAIL_HOST=smtp.sendgrid.net
 * EMAIL_PORT=587
 * EMAIL_SECURE=false
 * EMAIL_USER=apikey
 * EMAIL_PASS=SENDGRID_API_ANAHTARINIZ
 * TEST_EMAIL_RECIPIENT=gonderilecek-test-adresi@example.com
 * * 2. Terminalden `npm run test:email` komutunu çalıştırın.
 */
import { initialize } from './config.js';
import { sendEmail } from './services/emailService.js';

async function runTest() {
  try {
    // Önce uygulamanın yapılandırmasını başlat
    await initialize();

    const recipient = process.env.TEST_EMAIL_RECIPIENT;
    if (!recipient) {
      throw new Error('Lütfen .env dosyasında TEST_EMAIL_RECIPIENT değişkenini ayarlayın.');
    }

    console.log(`Test e-postası gönderiliyor: ${recipient}`);

    // E-posta gönder
    await sendEmail(
      recipient,
      'VideoKit Test E-postası',
      '<h1>Merhaba!</h1><p>Bu, VideoKit platformundan gönderilen bir test e-postasıdır.</p>'
    );

    console.log('Test başarıyla tamamlandı.');
    process.exit(0);
  } catch (error) {
    console.error('Test sırasında bir hata oluştu:', error.message);
    process.exit(1);
  }
}

runTest();