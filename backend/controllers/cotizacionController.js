import bcrypt from "bcryptjs";
import { calcularCostoImportacion } from "../utils/calculoCosto.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { esAdministrador, puedeVerTodasLasCotizaciones } from "../utils/roles.js";
import { compararEmbarcadores, obtenerEstimacionFlete } from "../utils/catalogoCotizacion.js";
import { obtenerTipoCambioUSD } from "../utils/tipoCambio.js";
import {
  actualizarEstadoCotizacion,
  buscarCotizacionPorId,
  crearCotizacion as crearCotizacionDb,
  eliminarCotizacion as eliminarCotizacionDb,
  findUsuarioById,
  guardarResultadoCotizacion,
  listarCotizaciones as listarCotizacionesDb,
  listarCotizacionesPorIds,
  obtenerCatalogo,
  obtenerParametros,
  obtenerValoresParametros,
} from "../config/store.js";

const esPropia = (cotizacion, req) => String(cotizacion.creadoPor || "") === req.usuario.id;

function numeroNoNegativo(valor, nombre) {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero) || numero < 0) throw new Error(`${nombre} debe ser un número mayor o igual a cero.`);
  return numero;
}

// GET /api/cotizaciones/catalogo: listas para el formulario y valores por defecto.
export async function obtenerCatalogoCotizacion(_req, res) {
  try {
    const [catalogo, parametros] = await Promise.all([obtenerCatalogo(), obtenerParametros()]);
    return res.json({
      embarcadores: catalogo.embarcadores.filter((e) => e.activo).map((e) => e.nombre),
      puertosOrigen: catalogo.puertosOrigen,
      puertosDestino: catalogo.puertosDestino,
      parametros: Object.fromEntries(parametros.map((p) => [p.nombre, p.valor])),
    });
  } catch (error) {
    console.error("No se pudo cargar el catálogo.", error);
    return res.status(500).json({ error: "No se pudo cargar el catálogo de rutas y embarcadores." });
  }
}

