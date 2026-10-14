import { jsPDF } from "jspdf";

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

const usd = (n) => (n === undefined || n === null ? "-" : `US$ ${Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 })}`);
const clp = (n) => (n === undefined || n === null ? "-" : `$${Number(n).toLocaleString("es-CL")} CLP`);
const pct = (n) => (n === undefined || n === null ? "-" : `${(Number(n) * 100).toFixed(1)} %`);
const rango = (a, b, fmt) => (a === undefined || a === null ? "-" : `${fmt(a)} – ${fmt(b)}`);

// Una sola lista de filas para PDF, Excel (CSV) y Word, con el desglose que pide
// la HDU-08: ruta, embarcador, contenedores, costos, tipo de cambio, fecha y usuario.
function obtenerFilasCotizacion(c) {
  return [
    ["Embarcador", c.proveedor || "-"],
    ["Ruta", `${c.puertoOrigen || "-"} a ${c.puertoDestino || "-"} (${c.tipoRuta || "-"})`],
    ["Peso", `${Number(c.cantidad || 0).toLocaleString("es-CL")} kg`],
    ["Contenedores", `${c.cantidadContenedores ?? "-"} × ${c.tipoContenedor ?? "-"}' (tope ${c.toneladasPorContenedor ?? 25} t por contenedor${c.contenedoresModificados ? ", cantidad modificada manualmente" : ""})`],
    ["Tarifa por contenedor", rango(c.tarifaFleteMinPorContenedorUSD, c.tarifaFleteMaxPorContenedorUSD, usd)],
    ["Flete total", rango(c.tarifaFleteMinUSD, c.tarifaFleteMaxUSD, usd)],
    ["Valor FOB", `${Number(c.precioFOB || 0).toLocaleString("es-CL")} ${c.moneda || "USD"}`],
    ["CIF (FOB + flete)", rango(c.cifMinUSD, c.cifMaxUSD, usd)],
    ["Arancel", `${pct(c.arancelPctUsado)} · ${rango(c.arancelMinUSD, c.arancelMaxUSD, usd)}`],
    ["IVA", `${pct(c.ivaPctUsado)} · ${rango(c.ivaMinUSD, c.ivaMaxUSD, usd)}`],
    ["Costos locales", usd(c.costosLocalesUSD)],
    ["Total en dólares", rango(c.totalMinUSD, c.totalMaxUSD, usd)],
    ["Tipo de cambio", c.tipoCambioUsado ? `${clp(c.tipoCambioUsado)} (${c.fuenteTipoCambio || "mindicador.cl"}, ${c.fechaTipoCambio ? new Date(c.fechaTipoCambio).toLocaleDateString("es-CL") : "-"})` : "-"],
    ["Total en pesos (rango)", rango(c.costoTotalMinCLP, c.costoTotalMaxCLP, clp)],
    ["Total en pesos (punto medio)", clp(c.costoTotalCLP)],
    ["Costo por kg", c.precioUnitarioFinalCLP ? clp(c.precioUnitarioFinalCLP) : "-"],
    ["Tránsito", `${c.tiempoTransitoMinDias ?? "-"}–${c.tiempoTransitoMaxDias ?? "-"} días + ${c.margenDias ?? 0} de contingencia = ${c.transitoConMargenMinDias ?? "-"}–${c.transitoConMargenMaxDias ?? "-"} días`],
    ["Condición de pago", c.condicionPago || "-"],
    ["Fuente de la tarifa", c.fuenteTarifa || "-"],
    ["Cotizado por", `${c.creadoPorNombre || "-"} · ${c.createdAt ? new Date(c.createdAt).toLocaleString("es-CL") : "-"}`],
    ["Nota", "Estimación referencial: no incluye recargos BAF/GRI ni gastos portuarios salvo los costos locales ingresados."],
  ];
}

function crearHtmlDocumentoCotizacion(cotizacion) {
  const escaparHtml = (value) => String(value).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[caracter]);
  const filas = obtenerFilasCotizacion(cotizacion).map(([label, value]) => `<tr><td>${escaparHtml(label)}</td><td>${escaparHtml(value)}</td></tr>`).join("");
  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: Arial, sans-serif; color: #0f172a; margin: 24px;">
        <div style="background: #f97316; color: white; padding: 18px 24px; border-radius: 12px; font-weight: 900; font-size: 28px; letter-spacing: 1px; text-align: center;">CINTAC</div>
        <h2 style="margin: 20px 0 10px; color: #f97316;">Cotización de Importación</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tbody>${filas}</tbody>
        </table>
      </body>
    </html>
  `;
}

export function exportarCotizacion(cotizacion, tipo = "pdf") {
  const nombreBase = `cotizacion-${(cotizacion.puertoOrigen || "ruta").replace(/[^\w-]+/g, "-")}-${cotizacion._id || "sin-id"}`;

  if (tipo === "excel") {
    const filas = obtenerFilasCotizacion(cotizacion);
    const csv = filas
      .map(([key, value]) => `"${String(key).replace(/"/g, '""')}","${String(value).replace(/"/g, '""')}"`)
      .join("\n");
    descargarBlob(csv, `${nombreBase}.csv`, "text/csv;charset=utf-8;");
    return;
  }

  if (tipo === "word") {
    const html = crearHtmlDocumentoCotizacion(cotizacion);
    descargarBlob(html, `${nombreBase}.doc`, "application/msword;charset=utf-8;");
    return;
  }

  const doc = new jsPDF();
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, 220, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text("CINTAC", 14, 18);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.text("Cotización de importación marítima", 14, 42);

  doc.setFontSize(10);
  let y = 54;
  for (const [etiqueta, valor] of obtenerFilasCotizacion(cotizacion)) {
    doc.setFont("helvetica", "bold");
    doc.text(`${etiqueta}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(String(valor ?? "-"), 128);
    doc.text(lineas, 68, y);
    y += 6 * lineas.length + 1;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  }

  doc.save(`${nombreBase}.pdf`);
}
