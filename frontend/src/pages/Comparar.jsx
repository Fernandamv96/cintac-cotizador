import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/api.js";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";

export default function Comparar() {
  const { language, t } = useLanguage();
  const [params] = useSearchParams();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const ids = params.get("ids")?.split(",").filter(Boolean) || [];
    if (ids.length < 2) {
      setError(t("Selecciona al menos dos cotizaciones desde el Historial para compararlas."));
      return;
    }
    api
      .compararCotizaciones(ids)
      .then(setCotizaciones)
      .catch((err) => setError(err.message));
  }, [params]);

  const clp = (v) => (v ? `$${v.toLocaleString(LOCALES[language])} CLP` : t("Sin calcular"));
  const filas = [
    { etiqueta: t("Embarcador"), clave: "proveedor" },
    { etiqueta: t("Peso (kg)"), clave: "cantidad", formato: (v) => Number(v || 0).toLocaleString(LOCALES[language]) },
    { etiqueta: t("Contenedores"), clave: "cantidadContenedores", formato: (v, c) => `${v} × ${c.tipoContenedor}'` },
    { etiqueta: t("Flete (US$)"), clave: "tarifaFleteMinUSD", formato: (v, c) => `${Number(v).toLocaleString(LOCALES[language])} – ${Number(c.tarifaFleteMaxUSD).toLocaleString(LOCALES[language])}` },
    { etiqueta: t("Tránsito con contingencia"), clave: "tiempoTransitoMaxDias", formato: (v, c) => `${c.tiempoTransitoMinDias + (c.margenDias || 0)}–${v + (c.margenDias || 0)} ${t("días")}` },
    { etiqueta: t("Estado"), clave: "estado", formato: (valor) => t(valor) },
    { etiqueta: t("Costo total"), clave: "costoTotalCLP", formato: clp },
    { etiqueta: t("Costo por kg"), clave: "precioUnitarioFinalCLP", formato: clp },
  ];

  const vencida = (c) =>
    c.fechaTipoCambio && (Date.now() - new Date(c.fechaTipoCambio).getTime()) / 36e5 > 24;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="text-2xl font-semibold">{t("Comparar cotizaciones")}</h2>

      {error && <p className="mt-4 text-peligro">{t(error)}</p>}

      {cotizaciones.length > 0 && (
        <div className="tarjeta mt-6 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-lg">
            <thead>
              <tr>
                <th className="border-b-2 border-acero-claro/30 py-2 pr-4 text-acero">{t("Ruta")}</th>
                {cotizaciones.map((c) => (
                  <th key={c._id} className="border-b-2 border-acero-claro/30 py-2 pr-4 text-acero">
                    {`${c.puertoOrigen} → ${c.puertoDestino}`}
                    {vencida(c) && (
                      <span className="ml-2 block text-sm font-normal text-peligro">
                        {t("Cotización vencida")}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.clave}>
                  <td className="border-b border-acero-claro/15 py-2 pr-4 font-medium">
                    {fila.etiqueta}
                  </td>
                  {cotizaciones.map((c) => (
                    <td key={c._id} className="border-b border-acero-claro/15 py-2 pr-4">
                      {fila.formato ? fila.formato(c[fila.clave], c) : c[fila.clave] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
