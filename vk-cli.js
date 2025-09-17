#!/usr/bin/env node

import { program } from 'commander';
import c2pa from 'c2pa';
const { read, create, generateSigner, hashFile } = c2pa;
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// --- GÜNCELLEME İÇİN EKLENEN IMPORT'LAR ---
import { verify } from 'sigstore';
import semver from 'semver';
import fetch from 'node-fetch';
import { getSigner } from './videokit-signer.js';
import forge from 'node-forge';

// package.json'ı okumak için yardımcı
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf-8'));
const CURRENT_VERSION = packageJson.version;
const GITHUB_REPO = 'YourOrg/VideoKit'; // TODO: Bunu kendi GitHub repo adresinizle değiştirin.


// --- Konfigürasyon Yönetimi ---
const CONFIG_DIR = path.join(os.homedir(), '.videokit');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const configManager = {
  /** Yapılandırma dizininin mevcut olduğundan emin olur. */
  async ensureDir() {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  },

  /** Yapılandırma dosyasını okur, yoksa boş bir nesne döner. */
  async read() {
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // Dosya yoksa, boş konfigürasyonla başla.
      }
      throw error;
    }
  },

  /** Verilen yapılandırma nesnesini dosyaya yazar. */
  async write(config) {
    await this.ensureDir();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  },

  /**
   * Noktalı notasyonlu bir anahtarla (örn: "tsa.url")
   * iç içe bir nesnede değeri ayarlar.
   */
  set(config, key, value) {
    const keys = key.split('.');
    let current = config;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]];
    }
    // Değeri doğru tipe dönüştürmeye çalış
    if (value === 'true' || value === 'false') {
        current[keys[keys.length - 1]] = (value === 'true');
    } else if (!isNaN(value) && value.trim() !== '') {
        current[keys[keys.length - 1]] = Number(value);
    } else {
        current[keys[keys.length - 1]] = value;
    }
    return config;
  },
  
  /** Noktalı notasyonlu bir anahtarla değeri alır. */
  get(config, key) {
    return key.split('.').reduce((o, i) => o?.[i], config);
  }
};

// --- Telemetri Yönetimi ---
const TELEMETRY_ENDPOINT = 'https://telemetry.videokit.dev/v1/events';

const telemetryManager = {
  /** Telemetrinin kullanıcı tarafından etkinleştirilip etkinleştirilmediğini kontrol eder. */
  async isEnabled() {
    const config = await configManager.read();
    // Varsayılan olarak kapalıdır (false). Sadece açıkça `true` ise çalışır.
    return configManager.get(config, 'telemetry.enabled') === true;
  },

  /**
   * Bir komut kullanım olayını izler ve telemetri sunucusuna gönderir.
   * Bu fonksiyon, ana CLI akışını engellememek için "fire-and-forget" prensibiyle çalışır.
   * @param {string} command - Çalıştırılan komutun adı.
   * @param {number} duration - Komutun milisaniye cinsinden çalışma süresi.
   * @param {Error|null} error - Komut başarısız olduysa hata nesnesi.
   */
  async trackEvent(command, duration, error = null) {
    if (!(await this.isEnabled())) {
      return; // Telemetri devre dışıysa hiçbir şey yapma.
    }

    // Gizlilik odaklı, anonim veri paketi.
    // Kesinlikle dosya adı, yolu, içeriği veya kullanıcıya özgü bilgiler GÖNDERİLMEZ.
    const payload = {
      command,
      duration: Math.round(duration),
      success: !error,
      version: CURRENT_VERSION,
      os: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };

    // "Fire-and-forget": Ağ hatası veya sunucuya ulaşılamaması durumu
    // kullanıcının deneyimini etkilememelidir.
    fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000, // Zaman aşımı ekle
    }).catch(() => {
      // Hataları sessizce yoksay. Telemetri gönderilememesi, CLI'ın çökmesine neden olmamalı.
    });
  }
};


// --- Güvenilen Kök Sertifika (Trust Store) Yönetimi ---
const TRUST_STORE_DIR = path.join(CONFIG_DIR, 'trust_store');

