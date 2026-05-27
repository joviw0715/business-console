'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Lang, LANGUAGES, t } from '@/lib/translations';

const STORAGE_KEY = 'bc-lang';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  T: typeof t[Lang];
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  T: t.en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, T: t[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
