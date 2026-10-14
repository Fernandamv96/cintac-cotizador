import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { useLanguage } from "../api/LanguageContext.jsx";

export default function Admin() {
  const { t } = useLanguage();
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState({ usuarios: 0, cotizaciones: 0, activas: 0 });
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
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-sm font-bold uppercase text-[#c74a0b]">{t("CINTAC · Administración")}</p>
          <h2 className="mb-0 mt-2 text-3xl">{t("Panel administrativo")}</h2>
          <p className="mt-2 text-sm text-acero-claro">{usuario?.email}</p>
        </div>
        <nav className="flex flex-wrap gap-3" aria-label={t("Administración")}>
          <Link className="btn-secundario" to="/nueva">{t("Nueva cotización")}</Link>
          <Link className="btn-secundario" to="/historial">{t("Cotizaciones")}</Link>
          <Link className="btn-secundario" to="/admin/usuarios">{t("Usuarios")}</Link>
          <Link className="btn-secundario" to="/admin/auditoria">{t("Auditoría")}</Link>
        </nav>
      </div>

      {error && <p role="alert" className="mb-5 text-peligro">{t(error)}</p>}

      <p role="status" className="mb-5 rounded-md border border-amber-500/50 bg-amber-100/70 px-4 py-3 text-sm text-amber-950">
        {t("Importante: el almacenamiento actual es temporal y en memoria. En Vercel no garantiza sesiones simultáneas ni comparte usuarios y cotizaciones de forma fiable entre instancias; AWS aún está pendiente.")}
      </p>

      <section className="grid gap-4 sm:grid-cols-3" aria-label={t("Resumen del sistema")}>
        <div className="tarjeta">
          <p className="m-0 text-sm text-acero-claro">{t("Usuarios registrados")}</p>
          <p className="mb-0 mt-2 text-3xl font-bold text-acero">{resumen.usuarios}</p>
        </div>
        <div className="tarjeta">
          <p className="m-0 text-sm text-acero-claro">{t("Usuarios activos")}</p>
          <p className="mb-0 mt-2 text-3xl font-bold text-acero">{resumen.activas}</p>
        </div>
        <div className="tarjeta">
          <p className="m-0 text-sm text-acero-claro">{t("Cotizaciones visibles")}</p>
          <p className="mb-0 mt-2 text-3xl font-bold text-acero">{resumen.cotizaciones}</p>
        </div>
      </section>
    </main>
  );
}
