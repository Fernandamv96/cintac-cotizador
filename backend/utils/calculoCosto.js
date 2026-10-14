// Motor de cálculo del costo de importación marítima, con las reglas que
// entregó Comex en la reunión de levantamiento (septiembre 2026):
//   * Contenedores = techo(peso en toneladas ÷ tope por contenedor), tope 25 t.
//   * Flete = tarifa por contenedor × cantidad de contenedores (rango mín–máx, US$).
//   * El seguro NO se considera (lo toma Cintac directamente): CIF = FOB + flete.
//   * Arancel ad valorem parametrizable (0 % por defecto, por TLC) sobre el CIF.
//   * IVA 19 % sobre CIF + arancel (base imponible del IVA de importación en Chile;
//     con arancel 0 % equivale a "19 % del CIF", como lo planteó el cliente).
//   * Costos locales opcionales, se suman al final.
//   * Margen de contingencia en días sobre el tránsito.
//
// Las funciones de este archivo son puras (sin base de datos ni red) para poder
// probarlas con casos de referencia (ver tests/calculo.test.js).

const redondear2 = (n) => Math.round(n * 100) / 100;

export function calcularContenedores({ pesoKg, toneladasPorContenedor, modo = "peso", cantidadManual }) {
  const peso = Number(pesoKg);
  const tope = Number(toneladasPorContenedor);
  if (!Number.isFinite(peso) || peso <= 0) {
    throw new Error("Ingresa un peso en kg mayor que cero.");
  }
  if (!Number.isFinite(tope) || tope <= 0) {
    throw new Error("El tope de toneladas por contenedor no está configurado.");
  }
  const toneladas = peso / 1000;
  const sugeridos = Math.max(1, Math.ceil(toneladas / tope - 1e-9));

  if (modo === "manual") {
    const cantidad = Number(cantidadManual);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      throw new Error("La cantidad de contenedores debe ser un número entero entre 1 y 100.");
    }
    if (toneladas > cantidad * tope + 1e-9) {
      throw new Error(`El peso (${redondear2(toneladas)} t) supera el tope de ${tope} t por contenedor para ${cantidad} contenedor(es).`);
    }
    return { toneladas: redondear2(toneladas), cantidad, sugeridos, modificado: cantidad !== sugeridos };
  }
  if (modo !== "peso") throw new Error("Selecciona el modo de cálculo del contenedor.");
  if (sugeridos > 100) throw new Error("La carga requiere más de 100 contenedores; divide la cotización.");
  return { toneladas: redondear2(toneladas), cantidad: sugeridos, sugeridos, modificado: false };
}

export function estimarFlete(tarifa, cantidadContenedores) {
  return {
    tarifaFleteMinPorContenedorUSD: tarifa.tarifaMinUSD,
    tarifaFleteMaxPorContenedorUSD: tarifa.tarifaMaxUSD,
    tarifaFleteMinUSD: redondear2(tarifa.tarifaMinUSD * cantidadContenedores),
    tarifaFleteMaxUSD: redondear2(tarifa.tarifaMaxUSD * cantidadContenedores),
    tiempoTransitoMinDias: tarifa.transitoMinDias,
    tiempoTransitoMaxDias: tarifa.transitoMaxDias,
  };
}

// entrada: { valorFOB, moneda, costosLocales, pesoKg, fleteMinUSD, fleteMaxUSD,
//            transitoMinDias, transitoMaxDias, margenDias }
// parametros: { iva, arancel }
// tipoCambio: CLP por 1 US$
export function calcularCostoImportacion(entrada, parametros, tipoCambio) {
  const tc = Number(tipoCambio);
  if (!Number.isFinite(tc) || tc <= 0) throw new Error("Tipo de cambio inválido.");
  const iva = Number(parametros.iva);
  const arancel = Number(parametros.arancel ?? 0);
  if (!Number.isFinite(iva) || iva < 0 || !Number.isFinite(arancel) || arancel < 0) {
    throw new Error("Los parámetros de IVA o arancel no son válidos.");
  }

  const aUSD = (monto) => (entrada.moneda === "CLP" ? Number(monto || 0) / tc : Number(monto || 0));
  const fobUSD = aUSD(entrada.valorFOB);
  const costosLocalesUSD = aUSD(entrada.costosLocales);

  const escenario = (fleteUSD) => {
    const cifUSD = fobUSD + fleteUSD;
    const arancelUSD = cifUSD * arancel;
    const ivaUSD = (cifUSD + arancelUSD) * iva;
    const totalUSD = cifUSD + arancelUSD + ivaUSD + costosLocalesUSD;
    return { fleteUSD, cifUSD, arancelUSD, ivaUSD, totalUSD };
  };
  const minimo = escenario(Number(entrada.fleteMinUSD));
  const maximo = escenario(Number(entrada.fleteMaxUSD));
  const medio = escenario((Number(entrada.fleteMinUSD) + Number(entrada.fleteMaxUSD)) / 2);
  const margen = Math.max(0, Math.trunc(Number(entrada.margenDias || 0)));
  const peso = Number(entrada.pesoKg);

  return {
    tipoCambioUsado: tc,
    arancelPctUsado: arancel,
    ivaPctUsado: iva,
    valorFOBUSD: redondear2(fobUSD),
    costosLocalesUSD: redondear2(costosLocalesUSD),
    cifMinUSD: redondear2(minimo.cifUSD),
    cifMaxUSD: redondear2(maximo.cifUSD),
    arancelMinUSD: redondear2(minimo.arancelUSD),
    arancelMaxUSD: redondear2(maximo.arancelUSD),
    ivaMinUSD: redondear2(minimo.ivaUSD),
    ivaMaxUSD: redondear2(maximo.ivaUSD),
    totalMinUSD: redondear2(minimo.totalUSD),
    totalMaxUSD: redondear2(maximo.totalUSD),
    totalUSD: redondear2(medio.totalUSD),
    costoTotalMinCLP: Math.round(minimo.totalUSD * tc),
    costoTotalMaxCLP: Math.round(maximo.totalUSD * tc),
    costoTotalCLP: Math.round(medio.totalUSD * tc),
    precioUnitarioFinalCLP: peso > 0 ? Math.round((medio.totalUSD * tc) / peso) : null, // CLP por kg
    margenDias: margen,
    transitoConMargenMinDias: Number(entrada.transitoMinDias) + margen,
    transitoConMargenMaxDias: Number(entrada.transitoMaxDias) + margen,
  };
}
