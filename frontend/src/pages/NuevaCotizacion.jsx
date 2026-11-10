import React, { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { exportarCotizacion } from "../utils/exportPdf.js";
import { LOCALES, useLanguage } from "../api/LanguageContext.jsx";
import OpcionesPuertos from "../components/OpcionesPuertos.jsx";

// La cantidad de contenedores la calcula el servidor con el peso y el tope de cada tipo;
// el usuario elige embarcador y contenedor (20' o 40') en la comparación.
const CAMPOS_INICIALES = {
  proveedor: "",
  tipoContenedor: "",
  puertoOrigen: "",
  puertoDestino: "",
  cantidad: "",
  unidadPeso: "kg",
  margenDias: "",
  precioFOB: "",
  moneda: "USD",
  otrosGastos: "0",
};

// [[embarcador, [opción de 20', opción de 40']], ...] en el orden que entrega el servidor.
function agruparPorEmbarcador(opciones) {
  const grupos = new Map();
  for (const opcion of opciones) grupos.set(opcion.embarcador, [...(grupos.get(opcion.embarcador) || []), opcion]);
  return [...grupos];
}

// El peso se escribe en kg o en toneladas; al servidor siempre se envía en kg.
function pesoEnKg({ cantidad, unidadPeso }) {
  if (cantidad === "") return NaN;
  const valor = Number(cantidad);
  return unidadPeso === "t" ? Math.round(valor * 1000) : valor;
}

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
    const peso = pesoEnKg(form);
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
        });
        if (!vigente) return;
        setComparacion(datos);
        setErrorTarifa("");
        // Si la opción elegida ya no existe (otra ruta o peso), se propone la más económica.
        if (!datos.opciones.some((o) => o.embarcador === form.proveedor && o.tipoContenedor === form.tipoContenedor)) {
          const mejor = datos.opciones.find((o) => o.esMasEconomico) || datos.opciones[0];
          setForm((prev) => ({ ...prev, proveedor: mejor?.embarcador || "", tipoContenedor: mejor?.tipoContenedor || "" }));
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
  }, [form.puertoOrigen, form.puertoDestino, form.cantidad, form.unidadPeso]);

  const actualizarCampo = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  // Al cambiar de unidad se convierte lo ya escrito (50000 kg pasa a 50 t y viceversa).
  const cambiarUnidadPeso = (unidad) =>
    setForm((prev) => {
      const valor = Number(prev.cantidad);
      if (prev.unidadPeso === unidad || prev.cantidad === "" || !Number.isFinite(valor)) return { ...prev, unidadPeso: unidad };
      return { ...prev, unidadPeso: unidad, cantidad: String(unidad === "t" ? valor / 1000 : Math.round(valor * 1000)) };
    });
  const elegirOpcion = (o) => setForm((prev) => ({ ...prev, proveedor: o.embarcador, tipoContenedor: o.tipoContenedor }));
  const esElegida = (o) => form.proveedor === o.embarcador && form.tipoContenedor === o.tipoContenedor;
  const margen = Number.parseInt(form.margenDias, 10) || 0;

  async function manejarRegistro(e) {
    e.preventDefault();
    setError("");
    if (!form.proveedor || !form.tipoContenedor) {
      setError("Selecciona un embarcador y un contenedor en la comparación.");
      return;
    }
    setCargando(true);
    try {
      const nueva = await api.crearCotizacion({
        ...form,
        cantidad: pesoEnKg(form),
        precioFOB: Number(form.precioFOB || 0),
        otrosGastos: Number(form.otrosGastos || 0),
        margenDias: form.margenDias === "" ? undefined : Number(form.margenDias),
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
    setForm((prev) => ({ ...CAMPOS_INICIALES, margenDias: String(catalogo?.parametros?.margen_contingencia_dias ?? 0), puertoOrigen: prev.puertoOrigen, puertoDestino: prev.puertoDestino, unidadPeso: prev.unidadPeso }));
  }

  const bloqueado = Boolean(cotizacion);
  const tope20 = catalogo?.parametros?.toneladas_por_contenedor_20 ?? 23;
  const tope40 = catalogo?.parametros?.toneladas_por_contenedor ?? 25;
  const ivaPct = Math.round((catalogo?.parametros?.iva ?? 0.19) * 100);
  const arancelPct = Math.round((catalogo?.parametros?.arancel ?? 0) * 1000) / 10;
  const peso = pesoEnKg(form);
  // Las cotizaciones calculadas antes de esta opción no traen la marca: se tratan como informadas.
  const conValorCarga = cotizacion?.valorCargaInformado !== false;
  const grupos = comparacion ? agruparPorEmbarcador(comparacion.opciones) : [];
  const elegida = comparacion?.opciones.find(esElegida);
  const insignias = (o) => (
    <>
      {o.esMasEconomico && <span className="whitespace-nowrap rounded bg-green-100 px-2 py-0.5 text-green-800">{t("Más económico")}</span>}
      {o.esMasRapido && <span className="whitespace-nowrap rounded bg-blue-100 px-2 py-0.5 text-blue-800">{t("Más rápido")}</span>}
    </>
  );

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

      {/* Paso 1: carga, ruta y comparación de embarcadores */}
      <section className="tarjeta mt-6">
        <h3 className="text-lg">{t("1. Carga, ruta y embarcador")}</h3>
        <form id="form-cotizacion" onSubmit={manejarRegistro} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="puertoOrigen">{t("Puerto de origen")}</label>
              <select id="puertoOrigen" required disabled={bloqueado} value={form.puertoOrigen}
                onChange={(e) => actualizarCampo("puertoOrigen", e.target.value)}>
                <option value="">{t("Selecciona puerto de origen")}</option>
                <OpcionesPuertos grupos={catalogo?.origenesPorPais} />
              </select>
            </div>
            <div>
              <label htmlFor="puertoDestino">{t("Puerto de destino")}</label>
              <select id="puertoDestino" required disabled={bloqueado} value={form.puertoDestino}
                onChange={(e) => actualizarCampo("puertoDestino", e.target.value)}>
                <option value="">{t("Selecciona puerto de destino")}</option>
                <OpcionesPuertos grupos={catalogo?.destinosPorPais} />
              </select>
            </div>
            <div>
              <label htmlFor="cantidad">{t("Peso de la carga")}</label>
              <div className="flex gap-2">
                <input id="cantidad" type="number" required disabled={bloqueado}
                  min={form.unidadPeso === "t" ? "0.001" : "1"} step={form.unidadPeso === "t" ? "0.001" : "1"}
                  inputMode={form.unidadPeso === "t" ? "decimal" : "numeric"}
                  value={form.cantidad} onChange={(e) => actualizarCampo("cantidad", e.target.value)}
                  placeholder={form.unidadPeso === "t" ? t("Ej: 50 (son 50.000 kg)") : t("Ej: 50000 (son 50 toneladas)")} />
                <select aria-label={t("Unidad de peso")} className="!w-36 shrink-0" disabled={bloqueado}
                  value={form.unidadPeso} onChange={(e) => cambiarUnidadPeso(e.target.value)}>
                  <option value="kg">{t("Kilos (kg)")}</option>
                  <option value="t">{t("Toneladas (t)")}</option>
                </select>
              </div>
              <p className="mt-1 text-sm text-acero-claro">
                {peso > 0 && `= ${form.unidadPeso === "t" ? `${num(peso)} kg` : `${num(peso / 1000, 3)} t`} · `}
                {t("Con este peso se calculan los contenedores de 20' (máx. {a} t) y de 40' (máx. {b} t).", { a: tope20, b: tope40 })}
              </p>
            </div>
            <div>
              <label htmlFor="margenDias">{t("Margen de contingencia (días)")}</label>
              <input id="margenDias" type="number" min="0" max="365" step="1" disabled={bloqueado}
                value={form.margenDias} onChange={(e) => actualizarCampo("margenDias", e.target.value)} />
            </div>
            {/* Comparación de embarcadores: cada uno con su opción de 20' y de 40'. */}
            <div className="rounded-2xl border border-[var(--borde)] p-4 sm:col-span-2">
              <h4 className="font-semibold">{t("Comparación de embarcadores")}</h4>
              {!comparacion && !errorTarifa && (
                <p className="mt-1 text-sm text-acero-claro">{t("Elige origen, destino y peso para ver las tarifas.")}</p>
              )}
              {errorTarifa && <p role="alert" className="mt-1 text-peligro">{t(errorTarifa)}</p>}
              {comparacion && (
                <>
                  <p className="mt-1 text-acero-claro">
                    {num(comparacion.toneladas, 2)} t →{" "}
                    {comparacion.contenedores
                      .map((c) => t("{n} × {tipo}' (máx. {t} t c/u)", { n: c.cantidad, tipo: c.tipoContenedor, t: c.toneladasPorContenedor }))
                      .join(` ${t("o")} `)}
                  </p>
                  <p className="mt-1 text-sm text-acero-claro">
                    {t("Elige el embarcador y el contenedor; la opción más económica viene marcada.")}
                  </p>
                  {/* En pantallas angostas cada embarcador se muestra como tarjeta (sin desplazamiento horizontal). */}
                  <div className="mt-3 space-y-3 md:hidden">
                    {grupos.map(([embarcador, opciones]) => (
                      <div key={embarcador} className="rounded-md border border-[var(--borde)] p-3">
                        <p className="font-semibold">{embarcador}</p>
                        <div className="mt-2 space-y-2">
                          {opciones.map((o) => (
                            <label key={o.tipoContenedor}
                              className={`block cursor-pointer rounded-md border p-3 ${esElegida(o) ? "border-naranja bg-naranja/10" : "border-[var(--borde)]"}`}>
                              <span className="flex items-center gap-2 font-medium">
                                <input className="!h-4 !w-4" type="radio" name="opcion-movil" disabled={bloqueado}
                                  checked={esElegida(o)} onChange={() => elegirOpcion(o)} />
                                {o.cantidadContenedores} × {o.tipoContenedor}'
                                <span className="text-sm font-normal text-acero-claro">({t("máx. {t} t c/u", { t: o.toneladasPorContenedor })})</span>
                              </span>
                              <span className="mt-1 block text-sm">{t("Flete total")}: {usd(o.tarifaFleteMinUSD)} – {usd(o.tarifaFleteMaxUSD)}</span>
                              <span className="block text-sm">{t("Tránsito")}: {o.tiempoTransitoMinDias}–{o.tiempoTransitoMaxDias} {t("días")} · {t("Con contingencia")}: {o.tiempoTransitoMinDias + margen}–{o.tiempoTransitoMaxDias + margen}</span>
                              <span className="mt-1 flex gap-2 text-xs">{insignias(o)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead>
                        <tr className="border-b-2 border-acero-claro/30">
                          <th className="py-2 pr-3">{t("Embarcador")}</th>
                          <th className="py-2 pr-3">{t("Contenedor")}</th>
                          <th className="py-2 pr-3">{t("Flete total")}</th>
                          <th className="py-2 pr-3">{t("Tránsito")}</th>
                          <th className="py-2 pr-3">{t("Con contingencia")}</th>
                          <th className="py-2 pr-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.flatMap(([embarcador, opciones]) =>
                          opciones.map((o, i) => (
                            <tr key={`${embarcador}-${o.tipoContenedor}`}
                              className={`border-b ${i === opciones.length - 1 ? "border-acero-claro/30" : "border-acero-claro/10"} ${esElegida(o) ? "bg-naranja/10" : ""}`}>
                              <td className="py-2 pr-3 font-medium">{i === 0 ? embarcador : ""}</td>
                              <td className="py-2 pr-3">
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input className="!h-4 !w-4" type="radio" name="opcion" disabled={bloqueado}
                                    aria-label={`${embarcador} ${o.cantidadContenedores} × ${o.tipoContenedor}'`}
                                    checked={esElegida(o)} onChange={() => elegirOpcion(o)} />
                                  <span>
                                    {o.cantidadContenedores} × {o.tipoContenedor}'{" "}
                                    <span className="text-xs text-acero-claro">({t("máx. {t} t c/u", { t: o.toneladasPorContenedor })})</span>
                                    <span className="block whitespace-nowrap text-xs text-acero-claro">
                                      {usd(o.tarifaFleteMinPorContenedorUSD)} – {usd(o.tarifaFleteMaxPorContenedorUSD)} {t("c/u")}
                                    </span>
                                  </span>
                                </label>
                              </td>
                              <td className="whitespace-nowrap py-2 pr-3">{usd(o.tarifaFleteMinUSD)} – {usd(o.tarifaFleteMaxUSD)}</td>
                              <td className="whitespace-nowrap py-2 pr-3">{o.tiempoTransitoMinDias}–{o.tiempoTransitoMaxDias} {t("días")}</td>
                              <td className="whitespace-nowrap py-2 pr-3">{o.tiempoTransitoMinDias + margen}–{o.tiempoTransitoMaxDias + margen} {t("días")}</td>
                              <td className="py-2 pr-3 text-sm"><span className="flex flex-wrap gap-2">{insignias(o)}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-sm text-acero-claro">{t("Fuente:")} {elegida?.fuenteTarifa || "-"}</p>
                </>
              )}
            </div>
            <div>
              <label htmlFor="precioFOB">{t("Valor de la carga (opcional)")}</label>
              <input id="precioFOB" type="number" min="0" step="0.01" inputMode="decimal" disabled={bloqueado}
                value={form.precioFOB} onChange={(e) => actualizarCampo("precioFOB", e.target.value)} placeholder="Ej: 35000" />
              <p className="mt-1 text-sm text-acero-claro">
                {t("Valor FOB de la mercadería. Si lo conoces, se usa para calcular CIF, arancel e IVA; si no, la cotización muestra el flete y los costos locales.")}
              </p>
            </div>
            <div>
              <label htmlFor="moneda">{t("Moneda del valor de la carga y costos locales")}</label>
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
          {!cotizacion && (
            <button type="submit" disabled={cargando || !elegida} className="btn-primario w-full">
              {cargando
                ? t("Guardando...")
                : t("Guardar cotización con {e}", {
                    e: elegida ? `${elegida.embarcador} · ${elegida.cantidadContenedores} × ${elegida.tipoContenedor}'` : "-",
                  })}
            </button>
          )}
        </form>
      </section>

      {/* Paso 2: cálculo */}
      {cotizacion && (
        <section className="tarjeta mt-6">
          <h3 className="text-lg">{t("2. Costo de internación")}</h3>
          <p className="mt-2 text-acero-claro">
            {cotizacion.proveedor} · {cotizacion.puertoOrigen} → {cotizacion.puertoDestino} · {cotizacion.cantidadContenedores} × {cotizacion.tipoContenedor}' · {num(cotizacion.cantidad)} kg ({num(cotizacion.cantidad / 1000, 3)} t)
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
                    conValorCarga
                      ? [t("Valor de la carga (FOB)"), usd(cotizacion.valorFOBUSD), usd(cotizacion.valorFOBUSD)]
                      : [t("Valor de la carga (FOB)"), t("No informado"), ""],
                    [t("Flete"), usd(cotizacion.tarifaFleteMinUSD), usd(cotizacion.tarifaFleteMaxUSD)],
                    ...(conValorCarga
                      ? [
                          [t("CIF (FOB + flete)"), usd(cotizacion.cifMinUSD), usd(cotizacion.cifMaxUSD)],
                          [`${t("Arancel")} ${(cotizacion.arancelPctUsado * 100).toFixed(1)} %`, usd(cotizacion.arancelMinUSD), usd(cotizacion.arancelMaxUSD)],
                          [`${t("IVA")} ${(cotizacion.ivaPctUsado * 100).toFixed(0)} %`, usd(cotizacion.ivaMinUSD), usd(cotizacion.ivaMaxUSD)],
                        ]
                      : []),
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
              {!conValorCarga && (
                <p className="aviso mt-3">
                  {t("Sin valor de la carga: el total incluye solo el flete y los costos locales. CIF, arancel e IVA se calculan cuando se informa el valor.")}
                </p>
              )}
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

      {/* Paso 3: exportar */}
      {cotizacion && cotizacion.estado !== "en_proceso" && (
        <section className="tarjeta mt-6">
          <h3 className="text-lg">{t("3. Finalizar y exportar")}</h3>
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