const trustStoreManager = {
  /** Güvenilen sertifika dizininin mevcut olduğundan emin olur. */
  async ensureDir() {
    try {
      await fs.mkdir(TRUST_STORE_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  },

  /** Verilen yoldaki sertifikayı trust store'a ekler. */
  async add(certPath) {
    await this.ensureDir();
    const certContent = await fs.readFile(certPath); // Buffer olarak oku
    const fileName = path.basename(certPath);
    const destPath = path.join(TRUST_STORE_DIR, fileName);
    await fs.writeFile(destPath, certContent);
    return fileName;
  },

  /** Trust store'daki tüm sertifikaları listeler. */
  async list() {
    await this.ensureDir();
    const files = await fs.readdir(TRUST_STORE_DIR);
    const certsInfo = [];
    for (const file of files) {
      const certPath = path.join(TRUST_STORE_DIR, file);
      const certPem = await fs.readFile(certPath, 'utf-8');
      try {
        const cert = forge.pki.certificateFromPem(certPem);
        const subject = cert.subject.getField('CN')?.value || 'N/A';
        const issuer = cert.issuer.getField('CN')?.value || 'N/A';
        const expiry = cert.validity.notAfter.toISOString();
        certsInfo.push({ filename: file, subject, issuer, expiry });
      } catch (e) {
        certsInfo.push({ filename: file, subject: 'Parse Error', issuer: e.message, expiry: '' });
      }
    }
    return certsInfo;
  },

  /** Trust store'dan bir sertifikayı kaldırır. */
  async remove(filename) {
    const filePath = path.join(TRUST_STORE_DIR, filename);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false; // Dosya zaten yok
      throw error;
    }
  },

  /** Doğrulama için kullanılacak tüm trust anchor'ları Buffer dizisi olarak döner. */
  async getAnchors() {
    try {
      await this.ensureDir();
      const files = await fs.readdir(TRUST_STORE_DIR);
      const anchors = [];
      for (const file of files) {
        const certPath = path.join(TRUST_STORE_DIR, file);
        anchors.push(await fs.readFile(certPath));
      }
      return anchors;
    } catch (e) {
      return []; // Hata durumunda veya dizin yoksa boş döner.
    }
  }
};


// --- Medya Yardımcı Fonksiyonları ---

/**
 * Bir MP4/MOV dosyasının 'mvhd' atomundan medya oluşturma zamanını okur.
 * @param {string} filePath Medya dosyasının yolu.
 * @returns {Promise<Date|null>} Oluşturma zamanını içeren Date nesnesi veya bulunamazsa null.
 */
const getMp4CreationTime = async (filePath) => {
    let filehandle;
    try {
        filehandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(65536);
        const { bytesRead } = await filehandle.read(buffer, 0, 65536, 0);
        const searchBuffer = buffer.slice(0, bytesRead);
        const size = searchBuffer.length;
        
        const EPOCH_OFFSET = 2082844800;

        for (let i = 0; i < size - 8; i++) {
            const boxSize = searchBuffer.readUInt32BE(i);
            const boxType = searchBuffer.toString('ascii', i + 4, i + 8);
            
            if (boxType === 'moov' && boxSize > 8) {
                for (let j = i + 8; j < i + boxSize - 8; j++) {
                    const innerSize = searchBuffer.readUInt32BE(j);
                    const innerType = searchBuffer.toString('ascii', j + 4, j + 8);

                    if (innerType === 'mvhd' && innerSize > 20) {
                        const version = searchBuffer.readUInt8(j + 8);
                        let timeOffset = j + 8 + 4;
                        
                        let creationTime;
                        if (version === 1) {
                            creationTime = searchBuffer.readBigUInt64BE(timeOffset);
                        } else {
                            creationTime = searchBuffer.readUInt32BE(timeOffset);
                        }
                        
                        if (creationTime > EPOCH_OFFSET) {
                            const jsTimestamp = (Number(creationTime) - EPOCH_OFFSET) * 1000;
                            return new Date(jsTimestamp);
                        }
                    }
                     if (innerSize === 0 || j + innerSize > i + boxSize) break;
                     j += innerSize - 1;
                }
            }
            if (boxSize === 0 || i + boxSize > size) break;
            i += boxSize - 1;
        }
        return null;
    } finally {
        await filehandle?.close();
    }
};


// --- KLV İşleme Mantığı ---
const klvProcessor = {
  /**
   * MISB standartlarına uygun CRC-16/CCITT-FALSE sağlama toplamını hesaplar.
   * @param {Uint8Array} buffer Hesaplanacak veri.
   * @returns {number} 16-bit CRC değeri.
   */
  crc16: (buffer) => {
      let crc = 0xFFFF;
      for (const byte of buffer) {
          crc ^= byte << 8;
          for (let i = 0; i < 8; i++) {
              crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
          }
      }
      return crc & 0xFFFF;
  },

  writeBerLength: (len) => {
    if (len < 0x80) return Uint8Array.of(len);
    const bytes = []; let n = len;
    while (n > 0){ bytes.unshift(n & 0xff); n >>= 8; }
    return Uint8Array.of(0x80 | bytes.length, ...bytes);
  },

  readBerLength: (view, offset) => {
    const first = view[offset]; if (first < 0x80) return [first, 1];
    const numBytes = first & 0x7f;
    if (offset + 1 + numBytes > view.length) throw new Error("BER length extends beyond buffer");
    let len = 0;
    for(let i=0; i<numBytes; i++){ len = (len * 256) + view[offset + 1 + i]; }
    return [len, 1 + numBytes];
  },

  jsonToBuffer: (obj, version, addChecksum = true) => {
    if (!obj['65']) obj['65'] = parseInt(version, 10);
    const chunks = [];
    const keys = Object.keys(obj).filter(k => /^\d+$/.test(k) && k !== '1');
    
    if (keys.includes('2')) {
        processTag('2', obj['2']);
    }
    keys.filter(k => k !== '2').sort((a,b) => Number(a) - Number(b)).forEach(key => processTag(key, obj[key]));

    function processTag(tagStr, val) {
        const tag = Number(tagStr); let valBuf;
        if (tag === 2){
          valBuf = new Uint8Array(8); new DataView(valBuf.buffer).setBigUint64(0, BigInt(val), false);
        } else if (tag === 13 || tag === 14){
          const scaled = Math.round((val / (tag===13?90:180)) * 2147483647);
          valBuf = new Uint8Array(4); new DataView(valBuf.buffer).setInt32(0, scaled, false);
        } else if (tag === 15) {
          const scaled = Math.round(((val - (-900)) / 19900) * 65535);
          valBuf = new Uint8Array(2); new DataView(valBuf.buffer).setUint16(0, scaled, false);
        } else if (tag === 65) {
          valBuf = new Uint8Array([val]);
        } else if (typeof val === 'string') {
          valBuf = new TextEncoder().encode(val);
        } else if (typeof val === 'number') {
            const dv = new DataView(new ArrayBuffer(2));
            dv.setUint16(0, Math.round(val * (65535 / 360.0)), false);
            valBuf = new Uint8Array(dv.buffer);
        } else return;
        chunks.push(Uint8Array.of(tag), klvProcessor.writeBerLength(valBuf.length), valBuf);
    }

    let payload = new Uint8Array(chunks.reduce((s,a)=>s+a.length, 0));
    let off=0; chunks.forEach(a => { payload.set(a, off); off+=a.length; });

    const ul = Uint8Array.from([0x06,0x0E,0x2B,0x34,0x02,0x0B,0x01,0x01,0x0E,0x01,0x03,0x01,0x01,0x00,0x00,0x00]);

    if (addChecksum) {
      const lenBytesTemp = klvProcessor.writeBerLength(payload.length + 4);
      const tempPacketForCrc = new Uint8Array(ul.length + lenBytesTemp.length + payload.length);
      tempPacketForCrc.set(ul);
      tempPacketForCrc.set(lenBytesTemp, ul.length);
      tempPacketForCrc.set(payload, ul.length + lenBytesTemp.length);

      const checksum = klvProcessor.crc16(tempPacketForCrc);
      
      const checksumChunk = new Uint8Array(4);
      checksumChunk[0] = 1; // Tag
      checksumChunk[1] = 2; // Length
      new DataView(checksumChunk.buffer).setUint16(2, checksum, false);

      const finalPayload = new Uint8Array(payload.length + checksumChunk.length);
      finalPayload.set(payload);
      finalPayload.set(checksumChunk, payload.length);
      payload = finalPayload;
    }

    const lenBytes = klvProcessor.writeBerLength(payload.length);
    const out = new Uint8Array(ul.length + lenBytes.length + payload.length);
    out.set(ul); out.set(lenBytes, ul.length); out.set(payload, ul.length + lenBytes.length);
    return Buffer.from(out.buffer);
  },

  bufferToJson: (buf) => {
    const view = new Uint8Array(buf);
    const result = {};
    let offset = 0;

    const ul = [0x06,0x0E,0x2B,0x34,0x02,0x0B,0x01,0x01,0x0E,0x01,0x03,0x01,0x01,0x00,0x00,0x00];
    if (view.length < 16 || !ul.every((b,i) => view[i] === b)) {
        throw new Error("Geçersiz KLV paketi: MISB ST 0601 UL (Universal Label) bulunamadı.");
    }
    offset = 16;
    
    const [packetLen, lenConsumed] = klvProcessor.readBerLength(view, offset);
    offset += lenConsumed;
    const payloadEnd = offset + packetLen;
    const payloadView = view.subarray(offset, payloadEnd);
    
    let p = 0;
    while(p < payloadView.length) {
        const tag = payloadView[p];
        if (p + 1 >= payloadView.length) break;

        const [len, consumed] = klvProcessor.readBerLength(payloadView, p + 1);
        const valueStart = p + 1 + consumed;
        if (valueStart + len > payloadView.length) break;

        const slice = payloadView.subarray(valueStart, valueStart + len);
        let value;
        const dv = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);

        if (tag === 1 && slice.byteLength === 2) {
            value = dv.getUint16(0, false);
        } else if (tag === 2 && slice.byteLength === 8){
          const micros = dv.getBigUint64(0, false); value = micros.toString();
        } else if ((tag === 13 || tag === 14) && slice.byteLength === 4){
          value = (dv.getInt32(0, false) / 2147483647) * (tag === 13 ? 90 : 180);
        } else if (tag === 15 && slice.byteLength === 2) {
          value = (dv.getUint16(0, false) / 65535) * 19900 - 900;
        } else if (tag === 65 && slice.byteLength === 1) {
          value = dv.getUint8(0);
        } else if (tag === 5 && slice.byteLength === 2) {
          value = dv.getUint16(0, false) * (360.0 / 65535);
        } else {
          value = new TextDecoder('utf-8', { fatal:false }).decode(slice);
        }

        if(value !== undefined) result[String(tag)] = value;
        p += 1 + consumed + len;
    }
    return result;
  }
};


