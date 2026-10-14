import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { obtenerJwtSecret } from "../utils/jwtSecret.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { esAdministrador, esSuperadministrador, normalizarRol } from "../utils/roles.js";
import { enviarCodigoVerificacion, enviarCodigoAprobacionRol } from "../utils/email.js";
import {
  crearUsuario,
  existeUsuario,
  findUsuarioById,
  findUsuarioByLogin,
  listarUsuariosMemory,
  listarAuditoriaMemory,
  actualizarRolUsuario,
  actualizarPasswordUsuario,
  actualizarPerfilUsuario,
  revocarSesionesUsuario,
  crearAprobacionRolElevado,
  buscarAprobacionRolElevado,
  registrarIntentoAprobacionRolElevado,
  eliminarAprobacionRolElevado,
  guardarCodigosUsuario,
  guardarCodigoAprobacion,
} from "../config/store.js";

function firmarToken(usuario) {
  return jwt.sign(
    {
      id: usuario._id,
      rol: normalizarRol(usuario.rol),
      nombre: usuario.nombre,
      tokenVersion: Number(usuario.tokenVersion) || 0,
    },
    obtenerJwtSecret(),
    { expiresIn: "45m" }
  );
}

function datosPublicos(usuario) {
  return {
    id: String(usuario._id),
    nombre: usuario.nombre,
    username: usuario.username,
    email: usuario.email,
    rol: normalizarRol(usuario.rol),
  };
}

