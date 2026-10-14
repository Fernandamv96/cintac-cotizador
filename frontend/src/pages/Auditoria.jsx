import React, { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";

export default function Auditoria() {
  const { language, t } = useLanguage();
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listarAuditoria()
      .then(setEventos)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="m-0 text-sm font-bold uppercase text-[#c74a0b]">{t("CINTAC · Administración")}</p>
      <h2 className="mb-0 mt-2 text-3xl">{t("Auditoría")}</h2>
      {error && <p role="alert" className="mt-5 text-peligro">{t(error)}</p>}
      {!error && eventos.length === 0 && <p className="mt-5 text-acero-claro">{t("No hay actividad registrada.")}</p>}
      {eventos.length > 0 && (
        <div className="tarjeta mt-6 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b-2 border-acero-claro/30 py-3 pr-4">{t("Fecha")}</th>
                <th className="border-b-2 border-acero-claro/30 py-3 pr-4">{t("Administrador")}</th>
                <th className="border-b-2 border-acero-claro/30 py-3 pr-4">{t("Acción")}</th>
                <th className="border-b-2 border-acero-claro/30 py-3 pr-4">{t("Registro")}</th>
                <th className="border-b-2 border-acero-claro/30 py-3 pr-4">{t("Resultado")}</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr key={evento._id}>
                  <td className="border-b border-acero-claro/15 py-3 pr-4">{new Date(evento.createdAt).toLocaleString(LOCALES[language])}</td>
                  <td className="border-b border-acero-claro/15 py-3 pr-4">{evento.actorNombre} · {t(evento.rol)}</td>
                  <td className="border-b border-acero-claro/15 py-3 pr-4">{t(evento.accion)}</td>
                  <td className="border-b border-acero-claro/15 py-3 pr-4">{t(evento.entidad)} {evento.entidadId}</td>
                  <td className="border-b border-acero-claro/15 py-3 pr-4">{t(evento.resultado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}