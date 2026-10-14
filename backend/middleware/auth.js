import jwt from "jsonwebtoken";
import { findUsuarioById } from "../config/store.js";
import { obtenerJwtSecret } from "../utils/jwtSecret.js";
import { normalizarRol } from "../utils/roles.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Debes iniciar sesión para continuar." });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, obtenerJwtSecret());
    const usuario = await findUsuarioById(payload.id);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "Tu sesión no es válida o expiró." });
    }
    if (Number(payload.tokenVersion ?? -1) !== Number(usuario.tokenVersion || 0)) {
      return res.status(401).json({ error: "Tu sesión no es válida o expiró." });
    }
    const rol = normalizarRol(usuario.rol);
    if (!rol) {
      return res.status(403).json({ error: "Tu cuenta no tiene un rol válido." });
    }
    req.usuario = {
      id: String(usuario._id),
      rol,
      nombre: usuario.nombre,
      email: usuario.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Tu sesión no es válida o expiró." });
  }
}

// Restringe una ruta a ciertos roles (HDU-06)
export function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    const roles = rolesPermitidos.map(normalizarRol);
    if (!req.usuario || !roles.includes(normalizarRol(req.usuario.rol))) {
      return res
        .status(403)
        .json({ error: "No tienes permisos para realizar esta acción." });
    }
    next();
  };
}
