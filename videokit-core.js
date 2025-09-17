// --- Yardımcı Fonksiyonlar (Utilities) ---

const baseName = (name) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
};

/**
 * Bir ArrayBuffer'ı Base64 dizesine dönüştürür.
 * @param {ArrayBuffer} buffer Dönüştürülecek buffer.
 * @returns {string} Base64 kodlanmış dize.
 */
const bufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};


const pickStatusCodes = (store) => {
  const codes = new Set();
  (store?.validationStatus || []).forEach(s => s?.code && codes.add(String(s.code)));
  const vr = store?.validationResults?.activeManifest || {};
  ['success', 'informational', 'failure'].forEach(k => (vr[k] || []).forEach(s => s?.code && codes.add(String(s.code))));
  return Array.from(codes);
};

const verdictState = (codes) => {
  const hasSig = codes.some(c => /signature\./.test(c));
  const untrusted = codes.some(c => /signingCredential\.untrusted/i.test(c));
  const hasError = codes.some(c => /error|invalid|mismatch/i.test(c));
  if (!hasError && hasSig && !untrusted) return ['green', 'İmza ve zincir geçerli.'];
  if (!hasError && hasSig && untrusted) return ['yellow', 'İmza geçerli; sertifika güven kökünde değil.'];
  if (hasError) return ['red', 'Doğrulama hataları var.'];
  return ['yellow', 'Kısmi doğrulama.'];
};

const tsState = (codes) => {
  const has = re => codes.some(c => re.test(c));
  if (has(/time.?stamp\.(token\.)?trusted/i)) return ['green', 'Trusted'];
  if (has(/time.?stamp\.(token\.)?validated/i)) return ['yellow', 'Validated'];
  return ['muted', 'Yok'];
};

// --- Özel Hata Sınıfları ---
class PolicyViolationError extends Error {
  constructor(messageKey, data = {}) {
    super(messageKey);
    this.name = 'PolicyViolationError';
    this.data = data; // Çeviri için ek verileri sakla
  }
}

// --- C2PA İşlemleri ---

/**
 * Bir MP4/MOV dosyasının 'mvhd' atomundan medya oluşturma zamanını okur.
 * @param {File} file Medya dosyası.
 * @returns {Promise<Date|null>} Oluşturma zamanını içeren Date nesnesi veya bulunamazsa null.
 */
