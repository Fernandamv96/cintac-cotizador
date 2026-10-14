// Estimación de flete a partir de las tarifas guardadas en la base de datos.
// Las tarifas ya no están escritas en el código: Comex las mantiene desde la
// pantalla "Tarifas" (HDU-07).
import { buscarTarifa, listarTarifas, obtenerValoresParametros } from "../config/store.js";
import { calcularContenedores, estimarFlete } from "./calculoCosto.js";

function validarTipo(tipoContenedor) {
  const tipo = String(tipoContenedor || "40");
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
  const tarifa = await buscarTarifa({ puertoOrigen, puertoDestino, embarcador, tipoContenedor: tipo });
  if (!tarifa) throw new Error("No hay una tarifa vigente para esa ruta, embarcador y contenedor.");

  return {
    tarifa,
    estimacion: {
      tipoContenedor: tipo,
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

// Compara todos los embarcadores activos de una ruta (HDU-03).
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
    .filter((t) => t.tipoContenedor === tipo);
  if (!tarifas.length) throw new Error("No hay tarifas vigentes para la ruta seleccionada.");

  const margen = Number(parametros.margen_contingencia_dias || 0);
  const opciones = tarifas
    .map((tarifa) => {
      const flete = estimarFlete(tarifa, contenedores.cantidad);
      return {
        embarcador: tarifa.embarcador,
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

  return {
    tipoContenedor: tipo,
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
