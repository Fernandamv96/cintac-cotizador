// Pruebas del motor de cálculo (node --test). Ejecutar: npm test
// Caso de referencia: Tabla 17 del informe (valores ilustrativos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularContenedores, calcularCostoImportacion, estimarFlete } from "../utils/calculoCosto.js";

const PARAMS = { iva: 0.19, arancel: 0 };

test("CP-01 Tabla 17: 50 t, 2 contenedores de 40', FOB US$ 35.000, dólar $950", () => {
  const cont = calcularContenedores({ pesoKg: 50000, toneladasPorContenedor: 25 });
  assert.equal(cont.cantidad, 2);
  const flete = estimarFlete({ tarifaMinUSD: 2350, tarifaMaxUSD: 3850, transitoMinDias: 26, transitoMaxDias: 34 }, cont.cantidad);
  assert.equal(flete.tarifaFleteMinUSD, 4700);
  assert.equal(flete.tarifaFleteMaxUSD, 7700);

  const r = calcularCostoImportacion(
    { valorFOB: 35000, moneda: "USD", costosLocales: 0, pesoKg: 50000,
      fleteMinUSD: 4700, fleteMaxUSD: 7700, transitoMinDias: 26, transitoMaxDias: 34, margenDias: 0 },
    PARAMS, 950
  );
  assert.equal(r.cifMinUSD, 39700);
  assert.equal(r.cifMaxUSD, 42700);
  assert.equal(r.ivaMinUSD, 7543);
  assert.equal(r.ivaMaxUSD, 8113);
  assert.equal(r.totalMinUSD, 47243);
  assert.equal(r.totalMaxUSD, 50813);
  assert.equal(r.costoTotalMinCLP, 44880850);
  assert.equal(r.costoTotalMaxCLP, 48272350);
});

test("CP-02 contenedores: borde exacto de 25 t usa 1, 25,001 t usa 2", () => {
  assert.equal(calcularContenedores({ pesoKg: 25000, toneladasPorContenedor: 25 }).cantidad, 1);
  assert.equal(calcularContenedores({ pesoKg: 25001, toneladasPorContenedor: 25 }).cantidad, 2);
  assert.equal(calcularContenedores({ pesoKg: 60000, toneladasPorContenedor: 25 }).cantidad, 3);
  assert.equal(calcularContenedores({ pesoKg: 1, toneladasPorContenedor: 25 }).cantidad, 1);
});

test("CP-03 contenedores manuales: se respeta el valor y se marca como modificado", () => {
  const r = calcularContenedores({ pesoKg: 30000, toneladasPorContenedor: 25, modo: "manual", cantidadManual: 3 });
  assert.equal(r.cantidad, 3);
  assert.equal(r.sugeridos, 2);
  assert.equal(r.modificado, true);
});

test("CP-04 contenedores manuales insuficientes para el peso se rechazan", () => {
  assert.throws(
    () => calcularContenedores({ pesoKg: 60000, toneladasPorContenedor: 25, modo: "manual", cantidadManual: 2 }),
    /supera el tope/
  );
});

test("CP-05 datos inválidos: peso cero, negativo o cantidad no entera", () => {
  assert.throws(() => calcularContenedores({ pesoKg: 0, toneladasPorContenedor: 25 }), /mayor que cero/);
  assert.throws(() => calcularContenedores({ pesoKg: -5, toneladasPorContenedor: 25 }), /mayor que cero/);
  assert.throws(
    () => calcularContenedores({ pesoKg: 1000, toneladasPorContenedor: 25, modo: "manual", cantidadManual: 1.5 }),
    /entero/
  );
});

test("CP-06 arancel 6 %: el IVA se calcula sobre CIF + arancel", () => {
  const r = calcularCostoImportacion(
    { valorFOB: 10000, moneda: "USD", costosLocales: 0, pesoKg: 1000,
      fleteMinUSD: 1000, fleteMaxUSD: 1000, transitoMinDias: 30, transitoMaxDias: 30 },
    { iva: 0.19, arancel: 0.06 }, 1000
  );
  assert.equal(r.cifMinUSD, 11000);
  assert.equal(r.arancelMinUSD, 660);
  assert.equal(r.ivaMinUSD, 2215.4); // (11000 + 660) × 0,19
  assert.equal(r.totalMinUSD, 13875.4);
});

test("CP-07 el seguro no se suma y los costos locales van al final, sin IVA", () => {
  const r = calcularCostoImportacion(
    { valorFOB: 10000, moneda: "USD", costosLocales: 500, seguro: 999, pesoKg: 1000,
      fleteMinUSD: 1000, fleteMaxUSD: 1000, transitoMinDias: 30, transitoMaxDias: 30 },
    PARAMS, 1000
  );
  assert.equal(r.cifMinUSD, 11000);
  assert.equal(r.totalMinUSD, 11000 * 1.19 + 500);
});

test("CP-08 moneda CLP: el FOB se convierte a US$ con el tipo de cambio", () => {
  const r = calcularCostoImportacion(
    { valorFOB: 9500000, moneda: "CLP", costosLocales: 0, pesoKg: 1000,
      fleteMinUSD: 0, fleteMaxUSD: 0, transitoMinDias: 30, transitoMaxDias: 30 },
    PARAMS, 950
  );
  assert.equal(r.valorFOBUSD, 10000);
  assert.equal(r.costoTotalCLP, Math.round(10000 * 1.19 * 950));
});

test("CP-09 margen de contingencia se suma al tránsito", () => {
  const r = calcularCostoImportacion(
    { valorFOB: 1, moneda: "USD", pesoKg: 1, fleteMinUSD: 1, fleteMaxUSD: 2,
      transitoMinDias: 26, transitoMaxDias: 34, margenDias: 5 },
    PARAMS, 950
  );
  assert.equal(r.transitoConMargenMinDias, 31);
  assert.equal(r.transitoConMargenMaxDias, 39);
});

test("CP-10 tipo de cambio inválido detiene el cálculo", () => {
  assert.throws(
    () => calcularCostoImportacion({ valorFOB: 1, pesoKg: 1, fleteMinUSD: 1, fleteMaxUSD: 1 }, PARAMS, 0),
    /Tipo de cambio/
  );
});
