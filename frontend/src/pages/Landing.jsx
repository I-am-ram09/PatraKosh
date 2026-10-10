import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";
import Win from "../components/Win.jsx";

// Splits text into user-perceived characters so Hindi/Marathi letters + matras are never cut in half.
function splitGraphemes(str, lang) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter(lang, { granularity: "grapheme" }).segment(str), (s) => s.segment);
  }
  return Array.from(str);
}

function useTypewriter(phrases, lang, typeSpeed = 55, pause = 1400) {
  const [count, setCount] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const graphemes = useMemo(() => phrases.map((p) => splitGraphemes(p, lang)), [phrases, lang]);

  // Start over whenever the language changes.
  useEffect(() => {
    setCount(0);
    setPhraseIndex(0);
    setDeleting(false);
  }, [lang]);

  useEffect(() => {
    const current = graphemes[phraseIndex % graphemes.length];
    let timeout;

    if (!deleting && count < current.length) {
      timeout = setTimeout(() => setCount(count + 1), typeSpeed);
    } else if (!deleting && count === current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && count > 0) {
      timeout = setTimeout(() => setCount(count - 1), typeSpeed / 2);
    } else if (deleting && count === 0) {
      setDeleting(false);
      setPhraseIndex((i) => i + 1);
    }

    return () => clearTimeout(timeout);
  }, [count, deleting, phraseIndex, graphemes, typeSpeed, pause]);

  return graphemes[phraseIndex % graphemes.length].slice(0, count).join("");
}

export default function Landing() {
  const { user } = useAuth();
  const { lang, t } = useLang();

  const phrases = useMemo(
    () => [t("landing.phrase1"), t("landing.phrase2"), t("landing.phrase3"), t("landing.phrase4")],
    [t]
  );
  const typed = useTypewriter(phrases, lang);

  const tones = ["navy", "tomato", "plum", "mustard"];

  return (
    <main className="landing">
      <section className="hero">
        <Win title="PatraKosh.exe" className="hero-win" bodyClass="hero-body">
          <h1 className="hero-title">
            Patra<span className="accent">Kosh</span>
          </h1>
          <div className="hero-deva" aria-hidden="true">पत्रकोश</div>

          <div className="typewriter-wrap">
            {typed}
            <span className="typewriter-cursor">&nbsp;</span>
          </div>

          <p className="hero-info">{t("landing.info")}</p>

          <div className="hero-actions">
            <Link to={user ? "/dashboard" : "/signup"} className="btn btn-primary">
              {user ? t("landing.ctaDashboard") : t("landing.ctaStart")}
            </Link>
            <a href="#how-it-works" className="btn">{t("landing.how")}</a>
          </div>
        </Win>
      </section>

      <section id="how-it-works" className="feature-grid">
        {[1, 2, 3, 4].map((n) => (
          <Win key={n} title={`0${n}.txt`} tone={tones[n - 1]} className={`feature-card r${n}`}>
            <div className="feature-num">{n}</div>
            <h3>{t(`landing.f${n}Title`)}</h3>
            <p>{t(`landing.f${n}Text`)}</p>
          </Win>
        ))}
      </section>
    </main>
  );
}