/**
 * C2PA doğrulama sonucundan basitleştirilmiş bir karar metni üretir.
 */
function getVerdict(result) {
  if (!result || !result.manifestStore) {
    return '❌ Manifest bulunamadı veya dosya okunamadı.';
  }
  const manifest = result.manifestStore.activeManifest;
  if (!manifest) {
    return '❌ Aktif manifest bulunamadı.';
  }
  const validationStatus = manifest.validationStatus || [];

  // İptal durumunu öncelikli olarak kontrol et
  const isRevoked = validationStatus.some(s => s.code.includes('revoked'));
  if (isRevoked) {
    const revokedStatus = validationStatus.find(s => s.code.includes('revoked'));
    return `❌ Sertifika İptal Edilmiş: ${revokedStatus?.explanation || revokedStatus?.code}`;
  }

  const hasError = validationStatus.some(s => s.code.includes('error') || s.code.includes('invalid') || s.code.includes('mismatch'));
  if (hasError) {
    const error = validationStatus.find(s => s.code.includes('error') || s.code.includes('invalid') || s.code.includes('mismatch'));
    return `❌ Doğrulama Hatası: ${error?.explanation || error?.code}`;
  }
  const hasUntrusted = validationStatus.some(s => s.code.includes('untrusted'));
  if (hasUntrusted) {
    return '⚠️ İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.';
  }
  const hasSignature = validationStatus.some(s => s.code.includes('signature.validated'));
  if (hasSignature) {
    return '✅ İmza ve zincir geçerli.';
  }
  return 'ℹ️ Manifest doğrulandı, ancak tam bir imza zinciri bulunamadı.';
}

