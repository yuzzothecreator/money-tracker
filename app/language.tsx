"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Language, locales, translate } from "../lib/i18n";
type LanguageContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  tr: (text: string) => string;
};
const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  locale: locales.en,
  setLanguage: () => {},
  tr: (text) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, update] = useState<Language>("en");
  useEffect(() => {
    const stored = localStorage.getItem("mf-language");
    if (stored === "en" || stored === "sw") update(stored);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function setLanguage(value: Language) {
    localStorage.setItem("mf-language", value);
    update(value);
  }
  return (
    <LanguageContext.Provider
      value={{
        language,
        locale: locales[language],
        setLanguage,
        tr: (text) => translate(text, language),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="language-toggle" role="group" aria-label="Language / Lugha">
      <button
        type="button"
        lang="en"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
      <button
        type="button"
        lang="sw"
        aria-pressed={language === "sw"}
        onClick={() => setLanguage("sw")}
      >
        SW
      </button>
    </div>
  );
}
