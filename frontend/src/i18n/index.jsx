import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./en.js";
import hi from "./hi.js";
import mr from "./mr.js";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
];

const DICTS = { en, hi, mr };
const STORAGE_KEY = "patrakosh_lang";

function detectInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* storage unavailable - fall through */
  }
  const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
  return DICTS[browser] ? browser : "en";
}

// Kept at module level so non-React code (like API error messages) can translate too.
let currentLang = detectInitial();

export const getLang = () => currentLang;

export function translate(key, vars) {
  const raw = DICTS[currentLang][key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

const LangContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

  useEffect(() => {
    document.documentElement.lang = lang; // drives the Devanagari font + spacing rules in index.css
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setLangState(next);
  }, []);

  // New function identity on every language change so every component using it re-renders.
  const t = useCallback((key, vars) => translate(key, vars), [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