program
  .name('vk')
  .description('VideoKit İçerik Güvenilirliği Platformu CLI')
  .version(CURRENT_VERSION, '-v, --version', 'Mevcut sürümü göster');

program
  .command('self-update')
  .description('VideoKit CLI aracını en son sürüme güvenli bir şekilde günceller.')
  .action(async () => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log(`Mevcut sürüm: ${CURRENT_VERSION}`);
        console.log('En son sürüm kontrol ediliyor...');

        let tempDir = '';
        try {
            const releaseUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
            const res = await fetch(releaseUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
            if (!res.ok) throw new Error(`GitHub API'sinden sürüm bilgisi alınamadı. Durum: ${res.status}`);
            
            const release = await res.json();
            const latestVersion = release.tag_name.replace('v', '');

            if (!semver.gt(latestVersion, CURRENT_VERSION)) {
                console.log('✅ VideoKit CLI zaten en güncel sürümde.');
                return;
            }
            console.log(`Yeni sürüm bulundu: ${latestVersion}. Güncelleme başlatılıyor...`);

            const platform = `${os.platform()}-${os.arch()}`;
            const artifactName = `videokit-cli-${platform}`;
            
            const artifact = release.assets.find(a => a.name === artifactName);
            const signature = release.assets.find(a => a.name === `${artifactName}.sig`);
            const certificate = release.assets.find(a => a.name === `${artifactName}.pem`);

            if (!artifact || !signature || !certificate) {
                throw new Error(`Platformunuz (${platform}) için gerekli güncelleme dosyaları bulunamadı.`);
            }

            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videokit-update-'));
            const artifactPath = path.join(tempDir, artifactName);
            const signaturePath = path.join(tempDir, `${artifactName}.sig`);
            const certificatePath = path.join(tempDir, `${artifactName}.pem`);
            
            console.log('Güncelleme dosyaları indiriliyor...');
            await downloadFile(artifact.browser_download_url, artifactPath);
            await downloadFile(signature.browser_download_url, signaturePath);
            await downloadFile(certificate.browser_download_url, certificatePath);

            console.log('İmza doğrulanıyor...');
            const sigstoreOptions = {
                certificateIdentity: 'https://github.com/actions/runner',
                certificateOidcIssuer: 'https://token.actions.githubusercontent.com'
            };

            await verify({
                artifactPath: artifactPath,
                signaturePath: signaturePath,
                certificatePath: certificatePath,
                identity: sigstoreOptions.certificateIdentity,
                issuer: sigstoreOptions.certificateOidcIssuer,
            });
            
            console.log('✅ Güvenlik doğrulaması başarılı!');

            const currentExecPath = fileURLToPath(import.meta.url);
            console.log(`Eski dosya (${currentExecPath}) yenisiyle değiştiriliyor...`);

            await fs.chmod(artifactPath, 0o755);
            await fs.rename(artifactPath, currentExecPath);

            console.log(`✨ VideoKit CLI başarıyla ${latestVersion} sürümüne güncellendi!`);

        } catch (e) {
            error = e; // Hatayı yakala
            if (e.name === 'SigstoreVerificationError') {
                 console.error('❌ HATA: Güncelleme iptal edildi. Güvenlik doğrulaması başarısız!');
            } else {
                console.error(`❌ HATA: Güncelleme sırasında bir sorun oluştu: ${e.message}`);
            }
            process.exit(1);
        } finally {
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        }
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('self-update', duration, error);
    }
  });

