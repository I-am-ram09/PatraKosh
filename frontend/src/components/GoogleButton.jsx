import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function GoogleButton({ onError }) {
  const ref = useRef(null);
  const { login } = useAuth();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const [state, setState] = useState("loading");

  // Re-renders the Google button in the chosen language (Google supports en / hi / mr).
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/config");
        if (!data.googleClientId) return !dead && setState("off");
        await loadGsi();
        if (dead) return;
        window.google.accounts.id.initialize({
          client_id: data.googleClientId,
          callback: async ({ credential }) => {
            try {
              const res = await api.post("/auth/google", { credential });
              login(res.data.token, res.data.user);
              navigate("/dashboard");
            } catch (err) {
              onError?.(getErrorMessage(err));
            }
          },
        });
        if (ref.current) ref.current.innerHTML = "";
        window.google.accounts.id.renderButton(ref.current, {
          theme: "filled_blue", size: "large", shape: "rectangular", text: "continue_with", width: 320, locale: lang,
        });
        setState("ready");
      } catch {
        !dead && setState("off");
      }
    })();
    return () => { dead = true; };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "off") return <p className="field-hint">{t("google.off")}</p>;
  return <div className="google-frame"><div ref={ref} /></div>;
}
