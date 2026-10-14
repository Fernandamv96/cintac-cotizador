import { crearAuditoriaMemory } from "../config/store.js";

export async function registrarAuditoria(req, evento) {
  const registro = {
    actorId: String(req.usuario?.id || "desconocido"),
    actorNombre: String(req.usuario?.nombre || "Usuario"),
    rol: String(req.usuario?.rol || "desconocido"),
    accion: evento.accion,
    entidad: evento.entidad,
    entidadId: String(evento.entidadId || ""),
    resultado: evento.resultado || "exitoso",
    ip: String(req.ip || ""),
  };

  return crearAuditoriaMemory(registro);
}