program
  .command('verify <filePath>')
  .description('Bir video dosyasındaki C2PA manifestini doğrular.')
  .action(async (filePath) => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log(`🔍 ${path.basename(filePath)} doğrulanıyor...`);
        const fileBuffer = await fs.readFile(filePath);
        const trustAnchors = await trustStoreManager.getAnchors();
        if (trustAnchors.length > 0) {
            console.log(`ℹ️  Trust store'dan ${trustAnchors.length} adet ek kök sertifika kullanılıyor.`);
        }
        console.log(`ℹ️  Çevrimiçi iptal kontrolü (OCSP/CRL) etkinleştirildi.`);
        const result = await read(fileBuffer, { trustAnchors, online: true });
        const verdict = getVerdict(result);
        console.log(verdict);
    } catch (e) {
        error = e;
        console.error(`Hata: ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('verify', duration, error);
    }
  });

program
  .command('stamp <filePath>')
  .description('Bir video dosyası için .c2pa sidecar manifesti oluşturur.')
  .requiredOption('-a, --author <name>', 'Manifeste eklenecek yazar adı (Creator)')
  .option('-s, --agent <name>', 'Kullanan yazılım bilgisi', 'VideoKit CLI v1.0')
  .option('--tsa-url <url>', 'Kullanılacak Zaman Damgası Yetkilisi (TSA) sunucusu')
  .option('--capture-only', 'Sadece son 24 saat içinde oluşturulmuş videoları mühürler.')
  .action(async (filePath, options) => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log(`✒️  ${path.basename(filePath)} için manifest oluşturuluyor...`);
        // Post-hoc Mühür Güvenlik Kilidi Politikası
        if (options.captureOnly) {
            console.log('Güvenlik Kilidi aktif: Video oluşturma tarihi kontrol ediliyor...');
            const creationTime = await getMp4CreationTime(filePath);
            if (creationTime) {
                const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
                if (creationTime.getTime() < twentyFourHoursAgo) {
                    throw new Error(
                        `Politika İhlali: Video, 24 saatten daha eski olduğu için mühürlenemez. (Oluşturma: ${creationTime.toISOString()})`
                    );
                }
                console.log('✅ Video oluşturma tarihi politikaya uygun.');
            } else {
                console.log('⚠️  Video oluşturma tarihi metaveriden okunamadı, politikayı es geçiliyor.');
            }
        }

        const config = await configManager.read();
        const assetBuffer = await fs.readFile(filePath);
        const tsaUrl = options.tsaUrl || config.tsa?.url;
        
        const signer = await getSigner(config);

        const manifest = {
            claimGenerator: options.agent,
            assertions: [
            { label: 'stds.schema-org.CreativeWork', data: { author: [{ '@type': 'Person', name: options.author }] } },
            ],
        };
        
        const createConfig = {
            manifest,
            asset: { buffer: assetBuffer, mimeType: 'video/mp4' },
            signer: signer
        };

        if (tsaUrl) {
            createConfig.signer.tsaUrl = tsaUrl;
            console.log(`Zaman damgası için kullanılıyor: ${tsaUrl}`);
        }

        const { sidecar } = await create(createConfig);
        const baseName = filePath.substring(0, filePath.lastIndexOf('.'));
        const sidecarPath = `${baseName}.c2pa`;

        await fs.writeFile(sidecarPath, sidecar);
        console.log(`✅ Başarılı! Sidecar dosyası şuraya kaydedildi: ${sidecarPath}`);
    } catch (e) {
        error = e;
        if (e.code === 'ENOENT') {
            console.error(`Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.`);
            console.error(`Lütfen 'vk keygen' komutunu çalıştırın veya 'vk config set' ile doğru dosya yollarını belirtin.`);
        } else {
            console.error(`❌ Hata: ${e.message}`);
        }
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('stamp', duration, error);
    }
  });

program
  .command('keygen')
  .description(`İmzalama için bir özel anahtar ve kendinden imzalı sertifika oluşturur.`)
  .action(async () => {
    const startTime = performance.now();
    let error = null;
    try {
        const privateKeyFile = 'private.key';
        const certificateFile = 'public.pem';

        console.log('Anahtar çifti ve sertifika oluşturuluyor...');
        const { privateKey, certificate } = await generateSigner();
        await fs.writeFile(privateKeyFile, privateKey);
        await fs.writeFile(certificateFile, certificate);
        console.log(`✅ Başarılı! Dosyalar oluşturuldu: ${privateKeyFile}, ${certificateFile}`);
        
        const config = await configManager.read();
        configManager.set(config, 'key.private', privateKeyFile);
        configManager.set(config, 'key.public', certificateFile);
        await configManager.write(config);
        console.log(`✅ Ayarlar varsayılan olarak yapılandırma dosyasına kaydedildi.`);

        console.log(`⚠️  Bu kendinden imzalı bir sertifikadır ve doğrulama sırasında 'güvenilmeyen kök' uyarısı verecektir.`);
    } catch (e) {
        error = e;
        console.error(`Hata: ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('keygen', duration, error);
    }
  });

