// Estimación de flete a partir de las tarifas guardadas en la base de datos.
// Las tarifas ya no están escritas en el código: Comex las mantiene desde la
// pantalla "Tarifas" (HDU-07).
import { buscarTarifa, listarTarifas, obtenerValoresParametros } from "../config/store.js";
import { calcularContenedores, elegirTarifaMasConveniente, estimarFlete } from "./calculoCosto.js";

// Sin tipo indicado (lo normal desde el formulario) el sistema elige el contenedor;
// la API acepta 20 o 40 para forzarlo.
function validarTipo(tipoContenedor) {
  if (tipoContenedor === undefined || tipoContenedor === null || tipoContenedor === "") return null;
  const tipo = String(tipoContenedor);
  if (!["20", "40"].includes(tipo)) throw new Error("Selecciona un tipo de contenedor válido (20' o 40').");
  return tipo;
}

// Calcula contenedores y flete para UN embarcador.
export async function obtenerEstimacionFlete({
  puertoOrigen,
  puertoDestino,
  embarcador,
  cantidad,
  modoContenedor = "peso",
  tipoContenedor,
  cantidadContenedores,
}) {
  const tipo = validarTipo(tipoContenedor);
  const parametros = await obtenerValoresParametros();
  const contenedores = calcularContenedores({
    pesoKg: cantidad,
    toneladasPorContenedor: parametros.toneladas_por_contenedor,
    modo: modoContenedor,
    cantidadManual: cantidadContenedores,
  });
  const tarifa = tipo
    ? await buscarTarifa({ puertoOrigen, puertoDestino, embarcador, tipoContenedor: tipo })
    : elegirTarifaMasConveniente(
        (await listarTarifas({ puertoOrigen, puertoDestino, soloActivas: true })).filter((t) => t.embarcador === embarcador)
      );
  if (!tarifa) throw new Error("No hay una tarifa vigente para esa ruta, embarcador y contenedor.");

  return {
    tarifa,
    estimacion: {
      tipoContenedor: tarifa.tipoContenedor,
      cantidadContenedores: contenedores.cantidad,
      contenedoresSugeridos: contenedores.sugeridos,
      contenedoresModificados: contenedores.modificado,
      toneladas: contenedores.toneladas,
      toneladasPorContenedor: parametros.toneladas_por_contenedor,
      ...estimarFlete(tarifa, contenedores.cantidad),
      tipoRuta: tarifa.tipoRuta,
      fuenteTarifa: tarifa.fuente,
    },
  };
}

// Compara todos los embarcadores activos de una ruta (HDU-03), cada uno con su contenedor.
export async function compararEmbarcadores({
  puertoOrigen,
  puertoDestino,
  cantidad,
  modoContenedor = "peso",
  tipoContenedor,
  cantidadContenedores,
}) {
  const tipo = validarTipo(tipoContenedor);
  const parametros = await obtenerValoresParametros();
  const contenedores = calcularContenedores({
    pesoKg: cantidad,
    toneladasPorContenedor: parametros.toneladas_por_contenedor,
    modo: modoContenedor,
    cantidadManual: cantidadContenedores,
  });
  const tarifas = (await listarTarifas({ puertoOrigen, puertoDestino, soloActivas: true }))
    .filter((t) => !tipo || t.tipoContenedor === tipo);
  if (!tarifas.length) throw new Error("No hay tarifas vigentes para la ruta seleccionada.");

  const tarifasPorEmbarcador = new Map();
  for (const tarifa of tarifas) {
    tarifasPorEmbarcador.set(tarifa.embarcador, [...(tarifasPorEmbarcador.get(tarifa.embarcador) || []), tarifa]);
  }

  const margen = Number(parametros.margen_contingencia_dias || 0);
  const opciones = [...tarifasPorEmbarcador.values()]
    .map((delEmbarcador) => {
      const tarifa = elegirTarifaMasConveniente(delEmbarcador);
      const flete = estimarFlete(tarifa, contenedores.cantidad);
      return {
        embarcador: tarifa.embarcador,
        tipoContenedor: tarifa.tipoContenedor,
        ...flete,
        fletePromedioUSD: (flete.tarifaFleteMinUSD + flete.tarifaFleteMaxUSD) / 2,
        transitoConMargenMaxDias: flete.tiempoTransitoMaxDias + margen,
        fuenteTarifa: tarifa.fuente,
        tipoRuta: tarifa.tipoRuta,
      };
    })
    .sort((a, b) => a.fletePromedioUSD - b.fletePromedioUSD);
  const masBarato = opciones[0].fletePromedioUSD;
  const masRapido = Math.min(...opciones.map((o) => o.tiempoTransitoMaxDias));
  const tipos = new Set(opciones.map((o) => o.tipoContenedor));

  return {
    // Tipo común a todos los embarcadores; null si alguno usa otro contenedor.
    tipoContenedor: tipos.size === 1 ? opciones[0].tipoContenedor : null,
    cantidadContenedores: contenedores.cantidad,
    contenedoresSugeridos: contenedores.sugeridos,
    contenedoresModificados: contenedores.modificado,
    toneladas: contenedores.toneladas,
    toneladasPorContenedor: parametros.toneladas_por_contenedor,
    margenDiasPorDefecto: margen,
    opciones: opciones.map((o) => ({
      ...o,
      esMasEconomico: o.fletePromedioUSD === masBarato,
      esMasRapido: o.tiempoTransitoMaxDias === masRapido,
    })),
  };
}
