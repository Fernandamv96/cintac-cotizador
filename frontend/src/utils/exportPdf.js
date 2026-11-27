import { jsPDF } from "jspdf";

// Documento de cotización (PDF, Word y Excel). Los tres formatos salen del mismo
// modelo, así siempre muestran los mismos datos (HDU-08).
// Es un documento REFERENCIAL: no es boleta ni factura, y así lo dice el pie.

const DIAS_VALIDEZ = 7; // validez sugerida; confirmar con Comex
const MARCA = [255, 90, 31]; // naranjo Cintac
const MARCA_OSCURO = [229, 83, 3];
const TINTA = [31, 41, 51];
const TINTA_SUAVE = [82, 112, 127];
const FONDO_SUAVE = [255, 244, 236];
const LINEA = [230, 222, 214];

function descargarBlob(contenido, nombreArchivo, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const numero = (n, dec = 0) => Number(n).toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const usd = (n) => (n === undefined || n === null ? "-" : `US$ ${numero(n, 2)}`);
const clp = (n) => (n === undefined || n === null ? "-" : `$${numero(n)}`);
const pct = (n) => (n === undefined || n === null ? "-" : `${numero(Number(n) * 100, 1)} %`);
const fecha = (valor) => (valor ? new Date(valor).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-");
const ESTADOS = { en_proceso: "En proceso", calculada: "Calculada", finalizada: "Finalizada" };

export function numeroCotizacion(c) {
  const anio = c.createdAt ? new Date(c.createdAt).getFullYear() : new Date().getFullYear();
  return `COT-${anio}-${String(c._id || "000000").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// Todo lo que muestra el documento, ya formateado.
export function modeloDocumento(c) {
  const exportacion = c.operacion === "exportacion";
  const conValorCarga = c.valorCargaInformado !== false && Number(c.precioFOB || c.valorFOBUSD || 0) > 0;
  const emitida = c.updatedAt || c.createdAt || new Date().toISOString();
  const validaHasta = new Date(new Date(emitida).getTime() + DIAS_VALIDEZ * 864e5);
  const peso = Number(c.cantidad || c.pesoKg || 0);
  const lugar = (puerto, pais) => (pais ? `${puerto || "-"} (${pais})` : puerto || "-");

  const desglose = [
    ["Valor de la carga (FOB)", conValorCarga ? usd(c.valorFOBUSD) : "No informado", conValorCarga ? usd(c.valorFOBUSD) : ""],
    [`Flete marítimo (${c.cantidadContenedores ?? "-"} × ${c.tipoContenedor ?? "-"}')`, usd(c.tarifaFleteMinUSD), usd(c.tarifaFleteMaxUSD)],
  ];
  if (conValorCarga && exportacion) {
    desglose.push(["Precio CFR (FOB + flete)", usd(c.cifMinUSD), usd(c.cifMaxUSD)]);
    desglose.push(["IVA", "Exento (exportación)", "Exento (exportación)"]);
  } else if (conValorCarga) {
    desglose.push(["Valor CIF (FOB + flete, sin seguro)", usd(c.cifMinUSD), usd(c.cifMaxUSD)]);
    desglose.push([`Arancel ad valorem (${pct(c.arancelPctUsado)})`, usd(c.arancelMinUSD), usd(c.arancelMaxUSD)]);
    desglose.push([`IVA (${pct(c.ivaPctUsado)} sobre CIF + arancel)`, usd(c.ivaMinUSD), usd(c.ivaMaxUSD)]);
  }
  desglose.push(["Costos locales", usd(c.costosLocalesUSD), usd(c.costosLocalesUSD)]);

  const notas = [
    "Estimación referencial calculada con las tarifas vigentes en el Cotizador Cintac al momento de emitirla.",
    `Válida por ${DIAS_VALIDEZ} días o hasta que cambie la tarifa del embarcador o el tipo de cambio.`,
    "No incluye seguro de carga, recargos BAF/GRI ni gastos portuarios, salvo los costos locales indicados.",
    exportacion
      ? "Exportación: exenta de IVA (DL 825, art. 12 letra D) y sin arancel en Chile. Los impuestos del país de destino los paga el comprador."
      : "Importación: el IVA de 19 % se calcula sobre CIF + arancel. El arancel puede ser 0 % con certificado de origen (TLC).",
    !conValorCarga && "Sin valor de la carga informado: el total incluye solo flete y costos locales.",
    `Fuente de la tarifa: ${c.fuenteTarifa || "-"}.`,
  ].filter(Boolean);

  return {
    exportacion,
    numero: numeroCotizacion(c),
    titulo: exportacion ? "Cotización de exportación marítima" : "Cotización de importación marítima",
    cabecera: [
      ["N° de cotización", numeroCotizacion(c)],
      ["Fecha de emisión", fecha(emitida)],
      ["Válida hasta", fecha(validaHasta)],
      ["Estado", ESTADOS[c.estado] || c.estado || "-"],
      ["Cotizado por", c.creadoPorNombre || "-"],
      ["Correo", c.creadoPorEmail || "-"],
    ],
    operacion: [
      ["Tipo de operación", exportacion ? "Exportación (sale de Chile)" : "Importación (llega a Chile)"],
      ["Origen", lugar(c.puertoOrigen, c.paisOrigen)],
      ["Destino", lugar(c.puertoDestino, c.paisDestino)],
      ["Embarcador", c.proveedor || "-"],
      ["Carga", `${numero(peso)} kg (${numero(peso / 1000, 2)} t)`],
      ["Contenedores", `${c.cantidadContenedores ?? "-"} × ${c.tipoContenedor ?? "-"}' (máx. ${c.toneladasPorContenedor ?? "-"} t c/u)`],
      ["Tránsito", Number(c.margenDias || 0) > 0
        ? `${c.transitoConMargenMinDias ?? "-"}–${c.transitoConMargenMaxDias ?? "-"} días (incluye ${c.margenDias} de contingencia)`
        : `${c.tiempoTransitoMinDias ?? "-"}–${c.tiempoTransitoMaxDias ?? "-"} días`],
      ["Tipo de ruta", c.tipoRuta || "-"],
    ],
    desglose,
    totales: {
      usd: [usd(c.totalMinUSD), usd(c.totalMaxUSD)],
      clp: [clp(c.costoTotalMinCLP), clp(c.costoTotalMaxCLP)],
      estimado: clp(c.costoTotalCLP),
      porKg: c.precioUnitarioFinalCLP ? `${clp(c.precioUnitarioFinalCLP)} por kg` : "-",
      tipoCambio: c.tipoCambioUsado
        ? `Dólar observado ${clp(c.tipoCambioUsado)} · ${c.fuenteTipoCambio || "mindicador.cl"} · ${fecha(c.fechaTipoCambio)}`
        : "Tipo de cambio no disponible",
    },
    notas,
    pie: "Cintac S.A.I.C. · Documento referencial generado por el Cotizador Cintac. No constituye boleta, factura ni oferta vinculante.",
  };
}

// ------------------------------------------------------------------------- PDF

function crearPdf(m) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = 210;
  const margen = 14;
  const util = ancho - margen * 2;
  let y = 0;

  // Encabezado
  doc.setFillColor(...MARCA);
  doc.rect(0, 0, ancho, 30, "F");
  doc.setFillColor(...MARCA_OSCURO);
  doc.rect(0, 30, ancho, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("CINTAC", margen, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Comercio Exterior · Cotizador de flete marítimo", margen, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("COTIZACIÓN", ancho - margen, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(m.numero, ancho - margen, 19.5, { align: "right" });
  doc.text(`Emitida el ${m.cabecera[1][1]}`, ancho - margen, 25, { align: "right" });

  y = 42;
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(m.titulo, margen, y);

  // Etiqueta de operación
  const etiqueta = m.exportacion ? "EXPORTACIÓN" : "IMPORTACIÓN";
  doc.setFontSize(8);
  const anchoEtiqueta = doc.getTextWidth(etiqueta) + 6;
  doc.setFillColor(...(m.exportacion ? [37, 99, 235] : MARCA));
  doc.roundedRect(ancho - margen - anchoEtiqueta, y - 4.5, anchoEtiqueta, 6, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(etiqueta, ancho - margen - anchoEtiqueta / 2, y - 0.4, { align: "center" });

  // Dos bloques de datos
  y += 6;
  const anchoBloque = (util - 6) / 2;
  // Los valores largos (por ejemplo, el tránsito con contingencia) pasan a una segunda línea.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  const partir = (filas) => filas.map(([k, v]) => [k, doc.splitTextToSize(String(v), anchoBloque - 36)]);
  const altoFilas = (filas) => filas.reduce((total, [, lineas]) => total + 5.6 + (lineas.length - 1) * 3.8, 0);
  const bloque = (x, titulo, filasTexto, altoComun) => {
    const filas = partir(filasTexto);
    const alto = altoComun;
    doc.setDrawColor(...LINEA);
    doc.setFillColor(...FONDO_SUAVE);
    doc.roundedRect(x, y, anchoBloque, alto, 2, 2, "FD");
    doc.setTextColor(...MARCA_OSCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(titulo, x + 4, y + 6);
    doc.setFontSize(8.3);
    let fy = y + 11.5;
    for (const [k, lineas] of filas) {
      doc.setTextColor(...TINTA_SUAVE);
      doc.setFont("helvetica", "normal");
      doc.text(k, x + 4, fy);
      doc.setTextColor(...TINTA);
      doc.setFont("helvetica", "bold");
      doc.text(lineas, x + 32, fy, { lineHeightFactor: 1.3 });
      fy += 5.6 + (lineas.length - 1) * 3.8;
    }
    return alto;
  };
  const altoComun = 9 + Math.max(altoFilas(partir(m.cabecera)), altoFilas(partir(m.operacion)));
  bloque(margen, "Datos de la cotización", m.cabecera, altoComun);
  bloque(margen + anchoBloque + 6, "Detalle de la operación", m.operacion, altoComun);
  y += altoComun + 9;

  // Tabla de desglose
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Desglose de costos", margen, y);
  y += 3;
  const colMin = margen + util * 0.62;
  const colMax = margen + util;
  doc.setFillColor(...TINTA);
  doc.rect(margen, y, util, 7.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.8);
  doc.text("Concepto", margen + 3, y + 5);
  doc.text("Mínimo", colMin - 3, y + 5, { align: "right" });
  doc.text("Máximo", colMax - 3, y + 5, { align: "right" });
  y += 7.5;
  doc.setFont("helvetica", "normal");
  m.desglose.forEach(([concepto, minimo, maximo], i) => {
    if (i % 2 === 1) {
      doc.setFillColor(250, 247, 244);
      doc.rect(margen, y, util, 7, "F");
    }
    doc.setTextColor(...TINTA);
    doc.text(concepto, margen + 3, y + 4.8);
    doc.text(String(minimo), colMin - 3, y + 4.8, { align: "right" });
    doc.text(String(maximo), colMax - 3, y + 4.8, { align: "right" });
    y += 7;
  });
  doc.setDrawColor(...LINEA);
  doc.line(margen, y, margen + util, y);

  // Totales
  y += 2;
  const filaTotal = (concepto, [a, b], fuerte) => {
    doc.setFillColor(...(fuerte ? FONDO_SUAVE : [255, 255, 255]));
    doc.rect(margen, y, util, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TINTA);
    doc.text(concepto, margen + 3, y + 5.3);
    doc.text(a, colMin - 3, y + 5.3, { align: "right" });
    doc.text(b, colMax - 3, y + 5.3, { align: "right" });
    y += 8;
  };
  filaTotal("Total en dólares", m.totales.usd, false);
  filaTotal("Total en pesos chilenos (CLP)", m.totales.clp, true);

  // Recuadro del costo estimado
  y += 5;
  doc.setFillColor(...MARCA);
  doc.roundedRect(margen, y, util, 20, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("COSTO TOTAL ESTIMADO (punto medio del rango)", margen + 5, y + 7);
  doc.setFontSize(7.8);
  doc.text(`${m.totales.tipoCambio} · ${m.totales.porKg}`, margen + 5, y + 14.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${m.totales.estimado} CLP`, margen + util - 5, y + 13, { align: "right" });
  y += 29;

  // Condiciones
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Condiciones y notas", margen, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...TINTA_SUAVE);
  for (const nota of m.notas) {
    const lineas = doc.splitTextToSize(nota, util - 6);
    if (y + lineas.length * 4 > 278) {
      doc.addPage();
      y = 20;
    }
    doc.text("•", margen + 1, y);
    doc.text(lineas, margen + 5, y);
    y += lineas.length * 4 + 1.2;
  }

  // Pie en cada página
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...LINEA);
    doc.line(margen, 284, ancho - margen, 284);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(m.pie, margen, 289);
    doc.text(`${m.numero} · Página ${p} de ${paginas}`, ancho - margen, 293, { align: "right" });
  }
  return doc;
}

// ------------------------------------------------------------------- Word (HTML)

function crearHtml(m) {
  const e = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
  const filasDatos = (filas) => filas.map(([k, v]) => `<tr><td style="color:#52707F;padding:3px 8px 3px 0">${e(k)}</td><td style="font-weight:bold;padding:3px 0">${e(v)}</td></tr>`).join("");
  const desglose = m.desglose.map(([c, a, b], i) => `<tr style="background:${i % 2 ? "#FAF7F4" : "#FFFFFF"}"><td style="padding:6px 8px">${e(c)}</td><td style="padding:6px 8px;text-align:right">${e(a)}</td><td style="padding:6px 8px;text-align:right">${e(b)}</td></tr>`).join("");
  return `<html><head><meta charset="utf-8" /><title>${e(m.numero)}</title></head>
<body style="font-family:Arial,sans-serif;color:#1F2933;margin:24px;font-size:11pt">
  <table style="width:100%;background:#FF5A1F;color:#FFFFFF;border-collapse:collapse"><tr>
    <td style="padding:14px 18px;width:60%"><div style="font-size:24pt;font-weight:bold">CINTAC</div><div style="font-size:9pt">Comercio Exterior · Cotizador de flete marítimo</div></td>
    <td style="padding:14px 18px;text-align:right;width:40%"><div style="font-size:13pt;font-weight:bold">COTIZACIÓN</div><div>${e(m.numero)}</div><div>Emitida el ${e(m.cabecera[1][1])}</div></td>
  </tr></table>
  <h2 style="margin:18px 0 6px">${e(m.titulo)} <span style="font-size:9pt;color:#FFFFFF;background:${m.exportacion ? "#2563EB" : "#FF5A1F"};padding:2px 8px;border-radius:4px">${m.exportacion ? "EXPORTACIÓN" : "IMPORTACIÓN"}</span></h2>
  <table style="width:100%;border-collapse:collapse"><tr>
    <td style="vertical-align:top;width:50%;background:#FFF4EC;padding:10px"><b style="color:#E55303">Datos de la cotización</b><table>${filasDatos(m.cabecera)}</table></td>
    <td style="vertical-align:top;width:50%;background:#FFF4EC;padding:10px"><b style="color:#E55303">Detalle de la operación</b><table>${filasDatos(m.operacion)}</table></td>
  </tr></table>
  <h3 style="margin:18px 0 6px">Desglose de costos</h3>
  <table style="width:100%;border-collapse:collapse">
    <tr style="background:#1F2933"><td style="padding:6px 8px;width:50%;color:#FFFFFF;font-weight:bold">Concepto</td><td style="padding:6px 8px;width:25%;text-align:right;color:#FFFFFF;font-weight:bold">Mínimo</td><td style="padding:6px 8px;width:25%;text-align:right;color:#FFFFFF;font-weight:bold">Máximo</td></tr>
    ${desglose}
    <tr><td style="padding:6px 8px;font-weight:bold">Total en dólares</td><td style="padding:6px 8px;text-align:right;font-weight:bold">${e(m.totales.usd[0])}</td><td style="padding:6px 8px;text-align:right;font-weight:bold">${e(m.totales.usd[1])}</td></tr>
    <tr style="background:#FFF4EC"><td style="padding:6px 8px;font-weight:bold">Total en pesos chilenos (CLP)</td><td style="padding:6px 8px;text-align:right;font-weight:bold;white-space:nowrap">${e(m.totales.clp[0])}</td><td style="padding:6px 8px;text-align:right;font-weight:bold;white-space:nowrap">${e(m.totales.clp[1])}</td></tr>
  </table>
  <table style="width:100%;background:#FF5A1F;color:#FFFFFF;margin-top:14px;border-collapse:collapse"><tr>
    <td style="padding:12px 16px">COSTO TOTAL ESTIMADO (punto medio del rango)<br /><span style="font-size:8pt">${e(m.totales.tipoCambio)} · ${e(m.totales.porKg)}</span></td>
    <td style="padding:12px 16px;text-align:right;font-size:18pt;font-weight:bold;white-space:nowrap">${e(m.totales.estimado)} CLP</td>
  </tr></table>
  <h3 style="margin:18px 0 6px">Condiciones y notas</h3>
  <ul style="color:#52707F;font-size:9pt">${m.notas.map((n) => `<li>${e(n)}</li>`).join("")}</ul>
  <p style="border-top:1px solid #E6DED6;padding-top:6px;color:#52707F;font-size:8pt">${e(m.pie)}</p>
</body></html>`;
}

// -------------------------------------------------------------------- Excel (CSV)

function crearCsv(m) {
  const celda = (valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
  const filas = [
    [m.titulo],
    ...m.cabecera,
    [],
    ...m.operacion,
    [],
    ["Concepto", "Mínimo", "Máximo"],
    ...m.desglose,
    ["Total en dólares", ...m.totales.usd],
    ["Total en pesos chilenos (CLP)", ...m.totales.clp],
    ["Costo total estimado (CLP)", m.totales.estimado],
    ["Tipo de cambio", m.totales.tipoCambio],
    [],
    ...m.notas.map((n) => ["Nota", n]),
    [m.pie],
  ];
  // El BOM hace que Excel abra bien las tildes.
  return `﻿${filas.map((f) => f.map(celda).join(";")).join("\r\n")}`;
}

export function exportarCotizacion(cotizacion, tipo = "pdf") {
  const m = modeloDocumento(cotizacion);
  const nombreBase = `${m.numero}-${(cotizacion.puertoOrigen || "ruta").replace(/[^\w-]+/g, "-")}-${(cotizacion.puertoDestino || "").replace(/[^\w-]+/g, "-")}`;
  if (tipo === "excel") return descargarBlob(crearCsv(m), `${nombreBase}.csv`, "text/csv;charset=utf-8;");
  if (tipo === "word") return descargarBlob(crearHtml(m), `${nombreBase}.doc`, "application/msword;charset=utf-8;");
  return crearPdf(m).save(`${nombreBase}.pdf`);
}
