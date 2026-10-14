import pg from "pg";
import { SCHEMA_SQL } from "../db/schema.js";
import {
  EMBARCADORES,
  PARAMETROS,
  PUERTOS_DESTINO,
  PUERTOS_ORIGEN,
  TARIFAS_REFERENCIA,
} from "../db/datosIniciales.js";

// NUMERIC llega como texto por defecto; lo convertimos a número de JS.
pg.types.setTypeParser(1700, (valor) => (valor === null ? null : Number(valor)));
// BIGINT (ids de auditoría) como texto para no perder precisión.
pg.types.setTypeParser(20, (valor) => valor);

let pool = null;

function obtenerPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL. Conecta Neon al proyecto en Vercel (Storage) o defínela en backend/.env.");
  }
  const esLocal = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(connectionString);
  pool = new pg.Pool({
    connectionString,
    // Neon exige TLS; una base local de pruebas no lo usa.
    ssl: esLocal ? false : { rejectUnauthorized: true },
    // En Vercel cada función vive poco: pocas conexiones y que se cierren rápido.
    max: Number(process.env.PG_POOL_MAX || 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (error) => console.error("Error inesperado en la conexión a Postgres:", error.message));
  return pool;
}

export async function query(texto, valores = []) {
  return obtenerPool().query(texto, valores);
}

export async function transaccion(funcion) {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await funcion(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

async function cargarDatosIniciales(cliente) {
  const { rows } = await cliente.query("SELECT count(*)::int AS n FROM tarifas");
  if (rows[0].n === 0) {
    for (const nombre of EMBARCADORES) {
      await cliente.query("INSERT INTO embarcadores (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING", [nombre]);
    }
    for (const puerto of PUERTOS_ORIGEN) {
      await cliente.query(
        "INSERT INTO puertos (nombre, pais, tipo) VALUES ($1, $2, 'origen') ON CONFLICT (nombre, tipo) DO NOTHING",
        [puerto.nombre, puerto.pais]
      );
    }
    for (const puerto of PUERTOS_DESTINO) {
      await cliente.query(
        "INSERT INTO puertos (nombre, pais, tipo) VALUES ($1, $2, 'destino') ON CONFLICT (nombre, tipo) DO NOTHING",
        [puerto.nombre, puerto.pais]
      );
    }
    for (const [origen, destino, v20min, v20max, v40min, v40max, tmin, tmax, tipoRuta, fuente] of TARIFAS_REFERENCIA) {
      const ruta = await cliente.query(
        `INSERT INTO rutas (puerto_origen_id, puerto_destino_id, tipo_ruta)
         SELECT o.id, d.id, $3 FROM puertos o, puertos d
         WHERE o.nombre = $1 AND o.tipo = 'origen' AND d.nombre = $2 AND d.tipo = 'destino'
         ON CONFLICT (puerto_origen_id, puerto_destino_id) DO UPDATE SET tipo_ruta = EXCLUDED.tipo_ruta
         RETURNING id`,
        [origen, destino, tipoRuta]
      );
      const rutaId = ruta.rows[0].id;
      for (const [tipo, minimo, maximo] of [["20", v20min, v20max], ["40", v40min, v40max]]) {
        await cliente.query(
          `INSERT INTO tarifas (ruta_id, embarcador_id, tipo_contenedor, tarifa_min_usd, tarifa_max_usd,
                                transito_min_dias, transito_max_dias, fuente)
           SELECT $1, e.id, $2, $3, $4, $5, $6, $7 FROM embarcadores e
           ON CONFLICT (ruta_id, embarcador_id, tipo_contenedor) DO NOTHING`,
          [rutaId, tipo, minimo, maximo, tmin, tmax, `${fuente} (referencial)`]
        );
      }
    }
  }
  for (const parametro of PARAMETROS) {
    await cliente.query(
      "INSERT INTO parametros (nombre, valor, descripcion) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO NOTHING",
      [parametro.nombre, parametro.valor, parametro.descripcion]
    );
  }
}

let preparacion = null;

// Crea las tablas y carga los datos iniciales si faltan. Es idempotente y se
// ejecuta una sola vez por instancia; un candado evita que dos instancias de
// Vercel lo hagan al mismo tiempo.
export function asegurarBaseDeDatos() {
  if (!preparacion) {
    preparacion = transaccion(async (cliente) => {
      await cliente.query("SELECT pg_advisory_xact_lock(424242)");
      await cliente.query(SCHEMA_SQL);
      await cargarDatosIniciales(cliente);
    }).catch((error) => {
      preparacion = null;
      throw error;
    });
  }
  return preparacion;
}

export async function cerrarConexiones() {
  if (pool) await pool.end();
  pool = null;
  preparacion = null;
}
