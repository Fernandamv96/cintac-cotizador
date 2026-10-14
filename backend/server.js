import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import cotizacionesRouter from "./routes/cotizaciones.js";
import usuariosRouter from "./routes/usuarios.js";
import tipoCambioRouter from "./routes/tipoCambio.js";
import tarifasRouter from "./routes/tarifas.js";
import { asegurarBaseDeDatos } from "./config/db.js";
import { ensureConfiguredSuperadmin, ensureDefaultAdmin } from "./utils/seedAdmin.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());

const origenesPermitidos = (process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173"))
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);

app.use(cors({
  origin(origen, callback) {
    callback(null, !origen || origenesPermitidos.includes(origen));
  },
}));
app.use(express.json());

const limiterAutenticacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta nuevamente más tarde." },
});
app.use([
  "/api/usuarios/login",
  "/api/usuarios/registro",
  "/api/usuarios/reset-password",
  "/api/usuarios/solicitar-codigo-reset",
  "/api/usuarios/solicitar-confirmacion",
  "/api/usuarios/confirmar-configuracion",
  "/api/usuarios/aprobacion-rol/solicitar",
  "/api/usuarios/aprobacion-rol/confirmar",
], limiterAutenticacion);

// Prepara la base de datos (tablas y datos iniciales) y la cuenta administradora.
// Solo trabaja la primera vez en cada instancia; después responde de inmediato.
let accesoListo = null;
function prepararAcceso() {
  if (!accesoListo) {
    accesoListo = (async () => {
      await asegurarBaseDeDatos();
      await ensureDefaultAdmin();
      await ensureConfiguredSuperadmin();
    })().catch((error) => {
      accesoListo = null;
      throw error;
    });
  }
  return accesoListo;
}

app.use(async (req, res, next) => {
  try {
    await prepararAcceso();
    next();
  } catch (error) {
    console.error("No se pudo inicializar el cotizador.", error);
    res.status(500).json({ error: "No se pudo conectar con la base de datos. Revisa DATABASE_URL y ADMIN_INITIAL_PASSWORD." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, baseDeDatos: "postgres" }));
app.use("/api/usuarios", usuariosRouter);
app.use("/api/cotizaciones", cotizacionesRouter);
app.use("/api/tipo-cambio", tipoCambioRouter);
app.use("/api/tarifas", tarifasRouter);

// Manejo de errores no capturados
app.use((err, req, res, next) => {
  console.error(`Error API ${req.method} ${req.path}`, err?.message);
  res.status(500).json({ error: "Ocurrió un error inesperado en el servidor." });
});

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, "127.0.0.1", () => console.log(`Servidor corriendo en http://127.0.0.1:${PORT}`));
}

export default app;
