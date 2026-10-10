import React from "react";
import api from "../api";
import { useAuth } from "../App.jsx";
import { LANGUAGES, useLang } from "../i18n/index.jsx";

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  const { user } = useAuth();

  const onChange = (e) => {
    const next = e.target.value;
    setLang(next);
    // Keep the account's language in sync so reminder emails use it too.
    if (user) api.patch("/auth/language", { lang: next }).catch(() => {});
  };

  return (
    <select className="lang-select" value={lang} onChange={onChange} aria-label={t("nav.language")}>
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