const getMp4CreationTime = async (file) => {
    // Genellikle ilk 64KB içinde bulunur, tüm dosyayı okumaya gerek yok.
    const buffer = await file.slice(0, 65536).arrayBuffer();
    const view = new DataView(buffer);
    const size = view.byteLength;
    
    // 1904-01-01 ile 1970-01-01 (JS Epoch) arasındaki saniye farkı
    const EPOCH_OFFSET = 2082844800;

    // 'moov' kutusunu bul
    for (let i = 0; i < size - 8; i++) {
        const boxSize = view.getUint32(i, false);
        const boxType = String.fromCharCode(view.getUint8(i + 4), view.getUint8(i + 5), view.getUint8(i + 6), view.getUint8(i + 7));
        
        if (boxType === 'moov' && boxSize > 8) {
            // 'moov' içinde 'mvhd' kutusunu bul
            for (let j = i + 8; j < i + boxSize - 8; j++) {
                const innerSize = view.getUint32(j, false);
                const innerType = String.fromCharCode(view.getUint8(j + 4), view.getUint8(j + 5), view.getUint8(j + 6), view.getUint8(j + 7));

                if (innerType === 'mvhd' && innerSize > 20) {
                    const version = view.getUint8(j + 8);
                    let timeOffset = j + 8 + 4; // version (1 byte) + flags (3 bytes)
                    
                    let creationTime;
                    if (version === 1) { // 64-bit timestamp
                        const high = view.getUint32(timeOffset, false);
                        const low = view.getUint32(timeOffset + 4, false);
                        // JavaScript'te 64-bit integer'ları güvenli bir şekilde işlemek zordur.
                        // Çoğu video 2038 sonrasına uzanmayacağı için version 0 kullanır.
                        // Bu basit bir yaklaşımdır.
                        creationTime = (high * (2**32)) + low;
                        timeOffset += 8;
                    } else { // 32-bit timestamp
                        creationTime = view.getUint32(timeOffset, false);
                        timeOffset += 4;
                    }
                    
                    if (creationTime > EPOCH_OFFSET) {
                        const jsTimestamp = (creationTime - EPOCH_OFFSET) * 1000;
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
};


const c2paProcessor = {
  /**
   * Bir video dosyasını (yerel veya remote URL) ve opsiyonel yan dosyasını C2PA standartlarına göre doğrular.
   * @param {File|string} assetSource Doğrulanacak video dosyası veya URL'i.
   * @param {Object} options Ek seçenekler { sidecar?: File, customTrustList?: string[] }.
   * @returns {Promise<Object>} Bir doğrulama raporu nesnesi.
   */
  verify: async (assetSource, options = {}) => {
    let report;
    const isUrl = typeof assetSource === 'string';
    const fileName = isUrl ? new URL(assetSource).pathname.split('/').pop() : assetSource.name;
    const fileSize = isUrl ? undefined : assetSource.size;

    try {
      const t0 = performance.now();
      
      const readOptions = {};
      // Sidecar sadece yerel dosyalar için geçerlidir
      if (!isUrl && options.sidecar) readOptions.sidecar = options.sidecar;
      
      // Güven listesini hem özel listeden hem de depolanan listeden birleştir
      const storedTrustList = security.trustList.get().map(item => item.pem);
      const combinedTrustList = [...new Set([...(options.customTrustList || []), ...storedTrustList])];
      if (combinedTrustList.length > 0) {
          readOptions.trustList = combinedTrustList;
      }
      
      // c2pa.read() hem File nesnesini hem de URL string'ini kabul eder
      const { manifestStore: store, source } = await c2pa.read(assetSource, readOptions);
      const dt = Math.round(performance.now() - t0);

      // fileHash sadece yerel dosyalar için hesaplanır, remote için null bırakılır.
      let fileHash = null;
      if (!isUrl) {
          const buf = await assetSource.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', buf);
          fileHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const m = store?.activeManifest;
      const sig = m?.signatureInfo || m?.signature || {};
      const codes = pickStatusCodes(store);
      const [vClass, vMsg] = verdictState(codes);
      const [tsClass, tsMsg] = tsState(codes);

      report = {
        verdict: vClass, message: vMsg, ms: dt,
        file: { name: fileName, size: fileSize }, fileHash,
        summary: {
          sourceType: store?.sourceType, title: m?.title,
          claimGenerator: m?.claimGenerator, issuer: sig?.issuer, time: sig?.time
        },
        validationCodes: codes,
        isSidecarUsed: !!source?.metadata?.sidecar
      };
    } catch (e) {
      report = {
        verdict: 'red', message: 'Okuma/Doğrulama hatası', error: String(e?.message || e),
        file: { name: fileName, size: fileSize }
      };
    }
    return report;
  },

  /**
   * Verilen bilgilere göre bir C2PA manifest'i oluşturur ve imzalar.
   * @param {Object} params Gerekli parametreler.
   * @param {File} params.asset Dosya.
   * @param {string} params.author Yazar.
   * @param {string} params.action Eylem.
   * @param {string} params.agent Yazılım bilgisi.
   * @param {string} params.tsaUrl Zaman damgası sunucusu.
   * @param {CryptoKeyPair} params.keyPair İmzalama anahtar çifti.
   * @param {string} [params.roughtimeServerUrl] Roughtime damgası için kullanılacak sunucu URL'i.
   * @param {Object} [params.policy={}] Uygulanacak güvenlik politikaları.
   * @param {boolean} [params.policy.capture_only=false] Sadece yeni yakalanmış varlıkları mühürle.
   * @param {File[]} [params.ingredients=[]] Kaynak dosyalar (bileşenler).
   * @returns {Promise<Blob>} .c2pa yan dosyası olarak bir Blob.
   */
  stamp: async ({ asset, author, action, agent, tsaUrl, keyPair, ingredients = [], policy = {}, roughtimeServerUrl = null }) => {
    // Post-hoc Mühür Güvenlik Kilidi Politikası
    if (policy.capture_only) {
        const creationTime = await getMp4CreationTime(asset);
        if (creationTime) {
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            if (creationTime.getTime() < twentyFourHoursAgo) {
                throw new PolicyViolationError(
                    'error.policy.capture_only.too_old', 
                    { creationTime: creationTime.toISOString() }
                );
            }
        }
    }

    const manifest = {
      claimGenerator: agent,
      assertions: [
        { label: 'dcterms.creator', data: { '@type': 'Person', 'name': author } },
        { label: 'stds.schema-org.CreativeWork', data: { 'author': [{ '@type': 'Person', 'name': author }] } },
        { label: 'c2pa.actions', data: { actions: [{ action }] } }
      ],
    };

    if (ingredients && ingredients.length > 0) {
      manifest.ingredients = ingredients.map(file => ({
        file: file,
        relationship: 'parentOf', // Bu dosyanın, bileşenin (ingredient) bir türevi olduğunu belirtir
      }));
    }

    if (roughtimeServerUrl) {
        try {
            const proofBuffer = await security.roughtime.getProof(roughtimeServerUrl);
            manifest.assertions.push({
                label: 'c2pa.time.roughtime_signature',
                data: {
                    alg: 'ed25519',
                    proof: bufferToBase64(proofBuffer),
                },
            });
        } catch (e) {
            console.warn(`Roughtime damgası alınamadı: ${e.message}`);
        }
    }

    const { sidecar } = await c2pa.create({
      manifest: manifest,
      asset: { file: asset },
      signer: {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        alg: 'ES256',
        tsaUrl: tsaUrl,
      },
    });
    return new Blob([sidecar], { type: 'application/c2pa' });
  },

  /**
   * Bir video dosyasının C2PA uyumlu BMFF v2 parçalı hash'ini hesaplar.
   * @param {File} file Video dosyası (MP4/MOV).
   * @returns {Promise<string>} Hesaplanan hash dizesi.
   */
  calculateBmffHash: (file) => {
    return c2pa.hash.bmff(file);
  },

  /**
   * Bir HLS/DASH akışının segment bütünlüğünü BMFF hash'lerini karşılaştırarak doğrular.
   * @param {string} manifestUrl .m3u8 veya .mpd dosyasının URL'i.
   * @param {function(number, number): void} [progressCallback] İlerleme durumu için geri arama fonksiyonu (işlenen, toplam).
   * @returns {Promise<Object>} Bir bütünlük raporu nesnesi.
   */
  verifyStreamIntegrity: async (manifestUrl, progressCallback = () => {}) => {
    const report = {
      manifestUrl,
      overallStatus: 'pending',
      referenceHash: null,
      segmentCount: 0,
      mismatchCount: 0,
      errorCount: 0,
      segments: [],
    };

    let segmentUrls = [];
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`Manifest dosyası alınamadı: ${response.statusText}`);
      const manifestText = await response.text();
      const baseUrl = new URL('.', manifestUrl).href;

      if (manifestUrl.endsWith('.m3u8')) {
        segmentUrls = manifestText.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => new URL(line, baseUrl).href);
      } else if (manifestUrl.endsWith('.mpd')) {
        // Not: Bu basit bir DASH parser'ıdır ve tüm durumları kapsamayabilir.
        const matches = manifestText.match(/<SegmentURL media="([^"]+)"/g) || [];
        // BaseURL ve diğer karmaşıklıkları ele almak için daha sağlam bir XML parser gerekebilir.
        // Bu örnek için, media URL'lerinin mutlak olduğunu varsayıyoruz veya basitçe birleştiriyoruz.
        segmentUrls = matches.map(match => {
           const relativeUrl = match.match(/media="([^"]+)"/);
           return new URL(relativeUrl, baseUrl).href;
        });
      } else {
        throw new Error('Desteklenmeyen manifest formatı. Sadece .m3u8 ve .mpd desteklenir.');
      }

      if (segmentUrls.length === 0) {
        throw new Error('Manifest içinde işlenecek segment bulunamadı.');
      }
      
      report.segmentCount = segmentUrls.length;
      progressCallback(0, report.segmentCount);
      
      for (let i = 0; i < segmentUrls.length; i++) {
        const url = segmentUrls[i];
        const segmentReport = { url, status: 'pending', hash: null, error: null };
        try {
          const segmentResponse = await fetch(url);
          if (!segmentResponse.ok) throw new Error(`Segment indirilemedi: ${segmentResponse.statusText}`);
          const segmentBlob = await segmentResponse.blob();
          
          // c2pa.hash.bmff File nesnesi bekler, Blob'dan oluşturabiliriz.
          const segmentFile = new File([segmentBlob], url.split('/').pop());
          const hash = await c2paProcessor.calculateBmffHash(segmentFile);
          
          segmentReport.hash = hash;
          if (i === 0) {
            report.referenceHash = hash;
            segmentReport.status = 'ok';
          } else {
            if (hash === report.referenceHash) {
              segmentReport.status = 'ok';
            } else {
              segmentReport.status = 'mismatch';
              report.mismatchCount++;
            }
          }
        } catch (e) {
          segmentReport.status = 'error';
          segmentReport.error = e.message;
          report.errorCount++;
        }
        report.segments.push(segmentReport);
        progressCallback(i + 1, report.segmentCount);
      }

    } catch (e) {
      report.overallStatus = 'error';
      report.error = e.message;
      return report;
    }

    if (report.errorCount > 0) {
      report.overallStatus = 'error';
    } else if (report.mismatchCount > 0) {
      report.overallStatus = 'mismatch';
    } else {
      report.overallStatus = 'ok';
    }
    
    return report;
  }
};

// --- KLV İşlemleri (MISB ST 0601) ---

const klvProcessor = {
  _ajv: null,
  _validate: null,

  /**
   * JSON Schema'yı ve doğrulayıcıyı başlatır.
   */
  initValidator: async function() {
    if (this._validate) return;
    try {
      // AJV kütüphanesinin global'de yüklü olduğunu varsayıyoruz.
      // Eğer değilse, bu kodun bir import veya script tag'i ile yüklenmesi gerekir.
      this._ajv = new Ajv();
      const response = await fetch('./misb-0601.schema.json');
      if (!response.ok) throw new Error(`Schema dosyası yüklenemedi: ${response.statusText}`);
      const schema = await response.json();
      this._validate = this._ajv.compile(schema);
    } catch (error) {
      console.error("KLV doğrulayıcı başlatılamadı:", error);
      this._validate = () => true;
    }
  },

  /**
   * MISB standartlarına uygun CRC-16/CCITT-FALSE sağlama toplamını hesaplar.
   * @param {Uint8Aray} buffer Hesaplanacak veri.
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
    // Checksum (Tag 1) hariç tüm anahtarları işle
    const keys = Object.keys(obj).filter(k => /^\d+$/.test(k) && k !== '1');
    
    // Tag 2 (timestamp) her zaman ilk sırada olmalı
    if (keys.includes('2')) {
        processTag('2', obj['2']);
    }
    // Geri kalan tag'ları sayısal olarak sırala ve işle
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
            // Diğer sayısal tipler için genel bir yaklaşım (örneğin baş dümenci açısı)
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
      // Checksum, UL + Length + Payload üzerinden hesaplanır
      const lenBytesTemp = klvProcessor.writeBerLength(payload.length + 4); // +4 for checksum tag itself
      const tempPacketForCrc = new Uint8Array(ul.length + lenBytesTemp.length + payload.length);
      tempPacketForCrc.set(ul);
      tempPacketForCrc.set(lenBytesTemp, ul.length);
      tempPacketForCrc.set(payload, ul.length + lenBytesTemp.length);

      const checksum = klvProcessor.crc16(tempPacketForCrc);
      
      // Checksum tag'ini oluştur (Tag 1, Length 2, Value checksum)
      const checksumChunk = new Uint8Array(4);
      checksumChunk[0] = 1; // Tag 1
      checksumChunk[1] = 2; // Length 2
      new DataView(checksumChunk.buffer).setUint16(2, checksum, false);

      // payload'a checksum'ı ekle
      const finalPayload = new Uint8Array(payload.length + checksumChunk.length);
      finalPayload.set(payload);
      finalPayload.set(checksumChunk, payload.length);
      payload = finalPayload; // payload'ı güncelle
    }

    const lenBytes = klvProcessor.writeBerLength(payload.length);
    const out = new Uint8Array(ul.length + lenBytes.length + payload.length);
    out.set(ul); out.set(lenBytes, ul.length); out.set(payload, ul.length + lenBytes.length);
    return out;
  },

  bufferToJson: (buf) => {
    const view = new Uint8Array(buf);
    const result = { _validation_notes: [] };
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
    let checksumTagIndex = -1;
    let receivedChecksum = -1;

    // Önce checksum tag'ini bul
    let p = 0;
    while (p < payloadView.length) {
        const tag = payloadView[p];
        const [len, consumed] = klvProcessor.readBerLength(payloadView, p + 1);
        if (tag === 1 && len === 2) {
            checksumTagIndex = p;
            const dv = new DataView(payloadView.buffer, payloadView.byteOffset + p + 1 + consumed, 2);
            receivedChecksum = dv.getUint16(0, false);
            break; // Checksum bulundu, döngüden çık
        }
        p += 1 + consumed + len;
    }

    if (receivedChecksum !== -1) {
        // Checksum, UL + Length + (Checksum tag'i hariç payload) üzerinden hesaplanır
        const dataForCrc = view.subarray(0, offset + checksumTagIndex);
        const calculatedCrc = klvProcessor.crc16(dataForCrc);
        
        if (calculatedCrc === receivedChecksum) {
            result._validation_notes.push('✅ CRC Doğrulaması Başarılı');
        } else {
            result._validation_notes.push(`❌ CRC Hatası (Alınan: ${receivedChecksum}, Hesaplanan: ${calculatedCrc})`);
        }
    }

    // Şimdi tüm tag'leri işle
    p = 0;
    let isFirstTag = true;
    while(p < payloadView.length) {
        const tag = payloadView[p];
        if (p + 1 >= payloadView.length) break;

        const [len, consumed] = klvProcessor.readBerLength(payloadView, p + 1);
        const valueStart = p + 1 + consumed;
        if (valueStart + len > payloadView.length) break;

        const slice = payloadView.subarray(valueStart, valueStart + len);
        
        if (isFirstTag && tag !== 2 && !result['_validation_notes'].some(n => n.includes('Tag 2'))) {
           result._validation_notes.push('⚠️ Uyarı: Tag 2 ilk öğe değil.');
        }
        isFirstTag = false;

        let value;
        const dv = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
        if (tag === 2 && slice.byteLength === 8){
          const micros = dv.getBigUint64(0, false); value = micros.toString(); result['_2_iso'] = new Date(Number(micros / 1000n)).toISOString();
        } else if ((tag === 13 || tag === 14) && slice.byteLength === 4){
          value = (dv.getInt32(0, false) / 2147483647) * (tag === 13 ? 90 : 180);
        } else if (tag === 15 && slice.byteLength === 2) {
          value = (dv.getUint16(0, false) / 65535) * 19900 - 900;
        } else if (tag === 65 && slice.byteLength === 1) {
          value = dv.getUint8(0);
        } else if (tag === 5 && slice.byteLength === 2) {
          value = dv.getUint16(0, false) * (360.0 / 65535);
        } else if (tag !== 1) { // Checksum tag'ini tekrar işlememek için
          value = new TextDecoder('utf-8', { fatal:false }).decode(slice);
        }

        if(value !== undefined) result[String(tag)] = value;
        p += 1 + consumed + len;
    }
    if (result._validation_notes.length === 0) delete result._validation_notes;
    return result;
  },

  /**
   * Bir JSON nesnesini MISB ST 0601 şemasına ve semantik kurallara göre doğrular.
   * @param {Object} obj Doğrulanacak JSON nesnesi.
   * @returns {Promise<string[]>} Doğrulama sonuçlarını içeren bir dizi.
   */
  validateJson: async function(obj) {
    await this.initValidator();
    const errs = [];

    // 1. Şema doğrulamasını çalıştır (Format ve aralık kontrolü)
    const valid = this._validate(obj);
    if (!valid) {
      this._validate.errors.forEach(err => {
        let field = err.instancePath.replace('/', 'Tag ');
        if (err.keyword === 'required') {
          field = `Tag ${err.params.missingProperty}`;
        }
        if (err.keyword === 'maximum' || err.keyword === 'minimum') {
             errs.push(`❌ ${field}: Değer aralık dışında. İzin verilen: ${err.params.limit}. Gelen: ${err.instancePath ? obj[err.instancePath.substring(1)] : 'N/A'}`);
        } else {
             errs.push(`❌ ${field}: ${err.message}`);
        }
      });
    }

    // 2. Özel Semantik Kontroller
    if (obj['2']) {
        try {
            const timestampMicros = BigInt(obj['2']);
            const timestampMillis = Number(timestampMicros / 1000n);
            const nowWithBuffer = Date.now() + (5 * 60 * 1000);
            if (timestampMillis > nowWithBuffer) {
                errs.push(`❌ Tag 2 (Unix Time Stamp): Değer, gelecekteki bir tarihi gösteremez.`);
            }
        } catch (e) {
            errs.push(`❌ Tag 2 (Unix Time Stamp): Geçersiz zaman damgası formatı.`);
        }
    }

    if(obj['_validation_notes']) {
      errs.push(...obj['_validation_notes']);
    }

    if (errs.length === 0) {
      errs.push("✅ Tüm şema ve semantik kontrollerden geçti.");
    }
    return errs;
  }
};

// --- MPEG-TS İşlemleri ---

const mpegtsProcessor = {
  /**
   * Bir MPEG-TS dosyasından KLV veri akışını ayıklar.
   * @param {ArrayBuffer} tsBuffer - Kaynak MPEG-TS dosyasının buffer'ı.
   * @returns {Promise<ArrayBuffer>} Ayıklanan KLV verisi.
   */
  extractKlvFromTs: (tsBuffer) => {
    return new Promise((resolve, reject) => {
      if (typeof muxjs === 'undefined') {
        return reject(new Error('mux.js kütüphanesi yüklenmemiş.'));
      }

      const transmuxer = new muxjs.mp2t.Transmuxer();
      const klvChunks = [];

      transmuxer.on('data', (segment) => {
        if (segment.metadata && segment.metadata.byteLength > 0) {
          klvChunks.push(segment.metadata);
        }
      });

      transmuxer.on('done', () => {
        if (klvChunks.length === 0) {
          return resolve(new ArrayBuffer(0)); // KLV akışı bulunamadı
        }
        const totalLength = klvChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of klvChunks) {
          result.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        resolve(result.buffer);
      });

      transmuxer.on('error', (error) => reject(error));
      transmuxer.push(new Uint8Array(tsBuffer));
      transmuxer.flush();
    });
  },

  /**
   * Bir KLV veri akışını mevcut bir MPEG-TS dosyasına gömer.
   * @param {ArrayBuffer} tsBuffer - Kaynak MPEG-TS dosyasının buffer'ı.
   * @param {ArrayBuffer} klvBuffer - Gömülecek KLV verisi.
   * @returns {Promise<ArrayBuffer>} KLV gömülmüş yeni MPEG-TS buffer'ı.
   */
  embedKlvInTs: async (tsBuffer, klvBuffer) => {
    if (typeof muxjs === 'undefined') {
      throw new Error('mux.js kütüphanesi yüklenmemiş.');
    }
    const demuxed = await new Promise((resolve, reject) => {
      const demuxer = new muxjs.mp2t.Transmuxer();
      const tracks = {};
      const segments = [];
      demuxer.on('trackinfo', (info) => tracks[info.id] = info);
      demuxer.on('data', (segment) => segments.push(segment));
      demuxer.on('done', () => resolve({ tracks, segments }));
      demuxer.on('error', reject);
      demuxer.push(new Uint8Array(tsBuffer));
      demuxer.flush();
    });

    return new Promise((resolve, reject) => {
      const remuxer = new muxjs.mp2t.Transmuxer({ remux: false });
      const outputChunks = [];
      remuxer.on('data', (segment) => outputChunks.push(segment.data));
      remuxer.on('done', () => {
        const totalLength = outputChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        outputChunks.forEach(chunk => {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        });
        resolve(result.buffer);
      });
      remuxer.on('error', reject);
      Object.values(demuxed.tracks).forEach(track => remuxer.addTrack(track));
      const klvTrackId = 0x100;
      remuxer.addTrack({ type: 'metadata', id: klvTrackId, streamType: 0x15, timelineStartInfo: { pts: 0 } });
      if (klvBuffer && klvBuffer.byteLength > 0) {
        remuxer.push({ type: 'metadata', trackId: klvTrackId, pts: 0, dts: 0, data: new Uint8Array(klvBuffer) });
      }
      demuxed.segments.forEach(segment => remuxer.push(segment));
      remuxer.flush();
    });
  }
};

// --- Format Dönüştürücü (Transcoder) ---
const transcoderProcessor = {
  _ffmpeg: null,
  _logCallback: null,

  load: async function(logCallback = console.log) {
    this._logCallback = logCallback;
    if (this._ffmpeg) {
      this._logCallback("FFmpeg zaten yüklü.");
      return;
    }
    this._logCallback("FFmpeg.wasm motoru yükleniyor...");
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
        this._logCallback(`[FFmpeg]: ${message}`);
    });
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js'
    });
    this._ffmpeg = ffmpeg;
    this._logCallback("✅ FFmpeg.wasm motoru başarıyla yüklendi.");
  },

  _runConversion: async function(inputFile, outputName, commandArgs) {
    if (!this._ffmpeg) {
      await this.load();
    }
    const inputName = 'input.dat';
    this._logCallback(`Girdi dosyası yazılıyor: ${inputName}`);
    await this._ffmpeg.writeFile(inputName, await fetchFile(inputFile));
    this._logCallback(`FFmpeg komutu çalıştırılıyor: ${commandArgs.join(' ')}`);
    await this._ffmpeg.exec(commandArgs);
    this._logCallback(`Çıktı dosyası okunuyor: ${outputName}`);
    const data = await this._ffmpeg.readFile(outputName);
    this._logCallback("Sanal dosya sistemi temizleniyor...");
    await this._ffmpeg.deleteFile(inputName);
    await this._ffmpeg.deleteFile(outputName);
    return new Blob([data.buffer], { type: outputName.endsWith('.ts') ? 'video/mp2t' : 'video/mp4' });
  },

  convertMp4ToTs: async function(mp4File) {
    const outputFileName = 'output.ts';
    const args = ['-i', 'input.dat', '-c', 'copy', '-f', 'mpegts', outputFileName];
    return this._runConversion(mp4File, outputFileName, args);
  },

  convertTsToMp4: async function(tsFile) {
    const outputFileName = 'output.mp4';
    const args = ['-i', 'input.dat', '-c', 'copy', '-movflags', '+faststart', outputFileName];
    return this._runConversion(tsFile, outputFileName, args);
  }
};


