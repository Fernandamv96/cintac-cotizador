// Crea las tablas y carga los datos iniciales en la base indicada por DATABASE_URL.
// Uso:  npm run db:setup   (también ocurre solo en el primer request al servidor)
import "dotenv/config";
import { asegurarBaseDeDatos, cerrarConexiones, query } from "../config/db.js";

try {
  await asegurarBaseDeDatos();
  const { rows } = await query(`
    SELECT (SELECT count(*) FROM embarcadores)::int AS embarcadores,
           (SELECT count(*) FROM rutas)::int AS rutas,
           (SELECT count(*) FROM tarifas)::int AS tarifas,
           (SELECT count(*) FROM parametros)::int AS parametros,
           (SELECT count(*) FROM usuarios)::int AS usuarios`);
  console.log("Base de datos lista:", rows[0]);
} catch (error) {
  console.error("No se pudo preparar la base de datos:", error.message);
  process.exitCode = 1;
} finally {
  await cerrarConexiones();
}