// GET /api/cotizaciones/tarifa: compara los embarcadores de la ruta (HDU-03).
export async function previsualizarTarifaCotizacion(req, res) {
  try {
    const comparacion = await compararEmbarcadores({
      puertoOrigen: String(req.query.puertoOrigen || ""),
      puertoDestino: String(req.query.puertoDestino || ""),
      cantidad: req.query.cantidad,
      modoContenedor: req.query.modoContenedor,
      tipoContenedor: req.query.tipoContenedor,
      cantidadContenedores: req.query.cantidadContenedores,
    });
    return res.json(comparacion);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function crearCotizacion(req, res) {
  try {
    const {
      proveedor,
      puertoOrigen,
      puertoDestino,
      cantidad,
      precioFOB,
      moneda,
      otrosGastos,
      margenDias,
      condicionPago,
      modoContenedor,
      tipoContenedor,
      cantidadContenedores,
    } = req.body;

    const obligatorios = { proveedor, puertoOrigen, puertoDestino, cantidad };
    const faltante = Object.entries(obligatorios).find(([, valor]) => valor === undefined || valor === "");
    if (faltante) return res.status(400).json({ error: `Falta completar el campo: ${faltante[0]}` });
    if (condicionPago && String(condicionPago).length > 120) {
      return res.status(400).json({ error: "La condición de pago no puede superar 120 caracteres." });
    }

    let datos;
    try {
      const parametros = await obtenerValoresParametros();
      const margen = margenDias === undefined || margenDias === ""
        ? Number(parametros.margen_contingencia_dias || 0)
        : Number(margenDias);
      if (!Number.isInteger(margen) || margen < 0 || margen > 365) {
        throw new Error("El margen de contingencia debe ser un número entero de días entre 0 y 365.");
      }
      const { tarifa, estimacion } = await obtenerEstimacionFlete({
        puertoOrigen: String(puertoOrigen),
        puertoDestino: String(puertoDestino),
        embarcador: String(proveedor),
        cantidad,
        modoContenedor: modoContenedor === "manual" ? "manual" : "peso",
        tipoContenedor,
        cantidadContenedores,
      });
      datos = {
        creadoPor: req.usuario.id,
        rutaId: tarifa.rutaId,
        embarcadorId: tarifa.embarcadorId,
        tipoContenedor: estimacion.tipoContenedor,
        cantidadContenedores: estimacion.cantidadContenedores,
        modoContenedor: modoContenedor === "manual" ? "manual" : "peso",
        pesoKg: Number(cantidad),
        valorFOB: numeroNoNegativo(precioFOB, "El valor FOB"),
        moneda: moneda === "CLP" ? "CLP" : "USD",
        costosLocales: numeroNoNegativo(otrosGastos, "Los costos locales"),
        margenDias: margen,
        condicionPago: String(condicionPago || "").trim(),
        tarifaUsada: { ...estimacion, tarifaId: tarifa.id },
      };
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const cotizacion = await crearCotizacionDb(datos);
    await registrarAuditoria(req, { accion: "cotizacion.creada", entidad: "cotizacion", entidadId: cotizacion._id });
    return res.status(201).json(cotizacion);
  } catch (error) {
    console.error("No se pudo registrar la cotización.", error);
    return res.status(500).json({ error: "No se pudo registrar la cotización." });
  }
}

export async function calcularCotizacion(req, res) {
  try {
    const cotizacion = await buscarCotizacionPorId(req.params.id);
    if (!cotizacion) return res.status(404).json({ error: "Cotización no encontrada." });
    if (!esAdministrador(req.usuario.rol) && !esPropia(cotizacion, req)) {
      return res.status(403).json({ error: "No tienes permisos para modificar esta cotización." });
    }

    const [tipoCambio, parametros] = await Promise.all([obtenerTipoCambioUSD(), obtenerValoresParametros()]);
    const resultado = calcularCostoImportacion(
      {
        valorFOB: cotizacion.valorFOB,
        moneda: cotizacion.moneda,
        costosLocales: cotizacion.costosLocales,
        pesoKg: cotizacion.pesoKg,
        fleteMinUSD: cotizacion.tarifaFleteMinUSD,
        fleteMaxUSD: cotizacion.tarifaFleteMaxUSD,
        transitoMinDias: cotizacion.tiempoTransitoMinDias,
        transitoMaxDias: cotizacion.tiempoTransitoMaxDias,
        margenDias: cotizacion.margenDias,
      },
      { iva: parametros.iva, arancel: parametros.arancel },
      tipoCambio.valor
    );
    const fechaTipoCambio = tipoCambio.fecha ? new Date(tipoCambio.fecha) : new Date();
    const desactualizado = Boolean(tipoCambio.respaldo) || (Date.now() - fechaTipoCambio.getTime()) / 36e5 > 24 * 4;
    // mindicador publica el dólar observado en días hábiles: un valor de hasta 4 días
    // (fin de semana largo) se considera vigente.

    const guardada = await guardarResultadoCotizacion(cotizacion._id, {
      ...resultado,
      fechaTipoCambio: fechaTipoCambio.toISOString(),
      fuenteTipoCambio: tipoCambio.fuente || "mindicador.cl",
      tipoCambioDesactualizado: desactualizado,
      calculadoEn: new Date().toISOString(),
    });
    await registrarAuditoria(req, { accion: "cotizacion.calculada", entidad: "cotizacion", entidadId: cotizacion._id });
    return res.json({
      cotizacion: guardada,
      advertencia: desactualizado
        ? "El tipo de cambio puede estar desactualizado: se usó el último valor disponible."
        : null,
    });
  } catch (error) {
    console.error("No se pudo calcular la cotización.", error);
    return res.status(500).json({ error: "No se pudo calcular la cotización. Intenta nuevamente." });
  }
}

export async function listarCotizaciones(req, res) {
  try {
    const { proveedor, puertoOrigen, puertoDestino } = req.query;
    const filtro = {};
    if (proveedor) filtro.proveedor = String(proveedor).slice(0, 100);
    if (puertoOrigen) filtro.puertoOrigen = String(puertoOrigen).slice(0, 100);
    if (puertoDestino) filtro.puertoDestino = String(puertoDestino).slice(0, 100);
    const creadoPor = puedeVerTodasLasCotizaciones(req.usuario.rol) ? null : req.usuario.id;
    return res.json(await listarCotizacionesDb(filtro, { creadoPor }));
  } catch (error) {
    console.error("No se pudo listar las cotizaciones.", error);
    return res.status(500).json({ error: "No se pudo obtener el historial." });
  }
}

export async function obtenerCotizacion(req, res) {
  const cotizacion = await buscarCotizacionPorId(req.params.id);
  if (!cotizacion) return res.status(404).json({ error: "Cotización no encontrada." });
  if (!puedeVerTodasLasCotizaciones(req.usuario.rol) && !esPropia(cotizacion, req)) {
    return res.status(403).json({ error: "No tienes permisos para ver esta cotización." });
  }
  return res.json(cotizacion);
}

export async function compararCotizaciones(req, res) {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: "Debes indicar al menos dos IDs para comparar." });
  const listaIds = [...new Set(String(ids).split(",").filter(Boolean))].slice(0, 10);
  if (listaIds.length < 2) {
    return res.status(400).json({ error: "Selecciona al menos dos cotizaciones para comparar." });
  }
  const lista = await listarCotizacionesPorIds(listaIds);
  const visibles = puedeVerTodasLasCotizaciones(req.usuario.rol) ? lista : lista.filter((c) => esPropia(c, req));
  return res.json(visibles);
}

export async function finalizarCotizacion(req, res) {
  const cotizacion = await buscarCotizacionPorId(req.params.id);
  if (!cotizacion) return res.status(404).json({ error: "Cotización no encontrada." });
  if (!esAdministrador(req.usuario.rol) && !esPropia(cotizacion, req)) {
    return res.status(403).json({ error: "No tienes permisos para modificar esta cotización." });
  }
  if (cotizacion.estado !== "calculada" && cotizacion.estado !== "finalizada") {
    return res.status(400).json({ error: "Debes calcular la cotización antes de finalizarla." });
  }
  const finalizada = cotizacion.estado === "finalizada"
    ? cotizacion
    : await actualizarEstadoCotizacion(cotizacion._id, "finalizada");
  await registrarAuditoria(req, { accion: "cotizacion.finalizada", entidad: "cotizacion", entidadId: cotizacion._id });
  return res.json(finalizada);
}

export async function eliminarCotizacion(req, res) {
  if (!esAdministrador(req.usuario.rol)) {
    return res.status(403).json({ error: "No tienes permisos para eliminar cotizaciones." });
  }
  const { passwordActual } = req.body || {};
  const actor = await findUsuarioById(req.usuario.id);
  if (!passwordActual || !actor || !(await bcrypt.compare(String(passwordActual), actor.passwordHash))) {
    return res.status(401).json({ error: "Confirma esta acción con tu contraseña actual." });
  }
  const eliminada = await eliminarCotizacionDb(req.params.id);
  if (!eliminada) return res.status(404).json({ error: "Cotización no encontrada." });
  await registrarAuditoria(req, { accion: "cotizacion.eliminada", entidad: "cotizacion", entidadId: eliminada._id });
  return res.json({ ok: true });
}