function passwordCumplePolitica(password) {
  return typeof password === "string" && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function generarCodigoVerificacion() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashCodigoVerificacion(codigo) {
  return crypto.createHash("sha256").update(String(codigo)).digest("hex");
}

function hashCodigoAprobacion(id, codigo) {
  return crypto.createHash("sha256").update(`${id}:${codigo}`).digest("hex");
}

function codigoVerificacionValido(usuario, codigo, campoHash, campoExpiracion) {
  const hashGuardado = usuario?.[campoHash];
  const expiraEn = new Date(usuario?.[campoExpiracion] || 0).getTime();
  if (!hashGuardado || Date.now() > expiraEn || !/^\d{6}$/.test(String(codigo || ""))) return false;

  const hashIngresado = Buffer.from(hashCodigoVerificacion(codigo), "hex");
  const hashAlmacenado = Buffer.from(hashGuardado, "hex");
  return hashIngresado.length === hashAlmacenado.length && crypto.timingSafeEqual(hashIngresado, hashAlmacenado);
}

async function obtenerActorConfirmado(id, passwordActual) {
  const actor = await findUsuarioById(id);
  if (!passwordActual || !actor || !(await bcrypt.compare(String(passwordActual), actor.passwordHash))) return null;
  return actor;
}

export async function registrar(req, res) {
  try {
    const { nombre, username, email, password, confirmarPassword } = req.body;
    if (!nombre || !username || !email || !password) {
      return res.status(400).json({ error: "Nombre, usuario, email y contraseña son obligatorios." });
    }

    const nombreNormalizado = String(nombre).trim();
    const usernameNormalizado = String(username).trim().toLowerCase();
    const emailNormalizado = String(email).trim().toLowerCase();
    if (nombreNormalizado.length > 100 || usernameNormalizado.length < 3 || usernameNormalizado.length > 50 || emailNormalizado.length > 254) {
      return res.status(400).json({ error: "Revisa la longitud del nombre, usuario o correo." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      return res.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }
    if (!passwordCumplePolitica(password)) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres e incluir letras y números." });
    }
    if (!confirmarPassword || password !== confirmarPassword) {
      return res.status(400).json({ error: "Las contraseñas no coinciden." });
    }
    if (await existeUsuario(usernameNormalizado, emailNormalizado)) {
      return res.status(409).json({ error: "Ya existe un usuario con ese nombre de usuario o email." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await crearUsuario({
      nombre: nombreNormalizado,
      username: usernameNormalizado,
      email: emailNormalizado,
      passwordHash,
      rol: "USER",
      activo: true,
    });

    return res.status(201).json({ token: firmarToken(usuario), usuario: datosPublicos(usuario) });
  } catch (error) {
    console.error("No se pudo crear el usuario.", error);
    return res.status(500).json({ error: "No se pudo crear el usuario." });
  }
}

export async function login(req, res) {
  try {
    const { identifier, email, username, password } = req.body;
    const valor = String((identifier ?? email ?? username ?? "") || "").trim();
    if (!valor || !password) {
      return res.status(400).json({ error: "Usuario o email y contraseña son obligatorios." });
    }

    const usuario = await findUsuarioByLogin(valor);
    if (!usuario || !usuario.activo || !(await bcrypt.compare(password, usuario.passwordHash))) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }

    return res.json({ token: firmarToken(usuario), usuario: datosPublicos(usuario) });
  } catch (error) {
    console.error("No se pudo iniciar sesión.", error);
    return res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
}

export async function cerrarSesion(req, res) {
  await revocarSesionesUsuario(req.usuario.id);
  return res.json({ ok: true });
}

export async function actualizarPassword(req, res) {
  try {
    const { id } = req.params;
    const { password, nuevaPassword, passwordActual, codigo } = req.body;
    const esAdmin = esAdministrador(req.usuario?.rol);
    const usuarioObjetivo = req.path === "/me/password" ? req.usuario?.id : id;
    if (!usuarioObjetivo) return res.status(400).json({ error: "No se pudo identificar el usuario." });

    const esPropioUsuario = usuarioObjetivo === req.usuario?.id;
    if (!esAdmin && !esPropioUsuario) {
      return res.status(403).json({ error: "No tienes permisos para cambiar esta contraseña." });
    }

    const nuevaClave = String(nuevaPassword || "").trim();
    if (!passwordCumplePolitica(nuevaClave)) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números." });
    }

    const usuario = await findUsuarioById(usuarioObjetivo);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });
    if (esAdmin && !esSuperadministrador(req.usuario?.rol) && !esPropioUsuario && esAdministrador(usuario.rol)) {
      return res.status(403).json({ error: "Solo un superadministrador puede cambiar la contraseña de otro administrador." });
    }

    if (esPropioUsuario) {
      if (!password || !(await bcrypt.compare(String(password), usuario.passwordHash))) {
        return res.status(401).json({ error: "La contraseña actual no es correcta." });
      }
      if (!codigoVerificacionValido(usuario, codigo, "confirmationCodeHash", "confirmationCodeExpiresAt")) {
        return res.status(401).json({ error: "El código de confirmación es inválido o expiró." });
      }
    } else if (esAdmin && !(await obtenerActorConfirmado(req.usuario.id, passwordActual))) {
      return res.status(401).json({ error: "Confirma esta acción con tu contraseña actual." });
    }

    usuario.confirmationCodeHash = null;
    usuario.confirmationCodeExpiresAt = null;
    const actualizado = await actualizarPasswordUsuario(usuarioObjetivo, await bcrypt.hash(nuevaClave, 10));
    if (!actualizado) return res.status(404).json({ error: "Usuario no encontrado." });
    if (esAdmin) {
      await registrarAuditoria(req, { accion: "usuario.password.actualizado", entidad: "usuario", entidadId: usuarioObjetivo });
    }
    return res.json({ ok: true, logoutRequired: esPropioUsuario, message: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error("No se pudo actualizar la contraseña.", error);
    return res.status(500).json({ error: "No se pudo actualizar la contraseña." });
  }
}

export async function resetPassword(req, res) {
  try {
    const { identifier, password, nuevaPassword, codigo, email } = req.body;
    const valor = String(identifier || email || "").trim();
    const nuevaClave = String(nuevaPassword || "").trim();
    const requiereCodigo = Boolean(codigo || email);

    if (!valor || !nuevaClave) {
      return res.status(400).json({ error: "Debes indicar usuario/email y la nueva contraseña." });
    }
    if (!passwordCumplePolitica(nuevaClave)) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números." });
    }

    const usuario = await findUsuarioByLogin(valor);
    if (!usuario) return res.status(401).json({ error: "El código de confirmación es inválido o expiró." });
    if (email && String(email).trim().toLowerCase() !== String(usuario.email || "").toLowerCase()) {
      return res.status(401).json({ error: "El código de confirmación es inválido o expiró." });
    }
    if (requiereCodigo) {
      if (!codigoVerificacionValido(usuario, codigo, "resetCodeHash", "resetCodeExpiresAt")) {
        return res.status(401).json({ error: "El código de confirmación es inválido o expiró." });
      }
    } else if (!password || !(await bcrypt.compare(String(password), usuario.passwordHash))) {
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }

    usuario.resetCodeHash = null;
    usuario.resetCodeExpiresAt = null;
    const actualizado = await actualizarPasswordUsuario(usuario._id, await bcrypt.hash(nuevaClave, 10));
    if (!actualizado) return res.status(404).json({ error: "Usuario no encontrado." });

    return res.json({
      ok: true,
      message: "Contraseña actualizada correctamente.",
      token: firmarToken(actualizado),
      usuario: datosPublicos(actualizado),
    });
  } catch (error) {
    console.error("No se pudo restablecer la contraseña.", error);
    return res.status(500).json({ error: "No se pudo restablecer la contraseña." });
  }
}

export async function solicitarCodigoReset(req, res) {
  try {
    const valor = String(req.body.identifier || req.body.email || "").trim();
    if (!valor) return res.status(400).json({ error: "Debes indicar tu correo electrónico." });

    const usuario = await findUsuarioByLogin(valor);
    const respuestaGenerica = {
      ok: true,
      message: "Si la cuenta existe, enviaremos un código al correo registrado.",
    };
    const destino = String(usuario?.email || "").trim().toLowerCase();
    if (!usuario || !destino) return res.status(202).json(respuestaGenerica);

    const codigo = generarCodigoVerificacion();
    usuario.resetCodeHash = hashCodigoVerificacion(codigo);
    usuario.resetCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await guardarCodigosUsuario(usuario);
    try {
      await enviarCodigoVerificacion(destino, codigo);
    } catch {
      usuario.resetCodeHash = null;
      usuario.resetCodeExpiresAt = null;
      await guardarCodigosUsuario(usuario);
    }
    return res.status(202).json(respuestaGenerica);
  } catch (error) {
    console.error("No se pudo generar el código de verificación.", error);
    return res.status(500).json({ error: "No se pudo generar el código de verificación." });
  }
}

export async function solicitarConfirmacion(req, res) {
  try {
    const usuario = await findUsuarioById(req.usuario?.id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });
    const destino = String(usuario.email || "").trim().toLowerCase();
    if (!destino) {
      return res.status(400).json({ error: "No hay un correo asociado para enviar la confirmación." });
    }

    const codigo = generarCodigoVerificacion();
    usuario.confirmationCodeHash = hashCodigoVerificacion(codigo);
    usuario.confirmationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await guardarCodigosUsuario(usuario);
    try {
      await enviarCodigoVerificacion(destino, codigo);
    } catch (error) {
      usuario.confirmationCodeHash = null;
      usuario.confirmationCodeExpiresAt = null;
      await guardarCodigosUsuario(usuario);
      console.error("No fue posible enviar el código de confirmación.", error);
      return res.status(503).json({ error: "No fue posible enviar el código. Contacta al administrador del sistema." });
    }

    return res.json({ ok: true, message: "Se envió un código de confirmación al correo registrado." });
  } catch (error) {
    console.error("No se pudo generar la confirmación para el cambio.", error);
    return res.status(500).json({ error: "No se pudo generar la confirmación para el cambio." });
  }
}

export async function confirmarPerfil(req, res) {
  try {
    const { userId: userIdSolicitado, codigo, username, email, nuevaPassword, password } = req.body;
    const userId = String(req.usuario?.id || "");
    if (!userId || !codigo) return res.status(400).json({ error: "Falta información para confirmar el cambio." });
    if (userIdSolicitado && String(userIdSolicitado) !== userId) {
      return res.status(403).json({ error: "No puedes modificar el perfil de otro usuario." });
    }

    const usuario = await findUsuarioById(userId);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });
    if (!codigoVerificacionValido(usuario, codigo, "confirmationCodeHash", "confirmationCodeExpiresAt")) {
      return res.status(401).json({ error: "El código de confirmación es inválido o expiró." });
    }

    const usernameNormalizado = String(username || usuario.username).trim().toLowerCase();
    const emailNormalizado = String(email || usuario.email).trim().toLowerCase();
    const usuarioDuplicado = await findUsuarioByLogin(usernameNormalizado);
    if (usuarioDuplicado && String(usuarioDuplicado._id) !== userId) {
      return res.status(409).json({ error: "Ya existe ese nombre de usuario." });
    }
    const emailDuplicado = await findUsuarioByLogin(emailNormalizado);
    if (emailDuplicado && String(emailDuplicado._id) !== userId) {
      return res.status(409).json({ error: "Ya existe ese correo electrónico." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      return res.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }

    let passwordHash = usuario.passwordHash;
    const cambiaPassword = Boolean(nuevaPassword && String(nuevaPassword).trim());
    if (cambiaPassword) {
      const clave = String(nuevaPassword).trim();
      if (!passwordCumplePolitica(clave)) {
        return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números." });
      }
      if (!password || !(await bcrypt.compare(String(password), usuario.passwordHash))) {
        return res.status(401).json({ error: "La contraseña actual no es correcta." });
      }
      passwordHash = await bcrypt.hash(clave, 10);
    }

    usuario.confirmationCodeHash = null;
    usuario.confirmationCodeExpiresAt = null;
    const actualizado = await actualizarPerfilUsuario(userId, {
      username: usernameNormalizado,
      email: emailNormalizado,
      passwordHash,
    });
    if (!actualizado) return res.status(404).json({ error: "Usuario no encontrado." });
    return res.json({ ok: true, logoutRequired: cambiaPassword, message: "Configuración confirmada correctamente." });
  } catch (error) {
    console.error("No se pudo confirmar el cambio de configuración.", error);
    return res.status(500).json({ error: "No se pudo confirmar el cambio de configuración." });
  }
}

export async function listarUsuarios(_req, res) {
  return res.json(await listarUsuariosMemory());
}

export async function crearUsuarioAdministrativo(req, res) {
  try {
    const { nombre, username, email, password, confirmarPassword, passwordActual } = req.body;
    const nombreNormalizado = String(nombre || "").trim();
    const usernameNormalizado = String(username || "").trim().toLowerCase();
    const emailNormalizado = String(email || "").trim().toLowerCase();
    const rol = normalizarRol(req.body.rol || "USER");
    if (!nombreNormalizado || !usernameNormalizado || !emailNormalizado || !password || !confirmarPassword) {
      return res.status(400).json({ error: "Nombre, usuario, correo y contraseña con confirmación son obligatorios." });
    }
    if (nombreNormalizado.length > 100 || usernameNormalizado.length < 3 || usernameNormalizado.length > 50 || emailNormalizado.length > 254) {
      return res.status(400).json({ error: "Revisa la longitud del nombre, usuario o correo." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      return res.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }
    if (!passwordCumplePolitica(password) || password !== confirmarPassword) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres, incluir letras y números y coincidir con su confirmación." });
    }
    if (rol !== "USER") {
      return res.status(403).json({ error: "Los roles administrativos y de jefatura requieren aprobación por correo desde Configuración." });
    }
    if (await existeUsuario(usernameNormalizado, emailNormalizado)) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese usuario o correo." });
    }

    const usuario = await crearUsuario({
      nombre: nombreNormalizado,
      username: usernameNormalizado,
      email: emailNormalizado,
      passwordHash: await bcrypt.hash(password, 10),
      rol,
    });
    await registrarAuditoria(req, { accion: "usuario.creado", entidad: "usuario", entidadId: usuario._id });
    return res.status(201).json({
      id: usuario._id,
      nombre: usuario.nombre,
      username: usuario.username,
      email: usuario.email,
      rol: normalizarRol(usuario.rol),
      activo: usuario.activo,
    });
  } catch (error) {
    console.error("No se pudo crear el usuario administrativo.", error);
    return res.status(500).json({ error: "No se pudo crear el usuario." });
  }
}

export async function solicitarAprobacionRolElevado(req, res) {
  try {
    const { nombre, username, email, password, confirmarPassword, passwordActual, rol } = req.body;
    const nombreNormalizado = String(nombre || "").trim();
    const usernameNormalizado = String(username || "").trim().toLowerCase();
    const emailNormalizado = String(email || "").trim().toLowerCase();
    const rolSolicitado = normalizarRol(rol);
    const correoPrincipal = String(process.env.ADMIN_APPROVAL_EMAIL || "").trim().toLowerCase();

    if (!nombreNormalizado || !usernameNormalizado || !emailNormalizado || !password || !confirmarPassword) {
      return res.status(400).json({ error: "Completa nombre, usuario, correo y contraseña con su confirmación." });
    }
    if (nombreNormalizado.length > 100 || usernameNormalizado.length < 3 || usernameNormalizado.length > 50 || emailNormalizado.length > 254) {
      return res.status(400).json({ error: "Revisa la longitud del nombre, usuario o correo." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      return res.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }
    if (!["ADMIN", "JEFE_ABASTECIMIENTO"].includes(rolSolicitado)) {
      return res.status(400).json({ error: "Solo puedes solicitar los roles Administrador o Jefatura." });
    }
    if (!passwordCumplePolitica(password) || password !== confirmarPassword) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres, incluir letras y números y coincidir con su confirmación." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoPrincipal)) {
      return res.status(503).json({ error: "El correo principal de aprobación no está configurado." });
    }
    if (!(await obtenerActorConfirmado(req.usuario.id, passwordActual))) {
      return res.status(401).json({ error: "Confirma esta solicitud con tu contraseña actual." });
    }
    if (await existeUsuario(usernameNormalizado, emailNormalizado)) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese usuario o correo." });
    }

    const aprobacion = await crearAprobacionRolElevado({
      solicitanteId: req.usuario.id,
      nombre: nombreNormalizado,
      username: usernameNormalizado,
      email: emailNormalizado,
      passwordHash: await bcrypt.hash(password, 10),
      rol: rolSolicitado,
      correoPrincipal,
      codigoHash: "",
      expiraEn: Date.now() + 10 * 60 * 1000,
    });
    const codigo = generarCodigoVerificacion();
    aprobacion.codigoHash = hashCodigoAprobacion(aprobacion._id, codigo);
    await guardarCodigoAprobacion(aprobacion._id, aprobacion.codigoHash);

    try {
      await enviarCodigoAprobacionRol(correoPrincipal, codigo, {
        username: usernameNormalizado,
        rol: rolSolicitado,
      });
    } catch (error) {
      await eliminarAprobacionRolElevado(aprobacion._id);
      console.error("No se pudo enviar el código de aprobación al correo principal.", error);
      return res.status(503).json({ error: "No se pudo enviar el código. Revisa la configuración del correo y vuelve a intentar." });
    }

    const [local, dominio] = correoPrincipal.split("@");
    const correoEnmascarado = `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${dominio}`;
    return res.status(202).json({
      challengeId: aprobacion._id,
      correoEnmascarado,
      expiraEnSegundos: 600,
      message: "Se envió el código de aprobación al correo principal.",
    });
  } catch (error) {
    console.error("No se pudo solicitar la aprobación del rol.", error);
    return res.status(500).json({ error: "No se pudo solicitar la aprobación del rol." });
  }
}

export async function confirmarAprobacionRolElevado(req, res) {
  try {
    const challengeId = String(req.body.challengeId || "");
    const codigo = String(req.body.codigo || "");
    if (!/^[\da-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ error: "El código de aprobación o la solicitud no son válidos." });
    }

    const aprobacion = await buscarAprobacionRolElevado(challengeId);
    if (!aprobacion || aprobacion.solicitanteId !== req.usuario.id) {
      return res.status(401).json({ error: "La solicitud expiró o no está disponible. Inicia una nueva solicitud." });
    }

    const codigoIngresado = Buffer.from(hashCodigoAprobacion(challengeId, codigo), "hex");
    const codigoGuardado = Buffer.from(aprobacion.codigoHash, "hex");
    if (codigoIngresado.length !== codigoGuardado.length || !crypto.timingSafeEqual(codigoIngresado, codigoGuardado)) {
      const intentosRestantes = await registrarIntentoAprobacionRolElevado(challengeId);
      return res.status(401).json({
        error: intentosRestantes === 0
          ? "Se agotaron los intentos. Inicia una nueva solicitud."
          : "El código de aprobación es incorrecto.",
      });
    }

    await eliminarAprobacionRolElevado(challengeId);
    if (await existeUsuario(aprobacion.username, aprobacion.email)) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese usuario o correo." });
    }

    const usuario = await crearUsuario({
      nombre: aprobacion.nombre,
      username: aprobacion.username,
      email: aprobacion.email,
      passwordHash: aprobacion.passwordHash,
      rol: aprobacion.rol,
    });
    await registrarAuditoria(req, {
      accion: "usuario.rol_elevado.aprobado",
      entidad: "usuario",
      entidadId: usuario._id,
    });
    return res.status(201).json({
      usuario: datosPublicos(usuario),
      message: "La cuenta se creó con el rol aprobado.",
    });
  } catch (error) {
    console.error("No se pudo confirmar la aprobación del rol.", error);
    return res.status(500).json({ error: "No se pudo confirmar la aprobación del rol." });
  }
}

