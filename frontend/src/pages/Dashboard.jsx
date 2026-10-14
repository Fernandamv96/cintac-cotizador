import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";

export default function Dashboard() {
  const { usuario } = useAuth();
  const { language, t } = useLanguage();
  const [indicadores, setIndicadores] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarIndicadores() {
      try {
        const datos = await api.obtenerIndicadores();
        setIndicadores(datos);
        setError("");
      } catch (err) {
        setError(err.message);
      }
    }

    cargarIndicadores();
    const intervalo = window.setInterval(cargarIndicadores, 30 * 60 * 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="dashboard-shell">
        <div className="dashboard-hero">
          <div>
            <p className="dashboard-kicker">{t("Cotizador CINTAC")}</p>
            <h2 className="dashboard-title">{t("Hola, {name}", { name: usuario.nombre })}</h2>
          </div>

          <div className="dashboard-actions">
            <Link to="/nueva" className="btn-primario hero-btn">
              {t("Nueva cotización")}
            </Link>
            <Link to="/historial" className="btn-secundario hero-btn">
              {t("Ver historial")}
            </Link>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card summary-card--accent">
            <span className="summary-label">{t("Dólar observado")}</span>
            {error && <p className="summary-error">{t(error)}</p>}
            {!error && !indicadores && <p className="summary-loading">{t("Cargando...")}</p>}
            {indicadores && (
              <p className="summary-value">
                ${indicadores.dolarObservado.valor.toLocaleString(LOCALES[language])}
                <span>CLP</span>
              </p>
            )}
            <small>{t("Fuente: Banco Central")}</small>
          </div>

          <div className="summary-card summary-card--dark">
            <span className="summary-label">{t("Cotizaciones")}</span>
            <h3>{t("Rápidas")}</h3>
            <p>{t("Genera un cálculo operativo en pocos segundos.")}</p>
          </div>

          <div className="summary-card summary-card--dark">
            <span className="summary-label">{t("Control")}</span>
            <h3>{t("Visual")}</h3>
            <p>{t("Revisa historial, compara y toma decisiones.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
