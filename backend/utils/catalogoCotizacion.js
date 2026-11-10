// Estimación de flete a partir de las tarifas guardadas en la base de datos.
// Las tarifas ya no están escritas en el código: Comex las mantiene desde la
// pantalla "Tarifas" (HDU-07).
import { buscarTarifa, listarTarifas, obtenerValoresParametros } from "../config/store.js";
import { contenedoresPorTipo, estimarFlete } from "./calculoCosto.js";

function validarTipo(tipoContenedor) {
  if (tipoContenedor === undefined || tipoContenedor === null || tipoContenedor === "") return null;
  const tipo = String(tipoContenedor);
  if (!["20", "40"].includes(tipo)) throw new Error("Selecciona un tipo de contenedor válido (20' o 40').");
  return tipo;
}

// Contenedores de la carga con cada tipo (o solo con el indicado).
function contenedoresDeLaCarga({ cantidad, modoContenedor, cantidadContenedores, parametros, tipo }) {
  const topes = { 20: parametros.toneladas_por_contenedor_20, 40: parametros.toneladas_por_contenedor };
  return contenedoresPorTipo({
    pesoKg: cantidad,
    topes: tipo ? { [tipo]: topes[tipo] } : topes,
    modo: modoContenedor,
    cantidadManual: cantidadContenedores,
  });
}

// Una opción por tarifa (embarcador × contenedor), con la cantidad que exige ese tipo.
function armarOpciones(tarifas, contenedores, margen) {
  return tarifas
    .filter((tarifa) => contenedores[tarifa.tipoContenedor])
    .map((tarifa) => {
      const { cantidad, sugeridos, modificado, toneladas, tope } = contenedores[tarifa.tipoContenedor];
      const flete = estimarFlete(tarifa, cantidad);
      return {
        tarifa,
        embarcador: tarifa.embarcador,
        tipoContenedor: tarifa.tipoContenedor,
        cantidadContenedores: cantidad,
        contenedoresSugeridos: sugeridos,
        contenedoresModificados: modificado,
        toneladas,
        toneladasPorContenedor: tope,
        ...flete,
        fletePromedioUSD: (flete.tarifaFleteMinUSD + flete.tarifaFleteMaxUSD) / 2,
        transitoConMargenMaxDias: flete.tiempoTransitoMaxDias + margen,
        fuenteTarifa: tarifa.fuente,
        tipoRuta: tarifa.tipoRuta,
      };
    });
}

// Calcula contenedores y flete para UN embarcador y el contenedor elegido; sin
// contenedor indicado se usa la opción más barata del embarcador.
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
  const contenedores = contenedoresDeLaCarga({ cantidad, modoContenedor, cantidadContenedores, parametros, tipo });
  const tarifas = tipo
    ? [await buscarTarifa({ puertoOrigen, puertoDestino, embarcador, tipoContenedor: tipo })].filter(Boolean)
    : (await listarTarifas({ puertoOrigen, puertoDestino, soloActivas: true })).filter((t) => t.embarcador === embarcador);
  const [opcion] = armarOpciones(tarifas, contenedores, 0).sort((a, b) => a.fletePromedioUSD - b.fletePromedioUSD);
  if (!opcion) throw new Error("No hay una tarifa vigente para esa ruta, embarcador y contenedor.");

  return {
    tarifa: opcion.tarifa,
    estimacion: {
      tipoContenedor: opcion.tipoContenedor,
      cantidadContenedores: opcion.cantidadContenedores,
      contenedoresSugeridos: opcion.contenedoresSugeridos,
      contenedoresModificados: opcion.contenedoresModificados,
      toneladas: opcion.toneladas,
      toneladasPorContenedor: opcion.toneladasPorContenedor,
      ...estimarFlete(opcion.tarifa, opcion.cantidadContenedores),
      tipoRuta: opcion.tipoRuta,
      fuenteTarifa: opcion.fuenteTarifa,
    },
  };
}

// Compara los embarcadores activos de una ruta (HDU-03): cada uno con su opción de 20'
// y de 40', para que el usuario elija la que más le conviene.
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
  const contenedores = contenedoresDeLaCarga({ cantidad, modoContenedor, cantidadContenedores, parametros, tipo });
  const tarifas = await listarTarifas({ puertoOrigen, puertoDestino, soloActivas: true });
  const margen = Number(parametros.margen_contingencia_dias || 0);
  const opciones = armarOpciones(tarifas, contenedores, margen);
  if (!opciones.length) throw new Error("No hay tarifas vigentes para la ruta seleccionada.");

  const masBarato = Math.min(...opciones.map((o) => o.fletePromedioUSD));
  const masRapido = Math.min(...opciones.map((o) => o.tiempoTransitoMaxDias));
  // Las opciones de un embarcador van juntas (20' y luego 40'); primero el embarcador más barato.
  const mejorPorEmbarcador = new Map();
  for (const o of opciones) {
    mejorPorEmbarcador.set(o.embarcador, Math.min(mejorPorEmbarcador.get(o.embarcador) ?? Infinity, o.fletePromedioUSD));
  }
  opciones.sort(
    (a, b) =>
      mejorPorEmbarcador.get(a.embarcador) - mejorPorEmbarcador.get(b.embarcador) ||
      a.embarcador.localeCompare(b.embarcador) ||
      Number(a.tipoContenedor) - Number(b.tipoContenedor)
  );
  const [primero] = Object.values(contenedores);

  return {
    toneladas: primero.toneladas,
    contenedores: Object.entries(contenedores).map(([clave, c]) => ({
      tipoContenedor: clave,
      cantidad: c.cantidad,
      toneladasPorContenedor: c.tope,
    })),
    // Con un tipo indicado en la consulta se informa también su cantidad directamente.
    tipoContenedor: tipo,
    cantidadContenedores: tipo ? contenedores[tipo].cantidad : null,
    margenDiasPorDefecto: margen,
    opciones: opciones.map(({ tarifa, ...o }) => ({
      ...o,
      esMasEconomico: o.fletePromedioUSD === masBarato,
      esMasRapido: o.tiempoTransitoMaxDias === masRapido,
    })),
  };
}
