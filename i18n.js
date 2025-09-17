import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const translations = {};
const defaultLang = 'en';

/**
 * Loads all translation files from the locales directory.
 */
export async function initI18n() {
    try {
        const localesDir = path.join(__dirname, 'public', 'locales');
        const files = await fs.readdir(localesDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const lang = file.slice(0, -5);
                const content = await fs.readFile(path.join(localesDir, file), 'utf-8');
                translations[lang] = JSON.parse(content);
            }
        }
        console.log(`✅ i18n: Diller yüklendi -> [${Object.keys(translations).join(', ')}]`);
    } catch (error) {
        console.error('❌ i18n: Dil dosyaları yüklenemedi:', error);
    }
}

/**
 * Gets the preferred language from the Accept-Language header.
 * @param {import('express').Request} req - The Express request object.
 * @returns {string} The determined language code.
 */
export function getLang(req) {
    const langHeader = req.get('Accept-Language');
    if (!langHeader) return defaultLang;
    
    // Basit bir parser: ilk dili alır (örn: "de-DE,de;q=0.9" -> "de")
    const preferredLang = langHeader.split(',')[0].split(';')[0].split('-')[0].toLowerCase();

    return translations[preferredLang] ? preferredLang : defaultLang;
}

/**
 * Translates a key into the specified language.
 * @param {string} key - The translation key (e.g., 'error_file_not_uploaded').
 * @param {string} lang - The language code (e.g., 'en', 'de').
 * @param {object} [replacements={}] - An object of placeholders to replace (e.g., { name: 'John' }).
 * @returns {string} The translated string.
 */
export function t(key, lang, replacements = {}) {
    const langToUse = translations[lang] ? lang : defaultLang;
    let text = translations[langToUse]?.[key] || key;

    for (const placeholder in replacements) {
        text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacements[placeholder]);
    }

    return text;
}