// --- Komut Üreteçleri ---

/**
 * Bir dizeyi kabuk (shell) komutlarında güvenli bir şekilde kullanmak üzere alıntılar.
 * Tek tırnakları ('') kaçış karakteriyle değiştirir ve sonucu tek tırnak içine alır.
 * Bu, komut enjeksiyonu saldırılarını önler.
 * @param {string} s Alıntılanacak dize.
 * @returns {string} Güvenli, alıntılanmış dize.
 */
const shellQuote = (s) => {
  const str = String(s);
  if (str.length === 0) {
    return "''";
  }
  // Tek tırnak (') karakteri en zor olanıdır. En sağlam yöntem, her bir tek tırnağı
  // '\' (alıntıyı sonlandır, kaçış karakterli alıntı ekle, yeni alıntı başlat) ile değiştirmektir.
  // Ardından tüm dizeyi tek tırnak içine al.
  return "'" + str.replace(/'/g, "'\\''") + "'";
};

const commandGenerators = {
  gstreamer: ({ videoName, klvName }) => {
    const outputName = baseName(videoName) + '_with_klv.ts';
    return `gst-launch-1.0 filesrc location=${shellQuote(videoName)} ! qtdemux ! h24parse ! mux. filesrc location=${shellQuote(klvName)} ! klvparse mapping=st0601 ! mux. mpegtsmux name=mux ! filesink location=${shellQuote(outputName)}`;
  },
  ffmpeg: ({ tsName, action }) => {
    const safeTsName = shellQuote(tsName);
    let outputName = '';
    switch(action) {
        case 'analyze':
            return `# KLV akışının varlığını, paketlerini ve zaman damgalarını kontrol edin:\n` +
                   `ffprobe -v quiet -print_format json -show_streams -show_packets ${safeTsName}`;
        case 'extract':
            outputName = baseName(tsName) + '.klv';
            return `ffmpeg -i ${safeTsName} -map 0:d -c copy -f data "${shellQuote(outputName)}"`;
        case 'clean':
            outputName = baseName(tsName) + '_no_klv.ts';
            return `ffmpeg -i ${safeTsName} -map 0:v -c copy ${shellQuote(outputName)}`;
    }
    return '';
  },
  analyzeFfmpegJson: (jsonText) => {
    const data = JSON.parse(jsonText);
    const klvStream = data.streams?.find(s => s.codec_type === 'data');
    let report = [];
    if (!klvStream) {
        report.push('❌ KLV Akışı Bulunamadı (codec_type="data" yok).');
    } else {
        const streamId = parseInt(klvStream.id, 16);
        const pid = streamId & 0x1FFF;
        report.push(`✅ KLV Akışı Bulundu:`);
        report.push(`  - PID: ${pid} (0x${pid.toString(16)}) (Stream Index: ${klvStream.index})`);
        const klvPackets = data.packets?.filter(p => p.stream_index === klvStream.index) || [];
        report.push(`  - Toplam KLV Paketi: ${klvPackets.length}`);
    }
    return "Analiz Raporu:\n" + report.join('\n');
  }
};

// --- Güvenlik ve Anahtar Yönetimi ---

const security = {
  db: {
    _db: null, name: 'VideoKitKeyStore', storeName: 'keys',
    init: function() {
      return new Promise((resolve, reject) => {
        if (this._db) return resolve(this._db);
        const request = indexedDB.open(this.name, 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore(this.storeName);
        request.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
        request.onerror = e => reject(e.target.error);
      });
    },
    _tx: function(mode) { return this.init().then(db => db.transaction(this.storeName, mode).objectStore(this.storeName)); },
    get: function(key) { return this._tx('readonly').then(s => new Promise((res,rej) => { const r=s.get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); },
    set: function(key, val) { return this._tx('readwrite').then(s => s.put(val, key)); },
    clear: function() { return this._tx('readwrite').then(s => s.clear()); }
  },

  keyManager: {
    /**
     * Bir CryptoKey (publicKey) nesnesinden SHA-256 tabanlı bir parmak izi oluşturur.
     * @param {CryptoKey} publicKey - Parmak izi oluşturulacak açık anahtar.
     * @returns {Promise<string>} Hex formatında parmak izi dizesi.
     */
    _getFingerprint: async (publicKey) => {
      const pubJwk = await crypto.subtle.exportKey('jwk', publicKey);
      // JWK'nin kararlı bir dize temsili için anahtarları sırala
      const sortedJwk = JSON.stringify(Object.keys(pubJwk).sort().reduce((obj, key) => { obj[key] = pubJwk[key]; return obj; }, {}));
      const buf = new TextEncoder().encode(sortedJwk);
      const digest = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    /**
     * Yeni bir anahtar çifti oluşturur, parmak iziyle depolar ve aktif anahtar olarak ayarlar.
     * @returns {Promise<CryptoKeyPair>} Oluşturulan yeni anahtar çifti.
     */
    generateAndStore: async () => {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const fingerprint = await security.keyManager._getFingerprint(pair.publicKey);
      await security.db.set(`keypair_${fingerprint}`, pair);
      await security.db.set('active_key_fingerprint', fingerprint);
      console.log(`Yeni aktif anahtar oluşturuldu: ${fingerprint}`);
      return pair;
    },

    /**
     * Tüm anahtar yönetimi veritabanını temizler.
     */
    clear: async () => {
        // Bu işlem daha karmaşık hale geldiği için IndexedDB'nin clear'ını doğrudan kullanmak yerine
        // tüm ilgili anahtarları silmek daha güvenli olabilir, ancak şimdilik clear yeterli.
        await security.db.clear();
        console.log("Anahtar deposu temizlendi.");
    },

    /**
     * İmzalama için mevcut "aktif" anahtar çiftini yükler.
     * @returns {Promise<CryptoKeyPair|null>} Aktif anahtar çifti veya bulunamazsa null.
     */
    load: async () => {
      const fingerprint = await security.db.get('active_key_fingerprint');
      if (!fingerprint) {
        console.warn("Aktif anahtar bulunamadı.");
        return null;
      }
      return security.db.get(`keypair_${fingerprint}`);
    },

    /**
     * Aktif anahtar hakkında bilgi (örn. parmak izi) alır.
     * @returns {Promise<{fingerprint: string}|null>} Bilgi nesnesi veya aktif anahtar yoksa null.
     */
    getInfo: async () => {
      const fingerprint = await security.db.get('active_key_fingerprint');
      if (!fingerprint) return null;
      return { fingerprint };
    },
    
    /**
     * Anahtar devri (key rollover) işlemini gerçekleştirir.
     * Eski aktif anahtarın sertifikasını güven listesine ekler ve yeni bir anahtar çifti oluşturup aktif hale getirir.
     * @param {string} oldActiveCertificatePem - Devredilecek (artık eski olacak) aktif anahtarın PEM formatındaki sertifikası.
     * @returns {Promise<{newKeyPair: CryptoKeyPair, newFingerprint: string}>} Yeni oluşturulan anahtar çiftini ve parmak izini döndürür.
     */
    rollover: async (oldActiveCertificatePem) => {
        console.log("Anahtar devri işlemi başlatılıyor...");
        
        // 1. Mevcut anahtarın sertifikasını güven listesine ekle.
        // Bu, bu anahtarla imzalanmış eski videoların doğrulanabilmesini sağlar.
        if (!oldActiveCertificatePem) {
            throw new Error("Anahtar devri için eski aktif anahtarın sertifikası (PEM) gereklidir.");
        }
        try {
            const addedCertInfo = await security.trustList.add(oldActiveCertificatePem);
            console.log(`Eski sertifika (${addedCertInfo.fingerprint.slice(0,12)}...) güven listesine eklendi.`);
        } catch (e) {
            // "Zaten mevcut" hatasını görmezden gel, diğer hataları fırlat
            if (!e.message.includes('zaten güven listesinde mevcut')) {
                throw e;
            }
            console.warn("Eski sertifika zaten güven listesindeydi, işleme devam ediliyor.");
        }

        // 2. Yeni bir anahtar çifti oluştur, depola ve aktif olarak ayarla.
        // Tüm yeni imzalama işlemleri bu yeni anahtarı kullanacak.
        const newKeyPair = await security.keyManager.generateAndStore();
        const newFingerprint = await security.keyManager._getFingerprint(newKeyPair.publicKey);
        
        console.log(`Anahtar devri tamamlandı. Yeni aktif anahtar: ${newFingerprint}`);
        return { newKeyPair, newFingerprint };
    }
  },

  tsa: {
    request: async (tsaServerUrl) => {
        if (typeof pkijs === 'undefined' || typeof asn1js === 'undefined') {
            throw new Error("Gerekli kriptografi kütüphaneleri (PKI.js, ASN1.js) yüklenmemiş.");
        }
        const dataToTimestamp = new TextEncoder().encode(new Date().toISOString());
        const hash = await crypto.subtle.digest('SHA-256', dataToTimestamp);
        const tspReq = new pkijs.TimeStampReq({ version: 1, messageImprint: new pkijs.MessageImprint({ hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: "2.16.840.1.101.3.4.2.1" }), hashedMessage: new asn1js.OctetString({ valueHex: hash }) }), certReq: true });
        const reqBer = tspReq.toSchema().toBER(false);
        const response = await fetch(tsaServerUrl, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query' }, body: reqBer });
        if (!response.ok) throw new Error(`TSA sunucusu hatası: ${response.status} ${response.statusText}`);
        const respBer = await response.arrayBuffer();
        const asn1 = asn1js.fromBER(respBer);
        if (asn1.offset === -1) throw new Error("TSA yanıtı çözümlenemedi (invalid ASN.1).");
        const tspResp = new pkijs.TimeStampResp({ schema: asn1.result });
        const statusCode = tspResp.status.status;
        if (statusCode !== 0 && statusCode !== 1) throw new Error(`TSA isteği reddetti. Durum: ${statusCode}`);
        const tstInfo = new pkijs.TSTInfo({ schema: pkijs.ContentInfo.fromBER(tspResp.timeStampToken.content).content });
        return tstInfo.genTime;
    }
  },

  trustList: {
    KEY: 'videoKitTrustList',
    get: () => JSON.parse(localStorage.getItem(security.trustList.KEY) || '[]'),
    save: (list) => localStorage.setItem(security.trustList.KEY, JSON.stringify(list)),
    add: async (pem) => {
      if (typeof pkijs === 'undefined' || typeof asn1js === 'undefined') {
        throw new Error("Gerekli kriptografi kütüphaneleri (PKI.js, ASN1.js) yüklenmemiş.");
      }
      if (!pem.startsWith('-----BEGIN CERTIFICATE-----') || !pem.endsWith('-----END CERTIFICATE-----')) {
        throw new Error('Geçersiz PEM formatı.');
      }
      const pemString = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '');
      const der = Uint8Array.from(atob(pemString), c => c.charCodeAt(0)).buffer;
      const cert = new pkijs.Certificate({ schema: asn1js.fromBER(der).result });
      const subject = cert.subject.typesAndValues.map(tv => `${tv.type.slice(tv.type.lastIndexOf('.') + 1)}=${tv.value.valueBlock.value}`).join(', ');
      const hashBuffer = await crypto.subtle.digest('SHA-1', der);
      const fingerprint = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join(':');
      const list = security.trustList.get();
      if (list.some(item => item.fingerprint === fingerprint)) {
        throw new Error('Bu sertifika zaten güven listesinde mevcut.');
      }
      list.push({ pem, subject, fingerprint });
      security.trustList.save(list);
      return { subject, fingerprint };
    },
    remove: (fingerprint) => {
      let list = security.trustList.get();
      list = list.filter(item => item.fingerprint !== fingerprint);
      security.trustList.save(list);
    },
    clear: () => security.trustList.save([])
  },

  roughtime: {
    /**
     * Bir Roughtime sunucusundan zaman kanıtı (proof) talep eder.
     * Not: Roughtime protokolü normalde UDP kullanır. Bu implementasyon, tarayıcı uyumluluğu için
     * Roughtime sunucusuna HTTP üzerinden erişim sağlayan bir ara katman (proxy) olduğunu varsayar.
     * @param {string} serverUrl Roughtime sunucusunun (veya proxy'sinin) URL'i.
     * @returns {Promise<ArrayBuffer>} Sunucudan gelen ham Roughtime yanıt paketi.
     */
    getProof: async (serverUrl) => {
        // Roughtime isteği için 64 byte'lık rastgele bir nonce (tek kullanımlık sayı) oluştur.
        const nonce = crypto.getRandomValues(new Uint8Array(64));

        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: nonce.buffer,
        });

        if (!response.ok) {
            throw new Error(`Roughtime sunucusu hatası: ${response.status} ${response.statusText}`);
        }
        
        // Sunucudan gelen imzalı yanıt, manifest'e eklenecek olan kanıtın kendisidir.
        return await response.arrayBuffer();
    }
  }
};


// Dışa aktarılacak ana nesne
export const VideoKitCore = {
  c2pa: c2paProcessor,
  klv: klvProcessor,
  mpegts: mpegtsProcessor,
  transcoder: transcoderProcessor,
  commands: commandGenerators,
  security: security,
  errors: {
      PolicyViolationError
  },
  utils: {
    baseName,
    bufferToBase64,
    pickStatusCodes,
    verdictState,
    tsState
  }
};