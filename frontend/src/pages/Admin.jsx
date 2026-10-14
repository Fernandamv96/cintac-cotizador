import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { useLanguage } from "../api/LanguageContext.jsx";
import { BlurText, CountUp, SpotlightCard } from "../components/bits.jsx";

export default function Admin() {
  const { t } = useLanguage();
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState({ usuarios: 0, cotizaciones: 0, activas: 0 });
  const [baseConectada, setBaseConectada] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarResumen() {
      try {
        const [usuarios, cotizaciones] = await Promise.all([
          api.listarUsuarios(),
          api.listarCotizaciones(),
        ]);
        setResumen({
          usuarios: usuarios.length,
          cotizaciones: cotizaciones.length,
          activas: usuarios.filter((item) => item.activo).length,
        });
      } catch (err) {
        setError(err.message);
      }
    }

    cargarResumen();
    api.salud()
      .then((datos) => setBaseConectada(Boolean(datos.ok)))
      .catch(() => setBaseConectada(false));
  }, []);

  const tarjetas = [
    { etiqueta: "Usuarios registrados", valor: resumen.usuarios },
    { etiqueta: "Usuarios activos", valor: resumen.activas },
    { etiqueta: "Cotizaciones visibles", valor: resumen.cotizaciones },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">{t("CINTAC · Administración")}</p>
          <BlurText as="h1" className="mb-0 mt-3 text-4xl" text={t("Panel administrativo")} />
          <p className="mt-2 text-sm text-acero-claro">{usuario?.email}</p>
        </div>
        <nav className="flex flex-wrap gap-3" aria-label={t("Administración")}>
          <Link className="btn-secundario" to="/nueva">{t("Nueva cotización")}</Link>
          <Link className="btn-secundario" to="/historial">{t("Cotizaciones")}</Link>
          <Link className="btn-secundario" to="/admin/usuarios">{t("Usuarios")}</Link>
          <Link className="btn-secundario" to="/admin/auditoria">{t("Auditoría")}</Link>
        </nav>
      </div>

      {error && <p role="alert" className="alerta mb-5">{t(error)}</p>}

      <p role="status" className="mb-6">
        <span className="chip">
          <span className={`chip__dot ${baseConectada ? "chip__dot--ok" : ""}`} />
          {baseConectada === null
            ? t("Verificando base de datos...")
            : baseConectada
              ? t("Base de datos PostgreSQL (Neon) conectada")
              : t("Sin conexión con la base de datos")}
        </span>
      </p>

      <section className="grid gap-4 sm:grid-cols-3" aria-label={t("Resumen del sistema")}>
        {tarjetas.map((tarjeta, i) => (
          <SpotlightCard key={tarjeta.etiqueta} className="fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="summary-label m-0">{t(tarjeta.etiqueta)}</p>
            <p className="summary-value mb-0 mt-4">
              <CountUp to={tarjeta.valor} duration={900} />
            </p>
          </SpotlightCard>
        ))}
      </section>
    </main>
  );
}
