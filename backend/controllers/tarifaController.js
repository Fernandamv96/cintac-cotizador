// Mantenedor de tarifas y parámetros (HDU-07, RF-07, RF-10).
// Comex declaró que jefatura y analistas tienen acceso total, por eso cualquier
// usuario autenticado puede editar; cada cambio queda con usuario y fecha y en
// la auditoría.
import { registrarAuditoria } from "../utils/auditoria.js";
import {
  actualizarEmbarcador,
  actualizarParametro,
  actualizarTarifa,
  crearEmbarcador,
  listarTarifas,
  obtenerCatalogo,
  obtenerParametros,
} from "../config/store.js";

const LIMITES_PARAMETROS = {
  iva: { min: 0, max: 1, mensaje: "El IVA debe estar entre 0 y 1 (por ejemplo 0.19)." },
  arancel: { min: 0, max: 1, mensaje: "El arancel debe estar entre 0 y 1 (por ejemplo 0.06)." },
  toneladas_por_contenedor: { min: 1, max: 40, mensaje: "El tope debe estar entre 1 y 40 toneladas." },
  margen_contingencia_dias: { min: 0, max: 365, entero: true, mensaje: "El margen debe ser un entero entre 0 y 365 días." },
};

export async function listar(req, res) {
  try {
    const [tarifas, catalogo, parametros] = await Promise.all([
      listarTarifas({
        puertoOrigen: req.query.puertoOrigen ? String(req.query.puertoOrigen) : undefined,
        puertoDestino: req.query.puertoDestino ? String(req.query.puertoDestino) : undefined,
      }),
      obtenerCatalogo(),
      obtenerParametros(),
    ]);
    return res.json({ tarifas, ...catalogo, parametros });
  } catch (error) {
    console.error("No se pudieron listar las tarifas.", error);
    return res.status(500).json({ error: "No se pudieron cargar las tarifas." });
  }
}

export async function actualizar(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Tarifa no válida." });
  const b = req.body || {};
  const cambios = {
    tarifaMinUSD: Number(b.tarifaMinUSD),
    tarifaMaxUSD: Number(b.tarifaMaxUSD),
    transitoMinDias: Number(b.transitoMinDias),
    transitoMaxDias: Number(b.transitoMaxDias),
    fuente: String(b.fuente ?? "").trim().slice(0, 120) || "Ingresada por Comex",
    activa: b.activa !== false,
  };
  if (![cambios.tarifaMinUSD, cambios.tarifaMaxUSD].every((n) => Number.isFinite(n) && n >= 0)) {
    return res.status(400).json({ error: "Las tarifas deben ser números mayores o iguales a cero." });
  }
  if (cambios.tarifaMinUSD > cambios.tarifaMaxUSD) {
    return res.status(400).json({ error: "La tarifa mínima no puede ser mayor que la máxima." });
  }
  if (![cambios.transitoMinDias, cambios.transitoMaxDias].every((n) => Number.isInteger(n) && n > 0 && n <= 365)) {
    return res.status(400).json({ error: "Los días de tránsito deben ser enteros entre 1 y 365." });
  }
  if (cambios.transitoMinDias > cambios.transitoMaxDias) {
    return res.status(400).json({ error: "El tránsito mínimo no puede ser mayor que el máximo." });
  }
  try {
    const tarifa = await actualizarTarifa(id, cambios, req.usuario.id);
    if (!tarifa) return res.status(404).json({ error: "Tarifa no encontrada." });
    await registrarAuditoria(req, { accion: "tarifa.actualizada", entidad: "tarifa", entidadId: id });
    return res.json(tarifa);
  } catch (error) {
    console.error("No se pudo actualizar la tarifa.", error);
    return res.status(500).json({ error: "No se pudo guardar la tarifa." });
  }
}

export async function actualizarParametroCtrl(req, res) {
  const nombre = String(req.params.nombre || "");
  const limite = LIMITES_PARAMETROS[nombre];
  if (!limite) return res.status(404).json({ error: "Parámetro no encontrado." });
  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor < limite.min || valor > limite.max || (limite.entero && !Number.isInteger(valor))) {
    return res.status(400).json({ error: limite.mensaje });
  }
  try {
    const parametro = await actualizarParametro(nombre, valor, req.usuario.id);
    if (!parametro) return res.status(404).json({ error: "Parámetro no encontrado." });
    await registrarAuditoria(req, { accion: "parametro.actualizado", entidad: "parametro", entidadId: nombre });
    return res.json(parametro);
  } catch (error) {
    console.error("No se pudo actualizar el parámetro.", error);
    return res.status(500).json({ error: "No se pudo guardar el parámetro." });
  }
}

export async function crearEmbarcadorCtrl(req, res) {
  const nombre = String(req.body?.nombre || "").trim();
  if (nombre.length < 2 || nombre.length > 100) {
    return res.status(400).json({ error: "El nombre del embarcador debe tener entre 2 y 100 caracteres." });
  }
  try {
    const embarcador = await crearEmbarcador(nombre, req.usuario.id);
    await registrarAuditoria(req, { accion: "embarcador.creado", entidad: "embarcador", entidadId: embarcador.id });
    return res.status(201).json(embarcador);
  } catch (error) {
    console.error("No se pudo crear el embarcador.", error);
    return res.status(500).json({ error: "No se pudo crear el embarcador." });
  }
}

export async function actualizarEmbarcadorCtrl(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Embarcador no válido." });
  const nombre = req.body?.nombre === undefined ? "" : String(req.body.nombre).trim().slice(0, 100);
  try {
    const embarcador = await actualizarEmbarcador(id, { nombre, activo: req.body?.activo });
    if (!embarcador) return res.status(404).json({ error: "Embarcador no encontrado." });
    await registrarAuditoria(req, { accion: "embarcador.actualizado", entidad: "embarcador", entidadId: id });
    return res.json(embarcador);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ya existe un embarcador con ese nombre." });
    console.error("No se pudo actualizar el embarcador.", error);
    return res.status(500).json({ error: "No se pudo actualizar el embarcador." });
  }
}