export async function listarAuditoria(req, res) {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  return res.json(await listarAuditoriaMemory(limit));
}

export async function actualizarRol(req, res) {
  const { id } = req.params;
  const { rol, activo, passwordActual } = req.body;
  const rolSolicitado = rol === undefined ? undefined : normalizarRol(rol);
  const actorEsSuperadmin = esSuperadministrador(req.usuario?.rol);
  if (String(id) === String(req.usuario?.id)) {
    return res.status(403).json({ error: "No puedes modificar tu propio rol o estado." });
  }
  if (rol !== undefined && !rolSolicitado) {
    return res.status(400).json({ error: "El rol solicitado no es válido." });
  }
  if (rolSolicitado && rolSolicitado !== "USER") {
    return res.status(403).json({ error: "Los roles administrativos y de jefatura requieren aprobación por correo desde Configuración." });
  }

  const usuarioObjetivo = await findUsuarioById(id);
  if (!usuarioObjetivo) return res.status(404).json({ error: "Usuario no encontrado." });
  const rolActual = normalizarRol(usuarioObjetivo.rol);
  if (!actorEsSuperadmin && rolActual !== "USER") {
    return res.status(403).json({ error: "Solo un superadministrador puede gestionar administradores." });
  }
  const requiereReautenticacion = (rolSolicitado && rolSolicitado !== "USER") || (activo === false && rolActual !== "USER");
  if (requiereReautenticacion && !(await obtenerActorConfirmado(req.usuario.id, passwordActual))) {
    return res.status(401).json({ error: "Confirma esta acción con tu contraseña actual." });
  }

  const usuario = await actualizarRolUsuario(id, { rol: rolSolicitado, activo });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });
  await registrarAuditoria(req, { accion: "usuario.actualizado", entidad: "usuario", entidadId: id });
  return res.json(usuario);
}
