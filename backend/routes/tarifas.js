import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  actualizar,
  actualizarEmbarcadorCtrl,
  actualizarParametroCtrl,
  crearEmbarcadorCtrl,
  listar,
} from "../controllers/tarifaController.js";

const router = Router();

router.use(requireAuth);

router.get("/", listar);
router.put("/:id", actualizar);
router.put("/parametros/:nombre", actualizarParametroCtrl);
router.post("/embarcadores", crearEmbarcadorCtrl);
router.patch("/embarcadores/:id", actualizarEmbarcadorCtrl);

export default router;
