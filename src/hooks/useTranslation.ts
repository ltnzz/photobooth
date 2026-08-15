import { useState, useEffect, useCallback } from 'react';
import { translations } from '../locales/translations';
import type { TranslationKeys, Language } from '../locales/translations';

const LOCAL_STORAGE_KEY = 'photobooth_lang';

export function useTranslation() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return (saved === 'id' || saved === 'en') ? (saved as Language) : 'en';
  });

  const t = useCallback((key: TranslationKeys): string => {
    const translation = translations[lang]?.[key] ?? translations['en']?.[key];
    return translation ?? key;
  }, [lang]);

  const changeLanguage = useCallback((newLang: Language) => {
    setLang(newLang);
    localStorage.setItem(LOCAL_STORAGE_KEY, newLang);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'id')) {
        setLang(e.newValue as Language);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return { t, lang, changeLanguage };
}
