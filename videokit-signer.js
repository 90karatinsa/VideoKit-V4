// videokit-signer.js — COMPLETE REPLACEMENT (no static pkcs11js import)

/** Politika ihlali için özel hata */
export class PolicyViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyViolationError';
  }
}

/** HSM gerekiyorsa pkcs11js’i dinamik yükle */
async function _loadPkcs11() {
  try {
    const m = await import('pkcs11js'); // paket varsa getir
    const ns = m?.default ?? m;
    const P11Ctor =
      ns.Pkcs11 || ns.PKCS11 || ns.default?.Pkcs11 || ns.default?.PKCS11;
    if (!P11Ctor) throw new Error('pkcs11js export şekli desteklenmedi');
    return { P11Ctor, c: ns }; // c: CKM_*, CKF_*, CKO_*, CKU_* sabitleri
  } catch (err) {
    throw new Error(
      'HSM modunu kullanmak için "pkcs11js" gerekli. HSM kullanmıyorsan sorun yok; ' +
      'HSM kullanacaksan bu konteynerde build araçlarını kur (Alpine: apk add --no-cache python3 make g++) ' +
      've "npm i pkcs11js" yap. Aksi halde SIGNING_POLICY_HARDWARE_ONLY=false ile bellek imzalama kullan.'
    );
  }
}

/** Bellek/Vault tabanlı imzalayıcı */
async function createMemorySigner({ privateKey, certificate }) {
  console.log('[Signer] Bellek tabanlı (Vault) imzalayıcı kullanılıyor.');
  if (!privateKey || !certificate) {
    throw new Error('Bellek imzalayıcı için privateKey ve certificate PEM içeriği gereklidir.');
  }
  return { privateKey, certificate };
}

/** HSM (PKCS#11) tabanlı imzalayıcı */
async function createHsmSigner({ library, pin, slot = 0, keyLabel, certificate }) {
  console.log(`[Signer] HSM tabanlı imzalayıcı kullanılıyor. Kütüphane: ${library}`);

  // pkcs11js’i yalnızca burada yükle
  const { P11Ctor, c } = await _loadPkcs11();
  const pkcs11 = new P11Ctor();

  let session = null;
  try {
    pkcs11.load(library);
    pkcs11.C_Initialize();

    const slots = pkcs11.C_GetSlotList(true);
    if (slot >= slots.length) {
      throw new Error(`Yapılandırılan slot (${slot}) mevcut değil. Kullanılabilir slot sayısı: ${slots.length}`);
    }
    const slotId = slots[slot];

    const CKF_SERIAL_SESSION = c.CKF_SERIAL_SESSION ?? 4;
    const CKF_RW_SESSION     = c.CKF_RW_SESSION     ?? 2;
    const CKU_USER           = c.CKU_USER           ?? 1;
    const CKO_PRIVATE_KEY    = c.CKO_PRIVATE_KEY    ?? 4; // bazı paketlerde 3’tür; projede 4 kullanılıyordu

    session = pkcs11.C_OpenSession(slotId, CKF_SERIAL_SESSION | CKF_RW_SESSION);
    pkcs11.C_Login(session, CKU_USER, pin);
    console.log(`[Signer] HSM slot ${slot} için başarıyla oturum açıldı.`);

    const privateKeyHandle =
      pkcs11.C_FindObjects(session, [{ type: CKO_PRIVATE_KEY, label: keyLabel }])[0];
    if (!privateKeyHandle) {
      throw new Error(`HSM'de "${keyLabel}" etiketli özel anahtar bulunamadı.`);
    }
    console.log(`[Signer] "${keyLabel}" etiketli özel anahtar başarıyla bulundu.`);

    const mechanism = c.CKM_ECDSA_SHA256 ?? c.CKM_ECDSA;

    const sign = (dataToSign) => {
      pkcs11.C_SignInit(session, { mechanism }, privateKeyHandle);
      const signature = pkcs11.C_Sign(session, dataToSign);
      return Buffer.from(signature);
    };

    return { sign, certificate };
  } finally {
    if (session) {
      try { pkcs11.C_Logout(session); } catch {}
      try { pkcs11.C_CloseSession(session); } catch {}
    }
    try { pkcs11.C_Finalize(); } catch {}
    console.log('[Signer] HSM oturumu güvenli bir şekilde kapatıldı.');
  }
}

/** Uygun imzalayıcıyı seç ve döndür */
export async function getSigner(config = {}) {
  const isHardwareOnly = process.env.SIGNING_POLICY_HARDWARE_ONLY === 'true';

  // HSM yapılandırması varsa HSM kullan
  if (config.hsm && config.hsm.library && config.hsm.pin && config.hsm.keyLabel) {
    const certificate = config.key?.public;
    if (!certificate) {
      throw new Error('HSM imzalayıcı için sertifika içeriği (key.public) belirtilmelidir.');
    }
    return createHsmSigner({ ...config.hsm, certificate });
  }

  // Donanım zorunluysa ve yapılandırılmamışsa politikayı ihlal et
  if (isHardwareOnly) {
    throw new PolicyViolationError(
      'Politika ihlali: Donanım (HSM) zorunlu ancak yapılandırılmamış. ' +
      'Ya HSM ayarlarını gir ya da SIGNING_POLICY_HARDWARE_ONLY=false yap.'
    );
  }

  // Varsayılan: bellek (Vault/ENV) imzalayıcı
  const privateKey  = config.key?.private;
  const certificate = config.key?.public;
  return createMemorySigner({ privateKey, certificate });
}
