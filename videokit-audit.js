import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { createHash } from 'crypto';

const AUDIT_LOG_FILE = 'audit.log';
const GENESIS_HASH = '0'.repeat(64); // Zincirin başlangıcı için sabit hash

/**
 * Verilen bir string verinin SHA-256 hash'ini hesaplar.
 * @param {string} data - Hash'i hesaplanacak veri.
 * @returns {string} Hex formatında hash.
 */
const calculateHash = (data) => {
  return createHash('sha256').update(data).digest('hex');
};

/**
 * Denetim log dosyasının son satırını okur ve hash'ini döndürür.
 * @returns {Promise<string>} Son kaydın hash'i veya ilk kayıt ise genesis hash'i.
 */
const getLastHash = async () => {
  try {
    await fs.access(AUDIT_LOG_FILE);
  } catch (error) {
    // Dosya yoksa, bu ilk kayıttır.
    return GENESIS_HASH;
  }

  const fileStream = createReadStream(AUDIT_LOG_FILE);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let lastLine = '';
  for await (const line of rl) {
    if (line.trim()) {
      lastLine = line;
    }
  }

  if (!lastLine) {
    return GENESIS_HASH;
  }

  try {
    const lastEntry = JSON.parse(lastLine);
    return lastEntry.hash;
  } catch (e) {
    console.error('Denetim logundaki son satır bozuk, genesis hash kullanılıyor.', e);
    return GENESIS_HASH;
  }
};

/**
 * Denetim loguna yeni bir olay kaydı ekler.
 * @param {object} eventData - Kaydedilecek olayın verileri.
 * @param {'stamp' | 'verify'} eventData.type - Olay türü.
 * @param {string} eventData.customerId - Müşteri ID'si.
 * @param {object} eventData.input - İşlem girdisi (örn: dosya adı).
 * @param {'success' | 'failed'} eventData.status - İşlem durumu.
 * @param {string} eventData.result - İşlem sonucu hakkında kısa bilgi.
 */
export const append = async (eventData) => {
  const previousHash = await getLastHash();

  const entry = {
    timestamp: new Date().toISOString(),
    ...eventData,
    previousHash,
  };

  // Kendi hash'ini hesaplarken 'hash' alanı dışarıda bırakılır.
  const entryHash = calculateHash(JSON.stringify(entry));
  
  // Tamamlanmış log kaydı
  const finalEntry = { ...entry, hash: entryHash };
  const logLine = JSON.stringify(finalEntry) + '\n';

  try {
    await fs.appendFile(AUDIT_LOG_FILE, logLine);
  } catch (error) {
    console.error('Denetim loguna yazılırken hata oluştu:', error);
  }
};

/**
 * Denetim log dosyasının bütünlüğünü doğrular.
 * @returns {Promise<{isValid: boolean, error: string|null}>} Doğrulama sonucu.
 */
export const verifyLog = async () => {
  try {
    await fs.access(AUDIT_LOG_FILE);
  } catch (error) {
    return { isValid: true, error: null }; // Dosya yoksa, geçerli kabul edilir.
  }
  
  const fileStream = createReadStream(AUDIT_LOG_FILE);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let previousHash = GENESIS_HASH;
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (e) {
      return { isValid: false, error: `Bütünlük Bozulmuş: Satır ${lineNumber} geçersiz JSON formatında.` };
    }

    if (entry.previousHash !== previousHash) {
      return { isValid: false, error: `Bütünlük Bozulmuş: Satır ${lineNumber}'deki 'previousHash' uyuşmuyor.` };
    }

    const { hash, ...entryWithoutHash } = entry;
    const expectedHash = calculateHash(JSON.stringify(entryWithoutHash));

    if (hash !== expectedHash) {
      return { isValid: false, error: `Bütünlük Bozulmuş: Satır ${lineNumber}'deki 'hash' hatalı hesaplanmış.` };
    }
    
    previousHash = hash;
  }

  return { isValid: true, error: null };
};

/**
 * Denetim log dosyasındaki tüm kayıtları okur ve bir dizi olarak döndürür.
 * @returns {Promise<object[]>} Tüm denetim logu girdilerinin dizisi.
 */
export const getAllEntries = async () => {
  const entries = [];
  try {
    await fs.access(AUDIT_LOG_FILE);
  } catch (error) {
    return entries; // Dosya yoksa boş dizi döndür.
  }

  const fileStream = createReadStream(AUDIT_LOG_FILE);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        console.error('Denetim logu okunurken bozuk satır atlandı:', line, e);
        // Bozuk satırları atlayarak devam et
      }
    }
  }

  return entries;
};