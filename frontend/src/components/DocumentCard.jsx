import React, { useState } from "react";
import api, { apiUrl, clearPinToken, getErrorMessage, getErrorMessageAsync } from "../api";
import { useLang } from "../i18n/index.jsx";
import { usePin } from "../pin/PinContext.jsx";
import Win from "./Win.jsx";

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const TONE = { active: "mint", expiring_soon: "mustard", expired: "tomato" };

export default function DocumentCard({ doc, onDeleted, onToast }) {
  const { t } = useLang();
  const { ensureUnlocked } = usePin();
  const [busy, setBusy] = useState("");

  // Runs a request that needs the PIN. If the PIN session has timed out on the server,
  // ask again once and retry.
  const withPin = async (request) => {
    if (!(await ensureUnlocked())) return null;
    try {
      return await request();
    } catch (err) {
      const code = err?.response?.data?.code;
      const blobCode = async () => {
        try {
          const d = err.response.data;
          return d instanceof Blob ? JSON.parse(await d.text()).code : null;
        } catch {
          return null;
        }
      };
      if (code === "PIN_REQUIRED" || (await blobCode()) === "PIN_REQUIRED") {
        clearPinToken();
        if (!(await ensureUnlocked())) return null;
        return await request();
      }
      throw err;
    }
  };

  // Files are fetched from cloud storage through the API, so this works on any device you log in from.
  const openBlob = async (mode) => {
    setBusy(mode);
    try {
      const res = await withPin(() => api.get(`/documents/${doc.id}/${mode}`, { responseType: "blob" }));
      if (!res) return;
      const url = URL.createObjectURL(res.data);
      if (mode === "preview") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.originalFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      onToast(await getErrorMessageAsync(err));
    } finally {
      setBusy("");
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const res = await withPin(() => api.post(`/documents/${doc.id}/share`));
      if (!res) return;
      await navigator.clipboard.writeText(apiUrl(`/share/${res.data.shareToken}/download`));
      onToast(t("doc.shareCopied"));
    } catch (err) {
      onToast(getErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(t("doc.confirmDelete", { name: doc.name }))) return;
    setBusy("delete");
    try {
      await api.delete(`/documents/${doc.id}`);
      onDeleted(doc.id);
    } catch (err) {
      onToast(getErrorMessage(err));
      setBusy("");
    }
  };

  return (
    <Win title={`🔒 ${doc.originalFilename}`} tone={TONE[doc.status] || "navy"} className="doc-card">
      <div className="doc-main">
        <span className="doc-name">{doc.name}</span>
        <div className="doc-meta">
          <span>{doc.originalFilename}</span>
          <span>{formatSize(doc.sizeBytes)}</span>
          {doc.expiryDate && (
            <span>
              {t("doc.expires", { date: doc.expiryDate })}
              {doc.status !== "expired" && ` (${t("doc.daysLeft", { n: doc.daysLeft })})`}
            </span>
          )}
          {doc.credentials && <span>{t("doc.credentials", { value: doc.credentials })}</span>}
        </div>
        <span className={`badge badge-${doc.status}`}>
          <span className="badge-dot" />
          {t(`status.${doc.status}`)}
        </span>
      </div>

      <div className="doc-actions">
        <button className="btn btn-sm" disabled={!!busy} onClick={() => openBlob("preview")}>
          {busy === "preview" ? <span className="spinner dark" /> : t("doc.preview")}
        </button>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => openBlob("download")}>
          {busy === "download" ? <span className="spinner dark" /> : t("doc.download")}
        </button>
        <button className="btn btn-sm btn-yellow" disabled={!!busy} onClick={share}>
          {busy === "share" ? <span className="spinner dark" /> : t("doc.share")}
        </button>
        <button className="btn btn-sm btn-danger" disabled={!!busy} onClick={remove}>
          {busy === "delete" ? <span className="spinner" /> : t("doc.delete")}
        </button>
      </div>
    </Win>
  );
}
