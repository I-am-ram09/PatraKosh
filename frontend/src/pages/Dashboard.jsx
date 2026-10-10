import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";
import StatCard from "../components/StatCard.jsx";
import DocumentCard from "../components/DocumentCard.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring_soon: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.get("/documents"),
        api.get("/documents/stats"),
      ]);
      setDocs(docsRes.data.documents);
      setStats(statsRes.data.stats);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleDeleted = (id) => {
    setDocs((d) => d.filter((doc) => doc.id !== id));
    setStats((s) => {
      const doc = docs.find((d) => d.id === id);
      if (!doc) return s;
      return { ...s, total: s.total - 1, [doc.status]: Math.max(0, s[doc.status] - 1) };
    });
    setToast(t("dash.deleted"));
  };

  const filtered = filter === "all" ? docs : docs.filter((d) => d.status === filter);
  const filterLabel = (f) => (f === "all" ? t("filter.all") : t(`status.${f}`));

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("dash.hey", { name: user?.name?.split(" ")[0] || "" })}</h1>
          <p className="page-sub">{t("dash.sub")}</p>
        </div>
        <Link to="/upload" className="btn btn-primary">{t("dash.upload")}</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-grid">
        <StatCard label={t("dash.total")} value={stats.total} highlight />
        <StatCard label={t("status.active")} value={stats.active} tone="mint" />
        <StatCard label={t("status.expiring_soon")} value={stats.expiring_soon} tone="mustard" />
        <StatCard label={t("status.expired")} value={stats.expired} tone="tomato" />
      </div>

      <div className="doc-actions" style={{ marginBottom: 18 }}>
        {["all", "active", "expiring_soon", "expired"].map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? "btn-primary" : ""}`}
            onClick={() => setFilter(f)}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      {loading ? (
        <p>{t("dash.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{docs.length === 0 ? t("dash.emptyTitle") : t("dash.filterEmptyTitle")}</h3>
          <p>{docs.length === 0 ? t("dash.emptyText") : t("dash.filterEmptyText")}</p>
        </div>
      ) : (
        <div className="doc-list">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDeleted={handleDeleted} onToast={setToast} />
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
