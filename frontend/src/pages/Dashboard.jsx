import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";
import { BlurText, CountUp, GradientText, SpotlightCard } from "../components/bits.jsx";

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
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="dashboard-hero">
        <div>
          <p className="kicker">{t("Cotizador CINTAC")}</p>
          <BlurText as="h1" className="dashboard-title" text={t("Hola, {name}", { name: usuario.nombre })} />
        </div>

        <div className="dashboard-actions fade-up" style={{ animationDelay: "200ms" }}>
          <Link to="/nueva" className="btn-primario hero-btn">
            {t("Nueva cotización")} <span aria-hidden="true">→</span>
          </Link>
          <Link to="/historial" className="btn-secundario hero-btn">
            {t("Ver historial")}
          </Link>
        </div>
      </div>

      <div className="summary-grid">
        <SpotlightCard className="summary-card fade-up" style={{ animationDelay: "100ms" }}>
          <span className="summary-label">{t("Dólar observado")}</span>
          {error && <p className="summary-error">{t(error)}</p>}
          {!error && !indicadores && <p className="summary-loading">{t("Cargando...")}</p>}
          {indicadores && (
            <p className="summary-value">
              <GradientText>
                $<CountUp
                  to={indicadores.dolarObservado.valor}
                  format={(n) => n.toLocaleString(LOCALES[language], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                />
              </GradientText>
              <small>CLP</small>
            </p>
          )}
          <small>{t("Fuente: Banco Central")}</small>
        </SpotlightCard>

        <SpotlightCard as={Link} to="/nueva" className="summary-card fade-up" style={{ animationDelay: "180ms" }}>
          <span className="summary-label">{t("Cotizaciones")}</span>
          <div>
            <h3>{t("Rápidas")}</h3>
            <p>{t("Genera un cálculo operativo en pocos segundos.")}</p>
          </div>
          <span className="summary-card__flecha" aria-hidden="true">↗</span>
        </SpotlightCard>

        <SpotlightCard as={Link} to="/historial" className="summary-card fade-up" style={{ animationDelay: "260ms" }}>
          <span className="summary-label">{t("Control")}</span>
          <div>
            <h3>{t("Visual")}</h3>
            <p>{t("Revisa historial, compara y toma decisiones.")}</p>
          </div>
          <span className="summary-card__flecha" aria-hidden="true">↗</span>
        </SpotlightCard>
      </div>
    </main>
  );
}
