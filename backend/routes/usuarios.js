import { Router } from "express";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  registrar,
  login,
  cerrarSesion,
  listarUsuarios,
  crearUsuarioAdministrativo,
  listarAuditoria,
  actualizarRol,
  actualizarPassword,
  resetPassword,
  solicitarConfirmacion,
  confirmarPerfil,
  solicitarCodigoReset,
  solicitarAprobacionRolElevado,
  confirmarAprobacionRolElevado,
} from "../controllers/usuarioController.js";

const router = Router();

router.post("/registro", registrar);
router.post("/login", login);
router.post("/logout", requireAuth, cerrarSesion);
router.post("/", requireAuth, requireRol("ADMIN", "SUPERADMIN"), crearUsuarioAdministrativo);
router.post("/reset-password", resetPassword);
router.post("/solicitar-codigo-reset", solicitarCodigoReset);
router.post("/solicitar-confirmacion", requireAuth, solicitarConfirmacion);
router.post("/confirmar-configuracion", requireAuth, confirmarPerfil);
router.post("/aprobacion-rol/solicitar", requireAuth, requireRol("ADMIN", "SUPERADMIN"), solicitarAprobacionRolElevado);
router.post("/aprobacion-rol/confirmar", requireAuth, requireRol("ADMIN", "SUPERADMIN"), confirmarAprobacionRolElevado);
router.patch("/me/password", requireAuth, actualizarPassword);
router.patch("/:id/password", requireAuth, actualizarPassword);

// HDU-06: solo el administrador gestiona perfiles
router.get("/auditoria", requireAuth, requireRol("ADMIN", "SUPERADMIN"), listarAuditoria);
router.get("/", requireAuth, requireRol("ADMIN", "SUPERADMIN"), listarUsuarios);
router.patch("/:id", requireAuth, requireRol("ADMIN", "SUPERADMIN"), actualizarRol);

export default router;
