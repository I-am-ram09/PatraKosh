import React, { useEffect, useRef, useState } from "react";
import api, { getErrorMessage } from "../api";

const MIN = 4;
const MAX = 6;

// A retro "window" with a PIN display and an on-screen keypad. Typing on a keyboard works too.
// Steps: enter -> (create: confirm) | (change: current -> new -> confirm) | forgot -> reset
export default function PinModal({ mode, t, onDone, onCancel }) {
  // step: "enter" | "current" | "new" | "confirm" | "forgot"
  const first = mode === "change" ? "current" : mode === "create" ? "new" : "enter";
  const [step, setStep] = useState(first);
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState({ current: "", fresh: "" });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    boxRef.current?.focus();
    const onKey = (e) => {
      if (step === "forgot") return;
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onCancel]);

  const titles = {
    enter: t("pin.verifyTitle"),
    current: t("pin.changeTitle"),
    new: mode === "change" ? t("pin.changeTitle") : t("pin.createTitle"),
    confirm: mode === "change" ? t("pin.changeTitle") : t("pin.confirmTitle"),
    forgot: t("pin.resetTitle"),
  };
  const subs = {
    enter: t("pin.verifySub"),
    current: t("pin.changeCurrentSub"),
    new: mode === "change" ? t("pin.changeNewSub") : t("pin.createSub"),
    confirm: t("pin.confirmSub"),
    forgot: t("pin.resetSub"),
  };
  const nextLabel = step === "enter" ? t("pin.unlock") : step === "confirm" ? t("pin.save") : t("pin.next");

  const press = (d) => {
    setError("");
    setPin((p) => (p.length < MAX ? p + d : p));
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const submit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    if (step === "forgot") return submitReset();
    if (pin.length < MIN) return;
    setError("");

    try {
      if (step === "enter") {
        setBusy(true);
        const { data } = await api.post("/pin/verify", { pin });
        return onDone(data.pinToken, data.expiresInSec);
      }
      if (step === "current") {
        setSaved({ ...saved, current: pin });
        setPin("");
        return setStep("new");
      }
      if (step === "new") {
        setSaved({ ...saved, fresh: pin });
        setPin("");
        return setStep("confirm");
      }
      if (step === "confirm") {
        if (pin !== saved.fresh) {
          setPin("");
          setSaved({ ...saved, fresh: "" });
          setStep("new");
          return setError(t("pin.mismatch"));
        }
        setBusy(true);
        const { data } =
          mode === "change"
            ? await api.post("/pin/change", { currentPin: saved.current, newPin: pin })
            : await api.post("/pin/set", { pin });
        return onDone(data.pinToken, data.expiresInSec);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setPin("");
      // A wrong "current PIN" while changing: go back to that step.
      if (step === "confirm" && mode === "change") {
        setSaved({ current: "", fresh: "" });
        setStep("current");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (pin.length < MIN) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/pin/reset", { password, newPin: pin });
      onDone(data.pinToken, data.expiresInSec);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const goForgot = () => {
    setPin("");
    setError("");
    setStep("forgot");
  };

  return (
    <div className="pin-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="win pin-win" onSubmit={submit}>
        <div className="win-title">
          <span>🔒 {titles[step]}</span>
          <button type="button" className="win-x" onClick={onCancel} aria-label={t("pin.cancel")}>
            ✕
          </button>
        </div>
        <div className="win-body">
          <p className="pin-sub">{subs[step]}</p>

          {step === "forgot" && (
            <div className="field">
              <label htmlFor="pin-pass">{t("pin.passwordLabel")}</label>
              <input
                id="pin-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordPh")}
                autoComplete="current-password"
              />
              <span className="field-hint">{t("pin.resetSubGoogle")}</span>
            </div>
          )}

          {step === "forgot" && <label className="pin-label">{t("pin.newPinLabel")}</label>}

          {/* Hidden input captures the physical keyboard / mobile numeric keypad. */}
          <div className="pin-display" onClick={() => boxRef.current?.focus()}>
            {Array.from({ length: MAX }).map((_, i) => (
              <span key={i} className={`pin-dot ${i < pin.length ? "on" : ""} ${i >= MIN ? "opt" : ""}`} />
            ))}
            <input
              ref={boxRef}
              className="pin-capture"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              type="password"
              maxLength={MAX}
              value={pin}
              onChange={(e) => {
                setError("");
                setPin(e.target.value.replace(/\D/g, "").slice(0, MAX));
              }}
              aria-label="PIN"
            />
          </div>

          {error && <div className="error-banner pin-error">{error}</div>}

          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button type="button" className="btn key" key={d} onClick={() => press(d)}>
                {d}
              </button>
            ))}
            <button type="button" className="btn key key-alt" onClick={() => setPin("")} aria-label="clear">
              C
            </button>
            <button type="button" className="btn key" onClick={() => press("0")}>
              0
            </button>
            <button type="button" className="btn key key-alt" onClick={back} aria-label="backspace">
              ⌫
            </button>
          </div>

          <div className="pin-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || pin.length < MIN}>
              {busy ? <span className="spinner" /> : step === "forgot" ? t("pin.save") : nextLabel}
            </button>
            {step === "forgot" ? (
              <button type="button" className="btn" onClick={() => setStep("enter")}>
                {t("pin.back")}
              </button>
            ) : (
              <button type="button" className="btn" onClick={onCancel}>
                {t("pin.cancel")}
              </button>
            )}
          </div>

          {step === "enter" && (
            <button type="button" className="pin-forgot" onClick={goForgot}>
              {t("pin.forgot")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
