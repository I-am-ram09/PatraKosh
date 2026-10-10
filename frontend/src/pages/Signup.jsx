import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { useAuth } from "../App.jsx";
import { useLang } from "../i18n/index.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import Win from "../components/Win.jsx";

export default function Signup() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", form);
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
      <Win title="signup.exe" tone="plum" className="auth-card">
        <h1 className="auth-title">{t("signup.title")}</h1>
        <p className="auth-sub">{t("signup.sub")}</p>

        {error && <div className="error-banner">{error}</div>}

        <GoogleButton onError={setError} />
        <div className="or-divider"><span>{t("login.or")}</span></div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">{t("signup.name")}</label>
            <input id="name" name="name" required value={form.name} onChange={onChange} placeholder={t("signup.namePh")} />
          </div>
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
            <span className="field-hint">{t("signup.emailHint")}</span>
          </div>
          <div className="field">
            <label htmlFor="password">{t("login.password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={onChange}
              placeholder={t("signup.passwordPh")}
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : t("signup.submit")}
          </button>
        </form>

        <p className="auth-switch">
          {t("signup.switch")} <Link to="/login">{t("signup.switchLink")}</Link>
        </p>
      </Win>
    </div>
  );
}
