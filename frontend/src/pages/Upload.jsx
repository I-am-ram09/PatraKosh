import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useLang } from "../i18n/index.jsx";
import Win from "../components/Win.jsx";

export default function Upload() {
  const navigate = useNavigate();
  const { t } = useLang();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [credentials, setCredentials] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^/.]+$/, ""));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError(t("upload.chooseFile"));
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("credentials", credentials);
      if (expiryDate) formData.append("expiryDate", expiryDate);

      await api.post("/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container upload-shell">
      <h1 className="page-title" style={{ marginBottom: 6 }}>{t("upload.title")}</h1>
      <p className="page-sub" style={{ marginBottom: 26 }}>
        {t("upload.sub")}
      </p>

      {error && <div className="error-banner">{error}</div>}

      <Win title="upload.exe" tone="mustard" className="upload-win">
      <form onSubmit={onSubmit}>
        <div
          className={`dropzone ${file ? "has-file" : ""}`}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files[0]);
          }}
        >
          <div className="icon">{file ? "✅" : "📄"}</div>
          <p style={{ fontWeight: 600 }}>{file ? file.name : t("upload.drop")}</p>
          {!file && <p className="field-hint">{t("upload.dropHint")}</p>}
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => pickFile(e.target.files[0])}
          />
        </div>

        <div className="field">
          <label htmlFor="name">{t("upload.nameLabel")}</label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("upload.namePh")}
          />
        </div>

        <div className="field">
          <label htmlFor="credentials">{t("upload.credLabel")}</label>
          <textarea
            id="credentials"
            rows={2}
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            placeholder={t("upload.credPh")}
          />
        </div>

        <div className="field">
          <label htmlFor="expiry">{t("upload.expiryLabel")}</label>
          <input
            id="expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <span className="field-hint">
            {t("upload.expiryHint")}
          </span>
        </div>

        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : t("upload.submit")}
        </button>
      </form>
      </Win>
    </main>
  );
}