program
  .command('stream-capture <inputFile>')
  .description('Bir video akışını (dosyadan simüle edilmiş) yakalar, segmentler ve C2PA manifesti oluşturur.')
  .option('--tamper', 'Doğrulama testi için akış sırasında rastgele bir segmenti bozar.')
  .option('--seg-duration <seconds>', 'Her bir video segmentinin süresi (saniye).', '2')
  .action(async (inputFile, options) => {
    const startTime = performance.now();
    let error = null;
    let tempDir = '';
    try {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videokit-stream-'));
        console.log(`[1/5] Geçici segment dizini oluşturuldu: ${tempDir}`);

        console.log(`[2/5] FFmpeg ile akış simülasyonu başlatılıyor...`);
        const segmentPaths = await processStream(inputFile, tempDir, options.segDuration, options.tamper);
        console.log(`...Akış tamamlandı. Toplam ${segmentPaths.length} segment yakalandı.`);

        console.log('[3/5] Segment hashleri hesaplanıyor ve C2PA manifesti oluşturuluyor...');
        const manifestPath = path.join(process.cwd(), 'stream-manifest.c2pa');
        await createStreamManifest(segmentPaths, manifestPath);
        console.log(`...Manifest oluşturuldu: ${manifestPath}`);

        console.log('[4/5] Oluşturulan manifest, diskteki segmentlere karşı doğrulanıyor...');
        const manifestBuffer = await fs.readFile(manifestPath);
        const result = await read(manifestBuffer, { ingredientLookup: tempDir, online: true });
        const verdict = getVerdict(result);
        
        console.log('\n--- DOĞRULAMA SONUCU ---');
        console.log(verdict);
        if (options.tamper && verdict.includes('mismatch')) {
            console.log('✅ TEST BAŞARILI: Sabote edilen segment doğru bir şekilde tespit edildi!');
        } else if (options.tamper) {
            console.log('❌ TEST BAŞARISIZ: Sabote edilen segment tespit edilemedi!');
        }
        console.log('------------------------\n');

    } catch (e) {
        error = e;
        console.error(`\nHata oluştu: ${e.message}`);
        process.exit(1);
    } finally {
        if (tempDir) {
            console.log('[5/5] Geçici dosyalar temizleniyor...');
            await fs.rm(tempDir, { recursive: true, force: true });
            console.log('...Temizlik tamamlandı.');
        }
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('stream-capture', duration, error);
    }
  });


async function processStream(inputFile, outputDir, segDuration, shouldTamper) {
  return new Promise((resolve, reject) => {
    const segmentTemplate = path.join(outputDir, 'segment%03d.ts');
    const args = ['-re','-i', inputFile,'-c:v', 'copy','-c:a', 'copy','-f', 'segment','-segment_time', segDuration,'-segment_format', 'mpegts','-reset_timestamps', '1',segmentTemplate];
    const ffmpeg = spawn('ffmpeg', args);
    const capturedSegments = new Set();
    
    const watcher = fs.watch(outputDir, (eventType, filename) => {
      if (eventType === 'rename' && filename.endsWith('.ts') && !capturedSegments.has(filename)) {
        const fullPath = path.join(outputDir, filename);
        console.log(` -> Yeni segment yakalandı: ${filename}`);
        capturedSegments.add(filename);

        if (shouldTamper && capturedSegments.size === 3) {
            console.log(`   🔥 SABOTAJ: ${filename} dosyası bozuluyor...`);
            fs.appendFile(fullPath, 'TAMPERED_DATA');
        }
      }
    });

    ffmpeg.on('close', (code) => {
      watcher.close();
      if (code !== 0) return reject(new Error(`FFmpeg işlemi ${code} koduyla sonlandı.`));
      const sortedSegments = Array.from(capturedSegments).sort();
      resolve(sortedSegments.map(f => path.join(outputDir, f)));
    });

    ffmpeg.on('error', (err) => {
      watcher.close();
      reject(new Error(`FFmpeg başlatılamadı: ${err.message}. FFmpeg'in sisteminizde kurulu ve PATH içinde olduğundan emin olun.`));
    });
  });
}

async function createStreamManifest(segmentPaths, manifestOutputPath) {
    const ingredients = [];
    for (const segPath of segmentPaths) {
        const hash = await hashFile(segPath);
        ingredients.push({ url: `file://${segPath}`, relationship: 'parentOf', hash: hash });
    }

    const manifest = {
        claimGenerator: 'VideoKit Stream Capture v1.0',
        title: `Live Stream from ${new Date().toISOString()}`,
        ingredients: ingredients,
    };
    
    const config = await configManager.read();
    const signer = await getSigner(config);

    const { sidecar } = await create({ manifest, signer });
    await fs.writeFile(manifestOutputPath, sidecar);
}

const configCmd = program.command('config').description('CLI ayarlarını yönetir.');
configCmd.command('set <key> <value>').description('Bir ayar anahtarını belirler.').action(async (key, value) => {
    try {
      let config = await configManager.read();
      config = configManager.set(config, key, value);
      await configManager.write(config);
      console.log(`✅ Ayarlandı: ${key} = ${value}`);
    } catch (error) {
      console.error(`Hata: Ayar kaydedilemedi. ${error.message}`);
      process.exit(1);
    }
  });
