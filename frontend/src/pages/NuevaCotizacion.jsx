import React, { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { exportarCotizacion } from "../utils/exportPdf.js";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";

const CAMPOS_INICIALES = {
  proveedor: "",
  puertoOrigen: "",
  puertoDestino: "",
  cantidad: "",
  tipoContenedor: "40",
  modoContenedor: "peso",
  cantidadContenedores: "1",
  margenDias: "",
  precioFOB: "",
  moneda: "USD",
  otrosGastos: "0",
  condicionPago: "",
};

export default function NuevaCotizacion() {
  const { language, t } = useLanguage();
  const locale = LOCALES[language];
  const num = (n, dec = 0) => (n === undefined || n === null ? "-" : Number(n).toLocaleString(locale, { maximumFractionDigits: dec }));
  const usd = (n) => `US$ ${num(n, 2)}`;
  const clp = (n) => `$${num(n)} CLP`;

  const [catalogo, setCatalogo] = useState(null);
  const [form, setForm] = useState(CAMPOS_INICIALES);
  const [comparacion, setComparacion] = useState(null);
  const [errorTarifa, setErrorTarifa] = useState("");
  const [cotizacion, setCotizacion] = useState(null);
  const [advertencia, setAdvertencia] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [tipoExportacion, setTipoExportacion] = useState("pdf");

  useEffect(() => {
    api
      .obtenerCatalogoCotizacion()
      .then((datos) => {
        setCatalogo(datos);
        setForm((prev) => ({ ...prev, margenDias: String(datos.parametros?.margen_contingencia_dias ?? 0) }));
      })
      .catch((err) => setError(err.message));
  }, []);

  // Compara los embarcadores de la ruta cada vez que cambia la carga (HDU-01, HDU-02, HDU-03).
  useEffect(() => {
    const peso = Number(form.cantidad);
    if (!form.puertoOrigen || !form.puertoDestino || !Number.isFinite(peso) || peso <= 0) {
      setComparacion(null);
      setErrorTarifa("");
      return undefined;
    }
    let vigente = true;
    const timer = window.setTimeout(async () => {
      try {
        const datos = await api.obtenerTarifaCotizacion({
          puertoOrigen: form.puertoOrigen,
          puertoDestino: form.puertoDestino,
          cantidad: peso,
          tipoContenedor: form.tipoContenedor,
          modoContenedor: form.modoContenedor,
          cantidadContenedores: form.cantidadContenedores,
        });
        if (!vigente) return;
        setComparacion(datos);
        setErrorTarifa("");
        if (!datos.opciones.some((o) => o.embarcador === form.proveedor)) {
          setForm((prev) => ({ ...prev, proveedor: datos.opciones[0]?.embarcador || "" }));
        }
      } catch (err) {
        if (vigente) {
          setComparacion(null);
          setErrorTarifa(err.message);
        }
      }
    }, 250);
    return () => {
      vigente = false;
      window.clearTimeout(timer);
    };
  }, [form.puertoOrigen, form.puertoDestino, form.cantidad, form.tipoContenedor, form.modoContenedor, form.cantidadContenedores]);

  const actualizarCampo = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const margen = Number.parseInt(form.margenDias, 10) || 0;

  async function manejarRegistro(e) {
    e.preventDefault();
    setError("");
    if (!form.proveedor) {
      setError("Selecciona un embarcador en la comparación.");
      return;
    }
    setCargando(true);
    try {
      const nueva = await api.crearCotizacion({
        ...form,
        cantidad: Number(form.cantidad),
        precioFOB: Number(form.precioFOB || 0),
        otrosGastos: Number(form.otrosGastos || 0),
        margenDias: form.margenDias === "" ? undefined : Number(form.margenDias),
        cantidadContenedores: Number(form.cantidadContenedores),
      });
      setCotizacion(nueva);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function manejarCalculo() {
    setError("");
    setCargando(true);
    try {
      const { cotizacion: actualizada, advertencia: aviso } = await api.calcularCotizacion(cotizacion._id);
      setCotizacion(actualizada);
      setAdvertencia(aviso || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function manejarFinalizarYExportar() {
    setError("");
    setCargando(true);
    try {
      const finalizada = await api.finalizarCotizacion(cotizacion._id);
      setCotizacion(finalizada);
      exportarCotizacion(finalizada, tipoExportacion);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function nuevaCotizacion() {
    setCotizacion(null);
    setAdvertencia("");
    setError("");
    setForm((prev) => ({ ...CAMPOS_INICIALES, margenDias: String(catalogo?.parametros?.margen_contingencia_dias ?? 0), puertoOrigen: prev.puertoOrigen, puertoDestino: prev.puertoDestino }));
  }

  const bloqueado = Boolean(cotizacion);
  const tope = catalogo?.parametros?.toneladas_por_contenedor ?? 25;
  const ivaPct = Math.round((catalogo?.parametros?.iva ?? 0.19) * 100);
  const arancelPct = Math.round((catalogo?.parametros?.arancel ?? 0) * 1000) / 10;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h2 className="text-2xl font-semibold">{t("Nueva cotización")}</h2>
      <p className="mt-1 text-lg text-acero-claro">
        {t("Ingresa la carga, compara los embarcadores y calcula el costo de internación.")}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-peligro/10 px-4 py-3 text-peligro">
          {t(error)}
        </p>
      )}

      {/* Paso 1: carga y ruta */}
      <section className="tarjeta mt-6">
        <h3 className="text-lg">{t("1. Carga y ruta")}</h3>
        <form id="form-cotizacion" onSubmit={manejarRegistro} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="puertoOrigen">{t("Puerto de origen")}</label>
              <select id="puertoOrigen" required disabled={bloqueado} value={form.puertoOrigen}
                onChange={(e) => actualizarCampo("puertoOrigen", e.target.value)}>
                <option value="">{t("Selecciona puerto de origen")}</option>
                {(catalogo?.puertosOrigen || []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="puertoDestino">{t("Puerto de destino")}</label>
              <select id="puertoDestino" required disabled={bloqueado} value={form.puertoDestino}
                onChange={(e) => actualizarCampo("puertoDestino", e.target.value)}>
                <option value="">{t("Selecciona puerto de destino")}</option>
                {(catalogo?.puertosDestino || []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cantidad">{t("Peso de la carga (kg)")}</label>
              <input id="cantidad" type="number" min="1" step="1" inputMode="numeric" required disabled={bloqueado}
                value={form.cantidad} onChange={(e) => actualizarCampo("cantidad", e.target.value)}
                placeholder={t("Ej: 50000 (son 50 toneladas)")} />
            </div>
            <div>
              <label htmlFor="tipoContenedor">{t("Tipo de contenedor")}</label>
              <select id="tipoContenedor" disabled={bloqueado} value={form.tipoContenedor}
                onChange={(e) => actualizarCampo("tipoContenedor", e.target.value)}>
                <option value="20">20'</option>
                <option value="40">40'</option>
              </select>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold text-acero">{t("Cantidad de contenedores")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--borde)] p-3">
                  <input className="!h-4 !w-4" type="radio" name="modoContenedor" value="peso" disabled={bloqueado}
                    checked={form.modoContenedor === "peso"} onChange={() => actualizarCampo("modoContenedor", "peso")} />
                  <span>{t("Calcular por peso (tope de {t} t por contenedor)", { t: tope })}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--borde)] p-3">
                  <input className="!h-4 !w-4" type="radio" name="modoContenedor" value="manual" disabled={bloqueado}
                    checked={form.modoContenedor === "manual"} onChange={() => actualizarCampo("modoContenedor", "manual")} />
                  <span>{t("Ingresar la cantidad manualmente")}</span>
                </label>
              </div>
              {form.modoContenedor === "manual" && (
                <div className="mt-3 max-w-xs">
                  <label htmlFor="cantidadContenedores">{t("Contenedores")}</label>
                  <input id="cantidadContenedores" type="number" min="1" max="100" step="1" disabled={bloqueado}
                    value={form.cantidadContenedores} onChange={(e) => actualizarCampo("cantidadContenedores", e.target.value)} />
                </div>
              )}
            </fieldset>
            <div>
              <label htmlFor="margenDias">{t("Margen de contingencia (días)")}</label>
              <input id="margenDias" type="number" min="0" max="365" step="1" disabled={bloqueado}
                value={form.margenDias} onChange={(e) => actualizarCampo("margenDias", e.target.value)} />
            </div>
            <div>
              <label htmlFor="condicionPago">{t("Condición de pago")}</label>
              <input id="condicionPago" disabled={bloqueado} value={form.condicionPago} maxLength={120}
                onChange={(e) => actualizarCampo("condicionPago", e.target.value)} placeholder={t("Ej: 30 días fecha factura")} />
            </div>
            <div>
              <label htmlFor="precioFOB">{t("Valor FOB total de la mercadería")}</label>
              <input id="precioFOB" type="number" min="0" step="0.01" inputMode="decimal" disabled={bloqueado}
                value={form.precioFOB} onChange={(e) => actualizarCampo("precioFOB", e.target.value)} placeholder="Ej: 35000" />
            </div>
            <div>
              <label htmlFor="moneda">{t("Moneda del valor FOB y costos locales")}</label>
              <select id="moneda" disabled={bloqueado} value={form.moneda} onChange={(e) => actualizarCampo("moneda", e.target.value)}>
                <option value="USD">{t("Dólares (USD)")}</option>
                <option value="CLP">{t("Pesos chilenos (CLP)")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="otrosGastos">{t("Costos locales (opcional)")}</label>
              <input id="otrosGastos" type="number" min="0" step="0.01" disabled={bloqueado}
                value={form.otrosGastos} onChange={(e) => actualizarCampo("otrosGastos", e.target.value)} />
            </div>
            <div className="aviso">
              {t("Reglas de Comex: CIF = FOB + flete (sin seguro). Arancel {a} % e IVA {i} % sobre CIF + arancel. Los valores se cambian en Tarifas.", { a: arancelPct, i: ivaPct })}
            </div>
          </div>
        </form>
      </section>

      {/* Paso 2: comparación de embarcadores */}
      <section className="tarjeta mt-6">
        <h3 className="text-lg">{t("2. Comparación de embarcadores")}</h3>
        {!comparacion && !errorTarifa && (
          <p className="mt-2 text-acero-claro">{t("Elige origen, destino y peso para ver las tarifas.")}</p>
        )}
        {errorTarifa && <p role="alert" className="mt-2 text-peligro">{t(errorTarifa)}</p>}
        {comparacion && (
          <>
            <p className="mt-2 text-acero-claro">
              {t("{ton} t → {n} contenedor(es) de {tipo}'", { ton: num(comparacion.toneladas, 2), n: comparacion.cantidadContenedores, tipo: comparacion.tipoContenedor })}
              {comparacion.contenedoresModificados && ` · ${t("modificado manualmente (sugerido: {s})", { s: comparacion.contenedoresSugeridos })}`}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-acero-claro/30">
                    <th className="py-2 pr-3"></th>
                    <th className="py-2 pr-3">{t("Embarcador")}</th>
                    <th className="py-2 pr-3">{t("Flete total")}</th>
                    <th className="py-2 pr-3">{t("Tránsito")}</th>
                    <th className="py-2 pr-3">{t("Con contingencia")}</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {comparacion.opciones.map((o) => (
                    <tr key={o.embarcador} className={`border-b border-acero-claro/15 ${form.proveedor === o.embarcador ? "bg-naranja/10" : ""}`}>
                      <td className="py-2 pr-3">
                        <input className="!h-4 !w-4" type="radio" name="proveedor" aria-label={o.embarcador} disabled={bloqueado}
                          checked={form.proveedor === o.embarcador} onChange={() => actualizarCampo("proveedor", o.embarcador)} />
                      </td>
                      <td className="py-2 pr-3 font-medium">{o.embarcador}</td>
                      <td className="py-2 pr-3">{usd(o.tarifaFleteMinUSD)} – {usd(o.tarifaFleteMaxUSD)}</td>
                      <td className="py-2 pr-3">{o.tiempoTransitoMinDias}–{o.tiempoTransitoMaxDias} {t("días")}</td>
                      <td className="py-2 pr-3">{o.tiempoTransitoMinDias + margen}–{o.tiempoTransitoMaxDias + margen} {t("días")}</td>
                      <td className="py-2 pr-3 text-sm">
                        {o.esMasEconomico && <span className="mr-2 rounded bg-green-100 px-2 py-0.5 text-green-800">{t("Más económico")}</span>}
                        {o.esMasRapido && <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">{t("Más rápido")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-acero-claro">{t("Fuente:")} {comparacion.opciones.find((o) => o.embarcador === form.proveedor)?.fuenteTarifa || "-"}</p>
          </>
        )}
        {!cotizacion && (
          <button type="submit" form="form-cotizacion" disabled={cargando || !comparacion} className="btn-primario mt-4 w-full">
            {cargando ? t("Guardando...") : t("Guardar cotización con {e}", { e: form.proveedor || "-" })}
          </button>
        )}
      </section>

      {/* Paso 3: cálculo */}
      {cotizacion && (
        <section className="tarjeta mt-6">
          <h3 className="text-lg">{t("3. Costo de internación")}</h3>
          <p className="mt-2 text-acero-claro">
            {cotizacion.proveedor} · {cotizacion.puertoOrigen} → {cotizacion.puertoDestino} · {cotizacion.cantidadContenedores} × {cotizacion.tipoContenedor}' · {num(cotizacion.cantidad)} kg
          </p>
          {cotizacion.estado === "en_proceso" ? (
            <button onClick={manejarCalculo} disabled={cargando} className="btn-primario mt-4">
              {cargando ? t("Calculando...") : t("Calcular costo de importación")}
            </button>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-acero-claro/30">
                    <th className="py-2 pr-3">{t("Concepto")}</th>
                    <th className="py-2 pr-3">{t("Mínimo")}</th>
                    <th className="py-2 pr-3">{t("Máximo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t("Valor FOB"), usd(cotizacion.valorFOBUSD), usd(cotizacion.valorFOBUSD)],
                    [t("Flete"), usd(cotizacion.tarifaFleteMinUSD), usd(cotizacion.tarifaFleteMaxUSD)],
                    [t("CIF (FOB + flete)"), usd(cotizacion.cifMinUSD), usd(cotizacion.cifMaxUSD)],
                    [`${t("Arancel")} ${(cotizacion.arancelPctUsado * 100).toFixed(1)} %`, usd(cotizacion.arancelMinUSD), usd(cotizacion.arancelMaxUSD)],
                    [`${t("IVA")} ${(cotizacion.ivaPctUsado * 100).toFixed(0)} %`, usd(cotizacion.ivaMinUSD), usd(cotizacion.ivaMaxUSD)],
                    [t("Costos locales"), usd(cotizacion.costosLocalesUSD), usd(cotizacion.costosLocalesUSD)],
                    [t("Total US$"), usd(cotizacion.totalMinUSD), usd(cotizacion.totalMaxUSD)],
                    [t("Total CLP"), clp(cotizacion.costoTotalMinCLP), clp(cotizacion.costoTotalMaxCLP)],
                  ].map(([concepto, a, b], i, filas) => (
                    <tr key={concepto} className={`border-b border-acero-claro/15 ${i >= filas.length - 2 ? "font-semibold" : ""}`}>
                      <td className="py-2 pr-3">{concepto}</td>
                      <td className="py-2 pr-3">{a}</td>
                      <td className="py-2 pr-3">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-1">
                <p className="text-2xl font-display font-semibold text-acero">
                  {t("Costo total estimado:")} {clp(cotizacion.costoTotalCLP)}
                </p>
                <p className="text-acero-claro">
                  {t("Dólar observado:")} {clp(cotizacion.tipoCambioUsado)} ({cotizacion.fuenteTipoCambio}, {new Date(cotizacion.fechaTipoCambio).toLocaleDateString(locale)})
                  {" · "}{t("Costo por kg:")} {clp(cotizacion.precioUnitarioFinalCLP)}
                </p>
                <p className="text-acero-claro">
                  {t("Tránsito:")} {cotizacion.tiempoTransitoMinDias}–{cotizacion.tiempoTransitoMaxDias} {t("días")} + {cotizacion.margenDias} {t("de contingencia")} = <strong>{cotizacion.transitoConMargenMinDias}–{cotizacion.transitoConMargenMaxDias} {t("días")}</strong>
                </p>
              </div>
            </div>
          )}
          {advertencia && <p className="mt-3 rounded-md bg-ambar/15 px-4 py-3 text-acero">⚠ {t(advertencia)}</p>}
        </section>
      )}

      {/* Paso 4: exportar */}
      {cotizacion && cotizacion.estado !== "en_proceso" && (
        <section className="tarjeta mt-6">
          <h3 className="text-lg">{t("4. Finalizar y exportar")}</h3>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="tipoExportacion">{t("Formato")}</label>
              <select id="tipoExportacion" value={tipoExportacion} onChange={(e) => setTipoExportacion(e.target.value)} className="mt-1">
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="word">Word</option>
              </select>
            </div>
            <button onClick={manejarFinalizarYExportar} disabled={cargando} className="btn-primario">
              {cotizacion.estado === "finalizada" ? `${t("Descargar")} ${tipoExportacion.toUpperCase()}` : `${t("Finalizar y descargar")} ${tipoExportacion.toUpperCase()}`}
            </button>
            <button type="button" onClick={nuevaCotizacion} className="btn-secondary px-4 py-2">
              {t("Nueva cotización")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
