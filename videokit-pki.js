import { VideoKitCore } from './videokit-core.js';

/**
 * Bir ArrayBuffer (DER formatı) verisini PEM formatına dönüştürür.
 * @param {ArrayBuffer} buffer - Dönüştürülecek buffer.
 * @param {string} label - PEM başlıklarında kullanılacak etiket (örn: 'CERTIFICATE').
 * @returns {string} PEM formatında dize.
 */
const _formatToPem = (buffer, label) => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
};

/**
 * Verilen bir CryptoKeyPair kullanarak kendinden imzalı bir X.509 sertifikası oluşturur.
 * @param {CryptoKeyPair} keyPair - Sertifikanın ait olacağı anahtar çifti.
 * @param {string} commonName - Sertifikanın CN (Common Name) alanı.
 * @returns {Promise<ArrayBuffer>} DER formatında sertifika verisi.
 */
const _createSelfSignedCertificate = async (keyPair, commonName) => {
  if (typeof pkijs === 'undefined' || typeof asn1js === 'undefined') {
    throw new Error("PKI işlemleri için PKI.js ve ASN1.js kütüphaneleri gereklidir.");
  }

  const certificate = new pkijs.Certificate();
  certificate.version = 2; // v3
  certificate.serialNumber = new asn1js.Integer({ value: Date.now() });

  // Sertifika sahibini (subject) ve yayıncısını (issuer) ayarla (kendinden imzalı olduğu için ikisi de aynı)
  const subjectAndIssuer = [
    new pkijs.AttributeTypeAndValue({ type: "2.5.4.3", value: new asn1js.PrintableString({ value: commonName }) })
  ];
  certificate.issuer.typesAndValues = subjectAndIssuer;
  certificate.subject.typesAndValues = subjectAndIssuer;

  // Geçerlilik süresini ayarla (şimdiki zamandan 1 yıl sonrasına kadar)
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 1);
  certificate.notBefore.value = notBefore;
  certificate.notAfter.value = notAfter;

  // Sertifika uzantılarını ayarla
  certificate.extensions = [];

  // Açık anahtarı sertifikaya ekle
  await certificate.subjectPublicKeyInfo.importKey(keyPair.publicKey);

  // Sertifikayı kendi özel anahtarı ile imzala
  await certificate.sign(keyPair.privateKey, "SHA-256");

  // Sertifikayı DER formatında döndür
  return certificate.toSchema().toBER(false);
};

const pkiProcessor = {
  /**
   * Tam anahtar devri (rollover) sürecini yönetir.
   * Bu fonksiyon, eski sertifikayı güvene alır, yeni bir anahtar çifti ve bu çifte ait
   * yeni bir kendinden imzalı sertifika oluşturur.
   * @param {Object} params - Parametreler.
   * @param {string} params.oldCertificatePem - Devredilecek mevcut aktif anahtarın PEM formatındaki sertifikası.
   * @param {string} [params.newCertCommonName='VideoKit Rollover Identity'] - Yeni oluşturulacak sertifika için CN.
   * @returns {Promise<{newCertificatePem: string, newFingerprint: string, newKeyPair: CryptoKeyPair}>}
   * Yeni sertifikanın PEM formatı, yeni anahtarın parmak izi ve yeni anahtar çiftini içeren nesne.
   */
  fullRolloverProcess: async ({ oldCertificatePem, newCertCommonName = 'VideoKit Rollover Identity' }) => {
    console.log('[PKI] Tam anahtar devri süreci başlatılıyor...');

    // 1. Core modülündeki temel rollover işlemini çağır.
    // Bu işlem eski sertifikayı güven listesine ekler ve yeni bir anahtar çifti oluşturur.
    const { newKeyPair, newFingerprint } = await VideoKitCore.security.keyManager.rollover(oldCertificatePem);
    console.log(`[PKI] Core rollover tamamlandı. Yeni anahtar parmak izi: ${newFingerprint}`);

    // 2. Yeni oluşturulan anahtar çifti için yeni bir kendinden imzalı sertifika oluştur.
    console.log('[PKI] Yeni anahtar çifti için kendinden imzalı sertifika oluşturuluyor...');
    const newCertDer = await _createSelfSignedCertificate(newKeyPair, newCertCommonName);
    const newCertificatePem = _formatToPem(newCertDer, 'CERTIFICATE');
    console.log('[PKI] Yeni sertifika başarıyla oluşturuldu ve PEM formatına çevrildi.');

    return {
      newCertificatePem,
      newFingerprint,
      newKeyPair // Çağıran tarafın özel anahtarı dışa aktarıp saklaması için
    };
  },
  
  /**
   * Bir CryptoKey (privateKey) nesnesini PKCS#8 PEM formatına dönüştürür.
   * @param {CryptoKey} privateKey - Dışa aktarılacak özel anahtar.
   * @returns {Promise<string>} PKCS#8 PEM formatında özel anahtar.
   */
  exportPrivateKey: async (privateKey) => {
    const pkcs8Buffer = await crypto.subtle.exportKey('pkcs8', privateKey);
    return _formatToPem(pkcs8Buffer, 'PRIVATE KEY');
  }
};

// Dışa aktarılacak ana nesne
export const VideoKitPKI = pkiProcessor;