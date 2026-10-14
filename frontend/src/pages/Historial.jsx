import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";

export default function Historial() {
  const { usuario } = useAuth();
  const { language, t } = useLanguage();
  const esAdmin = ["ADMIN", "SUPERADMIN", "administrador"].includes(usuario?.rol);
  const [proveedor, setProveedor] = useState("");
  const [puertoOrigen, setPuertoOrigen] = useState("");
  const [puertoDestino, setPuertoDestino] = useState("");
  const [cotizaciones, setCotizaciones] = useState([]);
  const [error, setError] = useState("");
  const [seleccionadas, setSeleccionadas] = useState([]);

  async function buscar(e) {
    e?.preventDefault();
    setError("");
    try {
      const resultado = await api.listarCotizaciones({ proveedor, puertoOrigen, puertoDestino });
      setCotizaciones(resultado);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    buscar();
    const id = window.setInterval(() => {
      buscar();
    }, 30000);

    return () => window.clearInterval(id);
  }, [proveedor, puertoOrigen, puertoDestino]);

  function alternarSeleccion(id) {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function eliminarCotizacion(cotizacion) {
    if (!window.confirm(t("¿Confirmas eliminar esta cotización? Esta acción no se puede deshacer."))) return;
    const passwordActual = window.prompt(t("Confirma esta acción con tu contraseña actual:"));
    if (!passwordActual) return;
    try {
      await api.eliminarCotizacion(cotizacion._id, { passwordActual });
      setCotizaciones((prev) => prev.filter((item) => item._id !== cotizacion._id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="text-2xl font-semibold">{t("Historial de cotizaciones")}</h2>
      <p className="mt-1 text-lg text-acero-claro">
        {t("Busca por proveedor o ruta para revisar cotizaciones anteriores.")}
      </p>

      <form onSubmit={buscar} className="tarjeta mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="fProveedor">{t("Proveedor")}</label>
          <input id="fProveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </div>
        <div>
          <label htmlFor="fPuertoOrigen">{t("Puerto de origen")}</label>
          <input id="fPuertoOrigen" value={puertoOrigen} onChange={(e) => setPuertoOrigen(e.target.value)} />
        </div>
        <div>
          <label htmlFor="fPuertoDestino">{t("Puerto de destino")}</label>
          <input id="fPuertoDestino" value={puertoDestino} onChange={(e) => setPuertoDestino(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primario w-full">
            {t("Buscar")}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 text-peligro">{t(error)}</p>}

      {seleccionadas.length >= 2 ? (
        <Link
          to={`/comparar?ids=${seleccionadas.join(",")}`}
          className="btn-secundario mt-4 inline-flex"
        >
          {t("Comparar cotizaciones ({count})", { count: seleccionadas.length })}
        </Link>
      ) : (
        <button type="button" disabled className="btn-secundario mt-4 inline-flex cursor-not-allowed opacity-50">
          {t("Comparar cotizaciones (selecciona 2)")}
        </button>
      )}

      <div className="mt-6 space-y-4">
        {cotizaciones.length === 0 && (
          <p className="text-acero-claro">{t("No hay cotizaciones registradas con ese filtro.")}</p>
        )}
        {cotizaciones.map((c) => {
          const vencida =
            c.fechaTipoCambio &&
            (Date.now() - new Date(c.fechaTipoCambio).getTime()) / 36e5 > 24 &&
            c.estado !== "finalizada";
          return (
            <div key={c._id} className="tarjeta flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 !w-auto"
                  checked={seleccionadas.includes(c._id)}
                  onChange={() => alternarSeleccion(c._id)}
                />
                <span>
                  <strong>{c.puertoOrigen ? `${c.puertoOrigen} → ${c.puertoDestino || t("Destino pendiente")}` : c.producto || t("Cotización antigua")}</strong> — {c.proveedor}
                  <br />
                  <span className="text-sm text-acero-claro">{t("Cantidad:")} {c.cantidad} kg</span>
                  <br />
                  <span className="text-sm text-acero-claro">
                    {t("Contenedor:")} {c.cantidadContenedores || 1} × {c.tipoContenedor ? `${c.tipoContenedor}'` : "—"}
                    {c.tarifaFleteMinUSD != null && (
                      <> · {t("Flete:")} US${c.tarifaFleteMinUSD.toLocaleString(LOCALES[language])}–US${c.tarifaFleteMaxUSD.toLocaleString(LOCALES[language])}</>
                    )}
                  </span>
                  <br />
                  {esAdmin && (c.creadoPorNombre || c.creadoPorEmail) && (
                    <>
                      <span className="text-sm font-semibold text-acero">
                        {t("Creada por:")} {c.creadoPorNombre || c.creadoPorEmail}
                        {c.creadoPorNombre && c.creadoPorEmail ? ` · ${c.creadoPorEmail}` : ""}
                      </span>
                      <br />
                    </>
                  )}
                  <span className="text-sm text-acero-claro">
                    {new Date(c.createdAt).toLocaleDateString(LOCALES[language])} · {t("Estado:")} {t(c.estado)}
                    {vencida && <span className="ml-2 text-peligro">· {t("Tipo de cambio vencido")}</span>}
                  </span>
                </span>
              </label>
              {c.costoTotalCLP && (
                <span className="text-lg font-semibold text-acero">
                  ${c.costoTotalCLP.toLocaleString(LOCALES[language])} CLP
                </span>
              )}
              {esAdmin && (
                <button type="button" className="btn-secundario px-3 py-2" onClick={() => eliminarCotizacion(c)}>
                  {t("Eliminar")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
