import nodemailer from 'nodemailer';
import config from '../config.js';

let transporter;

/**
 * Nodemailer transporter'ını yapılandırma dosyasındaki bilgilere göre başlatır.
 * Bu fonksiyon, ilk e-posta gönderimi denendiğinde otomatik olarak çağrılır.
 */
function initializeEmailService() {
  // Servisin zaten başlatılıp başlatılmadığını kontrol et
  if (transporter) {
    return;
  }
  
  // Yapılandırmanın yüklendiğinden emin ol
  if (!config.isInitialized || !config.secrets.email?.host) {
    throw new Error('Email servisi başlatılamadı: Yapılandırma (config) henüz yüklenmemiş veya e-posta ayarları eksik.');
  }

  const { host, port, secure, user, pass } = config.secrets.email;

  console.log(`[EmailService] E-posta servisi başlatılıyor: ${host}:${port}`);

  transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure, // true for 465, false for other ports
    auth: {
      user: user, // örn: 'apikey' (SendGrid için) veya tam e-posta adresi
      pass: pass, // örn: SendGrid API anahtarı
    },
  });
}

/**
 * Belirtilen alıcıya, konuyla ve içerikle bir e-posta gönderir.
 * @param {string} to - Alıcının e-posta adresi.
 * @param {string} subject - E-postanın konusu.
 * @param {string} html - E-postanın HTML formatındaki içeriği.
 * @returns {Promise<object>} - Nodemailer'dan dönen bilgi nesnesi.
 */
export async function sendEmail(to, subject, html) {
  // Transporter başlatılmamışsa şimdi başlat
  if (!transporter) {
    initializeEmailService();
  }

  const mailOptions = {
    from: `"VideoKit Platform" <noreply@videokit.io>`, // Gönderici adresi
    to: to,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] E-posta başarıyla gönderildi. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[EmailService] E-posta gönderimi başarısız oldu:`, error);
    throw new Error('E-posta gönderimi sırasında bir hata oluştu.');
  }
}