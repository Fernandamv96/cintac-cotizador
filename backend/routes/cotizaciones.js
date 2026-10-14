import { Router } from "express";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  crearCotizacion,
  calcularCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
  compararCotizaciones,
  finalizarCotizacion,
  eliminarCotizacion,
  previsualizarTarifaCotizacion,
  obtenerCatalogoCotizacion,
} from "../controllers/cotizacionController.js";

const router = Router();

router.use(requireAuth);

router.get("/catalogo", obtenerCatalogoCotizacion);
router.get("/tarifa", previsualizarTarifaCotizacion);
router.get("/comparar", compararCotizaciones);
router.get("/", listarCotizaciones);
router.get("/:id", obtenerCotizacion);
router.post("/", crearCotizacion);
router.post("/:id/calcular", calcularCotizacion);
router.post("/:id/finalizar", finalizarCotizacion);
router.delete("/:id", requireRol("ADMIN", "SUPERADMIN"), eliminarCotizacion);

export default router;
