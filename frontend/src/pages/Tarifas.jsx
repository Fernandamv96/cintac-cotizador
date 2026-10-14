// Mantenedor de tarifas, embarcadores y parámetros (HDU-07).
// Comex actualiza aquí lo que antes cambiaba en las planillas de OneDrive.
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/api.js";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";

const NOMBRES_PARAMETROS = {
  iva: { etiqueta: "IVA", ayuda: "Proporción: 0.19 = 19 %", paso: "0.01" },
  arancel: { etiqueta: "Arancel", ayuda: "0 con TLC; 0.06 = 6 %", paso: "0.001" },
  toneladas_por_contenedor: { etiqueta: "Tope por contenedor (t)", ayuda: "Comex indicó 25 t", paso: "1" },
  margen_contingencia_dias: { etiqueta: "Margen de contingencia por defecto (días)", ayuda: "Se puede cambiar en cada cotización", paso: "1" },
};

export default function Tarifas() {
  const { language, t } = useLanguage();
  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState({ puertoOrigen: "", puertoDestino: "" });
  const [edicion, setEdicion] = useState({});
  const [parametros, setParametros] = useState({});
  const [nuevoEmbarcador, setNuevoEmbarcador] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const respuesta = await api.listarTarifas();
      setDatos(respuesta);
      setParametros(Object.fromEntries(respuesta.parametros.map((p) => [p.nombre, String(p.valor)])));
      setEdicion({});
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const tarifasVisibles = useMemo(
    () =>
      (datos?.tarifas || []).filter(
        (tarifa) =>
          (!filtro.puertoOrigen || tarifa.puertoOrigen === filtro.puertoOrigen) &&
          (!filtro.puertoDestino || tarifa.puertoDestino === filtro.puertoDestino)
      ),
    [datos, filtro]
  );

  function avisar(texto) {
    setMensaje(texto);
    setError("");
    window.setTimeout(() => setMensaje(""), 4000);
  }

  const valorEditado = (tarifa, campo) => edicion[tarifa.id]?.[campo] ?? tarifa[campo];
  const editar = (id, campo, valor) =>
    setEdicion((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));

  async function guardarTarifa(tarifa) {
    try {
      const cambios = {
        tarifaMinUSD: Number(valorEditado(tarifa, "tarifaMinUSD")),
        tarifaMaxUSD: Number(valorEditado(tarifa, "tarifaMaxUSD")),
        transitoMinDias: Number(valorEditado(tarifa, "transitoMinDias")),
        transitoMaxDias: Number(valorEditado(tarifa, "transitoMaxDias")),
        fuente: valorEditado(tarifa, "fuente"),
        activa: valorEditado(tarifa, "activa"),
      };
      const actualizada = await api.actualizarTarifa(tarifa.id, cambios);
      setDatos((prev) => ({ ...prev, tarifas: prev.tarifas.map((x) => (x.id === tarifa.id ? actualizada : x)) }));
      setEdicion((prev) => {
        const { [tarifa.id]: _, ...resto } = prev;
        return resto;
      });
      avisar(t("Tarifa guardada."));
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarParametro(nombre) {
    try {
      await api.actualizarParametro(nombre, Number(parametros[nombre]));
      avisar(t("Parámetro guardado."));
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function agregarEmbarcador(e) {
    e.preventDefault();
    try {
      await api.crearEmbarcador(nuevoEmbarcador);
      setNuevoEmbarcador("");
      avisar(t("Embarcador agregado. Sus tarifas se copiaron como inactivas: actualízalas y actívalas."));
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstadoEmbarcador(embarcador) {
    try {
      await api.actualizarEmbarcador(embarcador.id, { activo: !embarcador.activo });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const fecha = (iso) => (iso ? new Date(iso).toLocaleString(LOCALES[language]) : "-");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h2 className="text-2xl font-semibold">{t("Tarifas y parámetros")}</h2>
      <p className="mt-1 text-lg text-acero-claro">
        {t("Los cambios se aplican a las cotizaciones nuevas y quedan registrados con usuario y fecha.")}
      </p>
      {mensaje && <p role="status" className="mt-4 rounded-md bg-green-100 px-4 py-3 text-green-800">{mensaje}</p>}
      {error && <p role="alert" className="mt-4 rounded-md bg-peligro/10 px-4 py-3 text-peligro">{t(error)}</p>}

      <section className="tarjeta mt-6">
        <h3 className="text-lg">{t("Parámetros de cálculo")}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(datos?.parametros || []).map((p) => (
            <div key={p.nombre}>
              <label htmlFor={`param-${p.nombre}`}>{t(NOMBRES_PARAMETROS[p.nombre]?.etiqueta || p.nombre)}</label>
              <div className="flex gap-2">
                <input id={`param-${p.nombre}`} type="number" min="0" step={NOMBRES_PARAMETROS[p.nombre]?.paso || "any"}
                  value={parametros[p.nombre] ?? ""} onChange={(e) => setParametros((prev) => ({ ...prev, [p.nombre]: e.target.value }))} />
                <button type="button" className="btn-primario px-4" onClick={() => guardarParametro(p.nombre)}>{t("Guardar")}</button>
              </div>
              <small className="text-acero-claro">
                {t(NOMBRES_PARAMETROS[p.nombre]?.ayuda || p.descripcion)} · {t("Modificado:")} {p.modificadoPor || t("carga inicial")}, {fecha(p.modificadoEn)}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className="tarjeta mt-6">
        <h3 className="text-lg">{t("Embarcadores")}</h3>
        <ul className="mt-3 flex flex-wrap gap-3">
          {(datos?.embarcadores || []).map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-md border border-[var(--borde)] px-3 py-2">
              <span className={e.activo ? "" : "text-acero-claro line-through"}>{e.nombre}</span>
              <button type="button" className="text-sm underline" onClick={() => cambiarEstadoEmbarcador(e)}>
                {e.activo ? t("Desactivar") : t("Activar")}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={agregarEmbarcador} className="mt-4 flex max-w-lg gap-2">
          <input aria-label={t("Nombre del embarcador")} placeholder={t("Nombre del embarcador")} value={nuevoEmbarcador}
            onChange={(e) => setNuevoEmbarcador(e.target.value)} required minLength={2} maxLength={100} />
          <button type="submit" className="btn-primario px-4">{t("Agregar")}</button>
        </form>
      </section>

      <section className="tarjeta mt-6">
        <h3 className="text-lg">{t("Tarifas por ruta, embarcador y contenedor (US$)")}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <select aria-label={t("Puerto de origen")} value={filtro.puertoOrigen} onChange={(e) => setFiltro((f) => ({ ...f, puertoOrigen: e.target.value }))}>
            <option value="">{t("Todos los orígenes")}</option>
            {(datos?.puertosOrigen || []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label={t("Puerto de destino")} value={filtro.puertoDestino} onChange={(e) => setFiltro((f) => ({ ...f, puertoDestino: e.target.value }))}>
            <option value="">{t("Todos los destinos")}</option>
            {(datos?.puertosDestino || []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-acero-claro/30">
                <th className="py-2 pr-2">{t("Ruta")}</th>
                <th className="py-2 pr-2">{t("Embarcador")}</th>
                <th className="py-2 pr-2">{t("Cont.")}</th>
                <th className="py-2 pr-2">{t("Mín. US$")}</th>
                <th className="py-2 pr-2">{t("Máx. US$")}</th>
                <th className="py-2 pr-2">{t("Tránsito (días)")}</th>
                <th className="py-2 pr-2">{t("Fuente")}</th>
                <th className="py-2 pr-2">{t("Activa")}</th>
                <th className="py-2 pr-2">{t("Última modificación")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tarifasVisibles.map((tarifa) => (
                <tr key={tarifa.id} className={`border-b border-acero-claro/15 ${edicion[tarifa.id] ? "bg-naranja/10" : ""}`}>
                  <td className="py-1 pr-2">{tarifa.puertoOrigen} → {tarifa.puertoDestino}</td>
                  <td className="py-1 pr-2">{tarifa.embarcador}</td>
                  <td className="py-1 pr-2">{tarifa.tipoContenedor}'</td>
                  <td className="py-1 pr-2"><input className="!w-24" type="number" min="0" aria-label={t("Mínimo")} value={valorEditado(tarifa, "tarifaMinUSD")} onChange={(e) => editar(tarifa.id, "tarifaMinUSD", e.target.value)} /></td>
                  <td className="py-1 pr-2"><input className="!w-24" type="number" min="0" aria-label={t("Máximo")} value={valorEditado(tarifa, "tarifaMaxUSD")} onChange={(e) => editar(tarifa.id, "tarifaMaxUSD", e.target.value)} /></td>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    <input className="!w-16" type="number" min="1" aria-label={t("Tránsito mínimo")} value={valorEditado(tarifa, "transitoMinDias")} onChange={(e) => editar(tarifa.id, "transitoMinDias", e.target.value)} />
                    {" – "}
                    <input className="!w-16" type="number" min="1" aria-label={t("Tránsito máximo")} value={valorEditado(tarifa, "transitoMaxDias")} onChange={(e) => editar(tarifa.id, "transitoMaxDias", e.target.value)} />
                  </td>
                  <td className="py-1 pr-2"><input className="!w-44" aria-label={t("Fuente")} value={valorEditado(tarifa, "fuente")} onChange={(e) => editar(tarifa.id, "fuente", e.target.value)} /></td>
                  <td className="py-1 pr-2"><input className="!h-4 !w-4" type="checkbox" aria-label={t("Activa")} checked={Boolean(valorEditado(tarifa, "activa"))} onChange={(e) => editar(tarifa.id, "activa", e.target.checked)} /></td>
                  <td className="py-1 pr-2 text-acero-claro">{tarifa.modificadoPor || t("carga inicial")}<br />{fecha(tarifa.modificadoEn)}</td>
                  <td className="py-1">
                    <button type="button" className="btn-primario px-3 py-1 text-sm" disabled={!edicion[tarifa.id]} onClick={() => guardarTarifa(tarifa)}>
                      {t("Guardar")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datos && !tarifasVisibles.length && <p className="mt-3 text-acero-claro">{t("No hay tarifas para ese filtro.")}</p>}
        </div>
      </section>
    </main>
  );
}