configCmd.command('get <key>').description('Bir ayarın değerini gösterir.').action(async (key) => {
    try {
      const config = await configManager.read();
      const value = configManager.get(config, key);
      if (value !== undefined) console.log(value);
      else console.log(`'${key}' anahtarı bulunamadı.`);
    } catch (error) {
      console.error(`Hata: Ayar okunamadı. ${error.message}`);
      process.exit(1);
    }
  });
configCmd.command('list').description('Tüm ayarları JSON formatında listeler.').action(async () => {
    try {
      const config = await configManager.read();
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(`Hata: Ayarlar okunamadı. ${error.message}`);
      process.exit(1);
    }
  });
  
const klv = program.command('klv').description('KLV verilerini MISB ST 0601 standardına göre dönüştürme araçları.');
klv.command('to-json <inputFile> <outputFile>').description('Bir KLV dosyasını (.klv) JSON formatına dönüştürür.').action(async (inputFile, outputFile) => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log(`Dönüştürülüyor: ${inputFile} -> ${outputFile}`);
        const klvBuffer = await fs.readFile(inputFile);
        const jsonData = klvProcessor.bufferToJson(klvBuffer);
        await fs.writeFile(outputFile, JSON.stringify(jsonData, null, 2));
        console.log('✅ Dönüşüm başarılı!');
    } catch (e) {
        error = e;
        console.error(`Hata: ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('klv to-json', duration, error);
    }
  });
klv.command('from-json <inputFile> <outputFile>').description('Bir JSON dosyasını KLV formatına (.klv) dönüştürür.').action(async (inputFile, outputFile) => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log(`Dönüştürülüyor: ${inputFile} -> ${outputFile}`);
        const jsonData = JSON.parse(await fs.readFile(inputFile, 'utf-8'));
        if (!jsonData['65']) throw new Error("JSON dosyasında '65' (MISB ST 0601 Version) anahtarı bulunmalıdır.");
        const hasChecksum = jsonData.hasOwnProperty('1');
        const klvBuffer = klvProcessor.jsonToBuffer(jsonData, jsonData['65'], hasChecksum);
        await fs.writeFile(outputFile, klvBuffer);
        console.log('✅ Dönüşüm başarılı!');
    } catch (e) {
        error = e;
        console.error(`Hata: ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('klv from-json', duration, error);
    }
  });

// --- PKI KOMUTLARI ---
const pkiCmd = program.command('pki').description('PKI araçları: Anahtar, CSR ve sertifika zinciri yönetimi.');

pkiCmd
  .command('new-key')
  .description('Yeni bir özel anahtar (private key) ve Sertifika İmzalama İsteği (CSR) oluşturur.')
  .option('--keyout <file>', 'Özel anahtarın kaydedileceği dosya', 'private.key')
  .option('--csrout <file>', 'CSR\'ın kaydedileceği dosya', 'request.csr')
  .requiredOption('--cn <name>', 'Common Name (örn: example.com)')
  .option('--o <name>', 'Organization (örn: VideoKit Inc.)', 'VideoKit Inc.')
  .option('--c <country>', 'Country (örn: TR)', 'TR')
  .option('--st <state>', 'State/Province (örn: Istanbul)', 'Istanbul')
  .option('--l <locality>', 'Locality (örn: Istanbul)', 'Istanbul')
  .action(async (options) => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log('2048-bit RSA anahtar çifti oluşturuluyor...');
        const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });

        console.log('Sertifika İmzalama İsteği (CSR) oluşturuluyor...');
        const csr = forge.pki.createCertificationRequest();
        csr.publicKey = keys.publicKey;
        csr.setSubject([
            { name: 'commonName', value: options.cn },
            { name: 'organizationName', value: options.o },
            { name: 'countryName', value: options.c },
            { name: 'stateOrProvinceName', value: options.st },
            { name: 'localityName', value: options.l },
        ]);
        csr.sign(keys.privateKey, forge.md.sha256.create());
        
        const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
        const csrPem = forge.pki.certificationRequestToPem(csr);
        
        await fs.writeFile(options.keyout, privateKeyPem);
        console.log(`✅ Özel anahtar kaydedildi: ${options.keyout}`);
        
        await fs.writeFile(options.csrout, csrPem);
        console.log(`✅ CSR kaydedildi: ${options.csrout}`);
    } catch (e) {
        error = e;
        console.error(`❌ Hata: ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('pki new-key', duration, error);
    }
  });

pkiCmd
  .command('install-chain <signedCert> [intermediateCerts...]')
  .description('İmzalı sertifika ve aracı sertifikaları birleştirerek tam bir zincir dosyası (PEM) oluşturur.')
  .requiredOption('-o, --output <file>', 'Oluşturulacak zincir dosyasının adı (örn: cert-chain.pem)')
  .action(async (signedCert, intermediateCerts, options) => {
    const startTime = performance.now();
    let error = null;
    try {
        console.log(`Zincir oluşturuluyor -> ${options.output}`);
        const certs = [signedCert, ...intermediateCerts];
        const chainParts = [];

        for (const certPath of certs) {
            console.log(`  -> Okunuyor: ${certPath}`);
            const certContent = await fs.readFile(certPath, 'utf-8');
            chainParts.push(certContent.trim());
        }
        
        const fullChain = chainParts.join('\n');
        await fs.writeFile(options.output, fullChain);

        console.log(`✅ Başarılı! Sertifika zinciri şuraya kaydedildi: ${options.output}`);
        console.log("ℹ️ Doğrulama için: openssl verify -CAfile <root-ca.pem> " + options.output);
    } catch (e) {
        error = e;
        console.error(`❌ Hata: ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('pki install-chain', duration, error);
    }
  });
  
