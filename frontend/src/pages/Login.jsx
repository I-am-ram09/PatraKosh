import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import Win from "../components/Win.jsx";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <Win title="login.exe" tone="navy" className="auth-card">
        <h1 className="auth-title">{t("login.title")}</h1>
        <p className="auth-sub">{t("login.sub")}</p>

        {error && <div className="error-banner">{error}</div>}

        <GoogleButton onError={setError} />
        <div className="or-divider"><span>{t("login.or")}</span></div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">{t("login.email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={onChange}
              placeholder={t("login.emailPh")}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("login.password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={onChange}
              placeholder={t("login.passwordPh")}
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : t("login.submit")}
          </button>
        </form>

        <p className="auth-switch">
          {t("login.switch")} <Link to="/signup">{t("login.switchLink")}</Link>
        </p>
      </Win>
    </div>
  );
}
