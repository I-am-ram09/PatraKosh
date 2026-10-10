import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import api, { clearPinToken, getErrorMessage, isPinUnlocked, setPinToken } from "../api";
import { useLang } from "../i18n/index.jsx";
import PinModal from "./PinModal.jsx";

const PinContext = createContext(null);
export const usePin = () => useContext(PinContext);

// ensureUnlocked() -> Promise<boolean>. Resolves true once the PIN session is open
// (asking for / creating the PIN first if needed), false if the person cancels.
export function PinProvider({ children }) {
  const { t } = useLang();
  const [modal, setModal] = useState(null); // { mode: "create" | "verify" | "change" }
  const resolver = useRef(null);

  const open = (mode) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setModal({ mode });
    });

  const finish = useCallback((ok) => {
    setModal(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const ensureUnlocked = useCallback(async () => {
    if (isPinUnlocked()) return true;
    let hasPin = true;
    try {
      hasPin = (await api.get("/pin/status")).data.hasPin;
    } catch (err) {
      alert(getErrorMessage(err));
      return false;
    }
    return open(hasPin ? "verify" : "create");
  }, []);

  const changePin = useCallback(async () => {
    let hasPin = true;
    try {
      hasPin = (await api.get("/pin/status")).data.hasPin;
    } catch (err) {
      alert(getErrorMessage(err));
      return false;
    }
    return open(hasPin ? "change" : "create");
  }, []);

  const lock = useCallback(() => clearPinToken(), []);

  const value = { ensureUnlocked, changePin, lock, isUnlocked: isPinUnlocked };

  return (
    <PinContext.Provider value={value}>
      {children}
      {modal && (
        <PinModal
          mode={modal.mode}
          t={t}
          onDone={(token, expiresInSec) => {
            setPinToken(token, expiresInSec);
            finish(true);
          }}
          onCancel={() => finish(false)}
        />
      )}
    </PinContext.Provider>
  );
}