// --- TRUST STORE KOMUTLARI ---
const trustCmd = program.command('trust').description('Güvenilen kök sertifikaları (Trust Store) yönetir.');

trustCmd
  .command('add <certPath>')
  .description('Doğrulama için güvenilecek yeni bir kök sertifika ekler.')
  .action(async (certPath) => {
    const startTime = performance.now();
    let error = null;
    try {
        const fileName = await trustStoreManager.add(certPath);
        console.log(`✅ Başarılı! '${fileName}' sertifikası güvenilenler listesine eklendi.`);
    } catch (e) {
        error = e;
        if (e.code === 'ENOENT') {
            console.error(`❌ Hata: Belirtilen dosya bulunamadı: ${certPath}`);
        } else {
            console.error(`❌ Hata: Sertifika eklenemedi. ${e.message}`);
        }
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('trust add', duration, error);
    }
  });

trustCmd
  .command('list')
  .description('Güvenilenler listesindeki tüm sertifikaları gösterir.')
  .action(async () => {
    const startTime = performance.now();
    let error = null;
    try {
        const certs = await trustStoreManager.list();
        if (certs.length === 0) {
            console.log('ℹ️  Güvenilenler listesi (Trust Store) boş.');
            return;
        }
        console.log('--- Güvenilen Kök Sertifikalar ---');
        certs.forEach(c => {
            console.log(`- Dosya: ${c.filename}`);
            console.log(`  Konu (Subject): CN=${c.subject}`);
            console.log(`  Sağlayıcı (Issuer): CN=${c.issuer}`);
            console.log(`  Geçerlilik Sonu: ${c.expiry}`);
        });
        console.log('------------------------------------');
    } catch (e) {
        error = e;
        console.error(`❌ Hata: Sertifikalar listelenemedi. ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('trust list', duration, error);
    }
  });

trustCmd
  .command('remove <filename>')
  .description('Güvenilenler listesinden bir sertifikayı kaldırır.')
  .action(async (filename) => {
    const startTime = performance.now();
    let error = null;
    try {
        const success = await trustStoreManager.remove(filename);
        if (success) {
            console.log(`✅ Başarılı! '${filename}' sertifikası güvenilenler listesinden kaldırıldı.`);
        } else {
            console.log(`⚠️  Uyarı: '${filename}' adında bir sertifika bulunamadı.`);
        }
    } catch (e) {
        error = e;
        console.error(`❌ Hata: Sertifika kaldırılamadı. ${e.message}`);
        process.exit(1);
    } finally {
        const duration = performance.now() - startTime;
        await telemetryManager.trackEvent('trust remove', duration, error);
    }
  });

// --- TELEMETRİ KOMUTLARI ---
const telemCmd = program.command('telemetry').description('Anonim kullanım verileri paylaşımını yönetir.');

telemCmd
  .command('enable')
  .description('VideoKit\'i geliştirmemize yardımcı olmak için anonim kullanım verilerini paylaşmayı etkinleştirir.')
  .action(async () => {
    try {
      let config = await configManager.read();
      config = configManager.set(config, 'telemetry.enabled', 'true');
      await configManager.write(config);
      console.log('✅ Anonim telemetri etkinleştirildi. VideoKit\'i geliştirmeye yardımcı olduğunuz için teşekkür ederiz!');
      console.log('ℹ️  Bu ayarı istediğiniz zaman "vk telemetry disable" komutuyla devre dışı bırakabilirsiniz.');
    } catch (error) {
      console.error(`Hata: Ayar kaydedilemedi. ${error.message}`);
      process.exit(1);
    }
  });

telemCmd
  .command('disable')
  .description('Anonim kullanım verileri paylaşımını devre dışı bırakır.')
  .action(async () => {
    try {
      let config = await configManager.read();
      config = configManager.set(config, 'telemetry.enabled', 'false');
      await configManager.write(config);
      console.log('ℹ️ Anonim telemetri devre dışı bırakıldı.');
    } catch (error) {
      console.error(`Hata: Ayar kaydedilemedi. ${error.message}`);
      process.exit(1);
    }
  });


// Dosya indirme yardımcı fonksiyonu
async function downloadFile(url, dest) {
    const res = await fetch(url);
    const fileStream = createWriteStream(dest);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
}

program.parse(process.argv);