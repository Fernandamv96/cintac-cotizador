// Pruebas de integración de la API contra una base PostgreSQL real.
// Se ejecutan solo si existe TEST_DATABASE_URL (una base de pruebas, NUNCA la de producción):
//   TEST_DATABASE_URL=postgres://... npm test
// Cada ejecución borra y recrea las tablas de esa base.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const URL_PRUEBAS = process.env.TEST_DATABASE_URL;
const omitir = !URL_PRUEBAS && "sin TEST_DATABASE_URL: se omiten las pruebas de integración";

let servidor;
let base;
let db;
const ADMIN = { identifier: "Cintac_Admin", password: "PruebaAdmin2026" };

async function llamar(ruta, { metodo = "GET", token, cuerpo } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: respuesta.status, datos: await respuesta.json().catch(() => ({})) };
}

async function iniciarSesion(credenciales) {
  const { status, datos } = await llamar("/usuarios/login", { metodo: "POST", cuerpo: credenciales });
  assert.equal(status, 200);
  return datos.token;
}

before(async () => {
  if (omitir) return;
  Object.assign(process.env, {
    DATABASE_URL: URL_PRUEBAS,
    NODE_ENV: "production", // evita que server.js abra su propio puerto
    JWT_SECRET: "clave-de-pruebas-de-integracion-con-mas-de-32-bytes",
    ADMIN_INITIAL_PASSWORD: ADMIN.password,
  });
  db = await import("../config/db.js");
  await db.query(`DROP TABLE IF EXISTS auditoria, aprobaciones_rol, cotizaciones, tarifas, rutas, puertos,
                  embarcadores, parametros, tipo_cambio, usuarios CASCADE`);
  await db.asegurarBaseDeDatos();
  // Valor de respaldo del dólar por si mindicador.cl no responde durante la prueba.
  await db.query("INSERT INTO tipo_cambio (fecha, valor) VALUES (CURRENT_DATE, 950) ON CONFLICT DO NOTHING");
  const { default: app } = await import("../server.js");
  await new Promise((resolve) => {
    servidor = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(async () => {
  if (omitir) return;
  await new Promise((resolve) => servidor.close(resolve));
  await db.cerrarConexiones();
});

test("IT-01 el servidor responde y usa PostgreSQL", { skip: omitir }, async () => {
  const { status, datos } = await llamar("/health");
  assert.equal(status, 200);
  assert.equal(datos.baseDeDatos, "postgres");
});

test("IT-02 inicio de sesión: credenciales válidas entran, inválidas no revelan el dato", { skip: omitir }, async () => {
  assert.ok(await iniciarSesion(ADMIN));
  const malo = await llamar("/usuarios/login", { metodo: "POST", cuerpo: { ...ADMIN, password: "incorrecta1" } });
  assert.equal(malo.status, 401);
  assert.equal(malo.datos.error, "Usuario o contraseña incorrectos.");
});

test("IT-03 sin sesión no se accede a la API", { skip: omitir }, async () => {
  for (const ruta of ["/cotizaciones", "/tarifas", "/usuarios", "/tipo-cambio"]) {
    assert.equal((await llamar(ruta)).status, 401, ruta);
  }
});

test("IT-04 catálogo: 3 embarcadores, 9 orígenes, 2 destinos y reglas de Comex", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const { datos } = await llamar("/cotizaciones/catalogo", { token });
  assert.equal(datos.embarcadores.length, 3);
  assert.equal(datos.puertosOrigen.length, 9);
  assert.equal(datos.puertosDestino.length, 2);
  assert.deepEqual(
    [datos.parametros.iva, datos.parametros.arancel, datos.parametros.toneladas_por_contenedor],
    [0.19, 0, 25]
  );
});

test("IT-05 comparación de embarcadores: 50 t usan 2 contenedores y se marca el más económico", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const q = "puertoOrigen=Shanghai&puertoDestino=Valparaiso&cantidad=50000&tipoContenedor=40";
  const { status, datos } = await llamar(`/cotizaciones/tarifa?${q}`, { token });
  assert.equal(status, 200);
  assert.equal(datos.cantidadContenedores, 2);
  assert.equal(datos.opciones.length, 3);
  assert.ok(datos.opciones.some((o) => o.esMasEconomico));
  assert.equal(datos.opciones[0].tarifaFleteMinUSD, 4700);
});

test("IT-06 crear y calcular cotización: CIF, IVA 19 % y total en CLP coherentes", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const creada = await llamar("/cotizaciones", {
    metodo: "POST",
    token,
    cuerpo: {
      proveedor: "Segucargo", puertoOrigen: "Shanghai", puertoDestino: "Valparaiso",
      cantidad: 50000, tipoContenedor: "40", precioFOB: 35000, moneda: "USD", margenDias: 3,
    },
  });
  assert.equal(creada.status, 201);
  assert.equal(creada.datos.estado, "en_proceso");
  const { status, datos } = await llamar(`/cotizaciones/${creada.datos._id}/calcular`, { metodo: "POST", token });
  assert.equal(status, 200);
  const c = datos.cotizacion;
  assert.equal(c.estado, "calculada");
  assert.equal(c.cifMinUSD, 35000 + 4700);
  assert.equal(c.ivaMinUSD, Math.round(39700 * 0.19 * 100) / 100);
  assert.equal(c.costoTotalMinCLP, Math.round(c.totalMinUSD * c.tipoCambioUsado));
  assert.equal(c.transitoConMargenMaxDias, c.tiempoTransitoMaxDias + 3);
});

test("IT-07 validación: peso cero y ruta sin tarifa se rechazan con mensaje", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const cero = await llamar("/cotizaciones", {
    metodo: "POST", token,
    cuerpo: { proveedor: "Segucargo", puertoOrigen: "Shanghai", puertoDestino: "Valparaiso", cantidad: 0 },
  });
  assert.equal(cero.status, 400);
  const sinRuta = await llamar("/cotizaciones", {
    metodo: "POST", token,
    cuerpo: { proveedor: "Segucargo", puertoOrigen: "Lima", puertoDestino: "Valparaiso", cantidad: 1000 },
  });
  assert.equal(sinRuta.status, 400);
});

test("IT-08 un analista solo ve sus cotizaciones y no entra a administración", { skip: omitir }, async () => {
  const registro = await llamar("/usuarios/registro", {
    metodo: "POST",
    cuerpo: { nombre: "Analista Prueba", username: "analista", email: "analista@prueba.cl",
      password: "Analista2026", confirmarPassword: "Analista2026" },
  });
  assert.equal(registro.status, 201);
  const token = registro.datos.token;
  assert.equal((await llamar("/cotizaciones", { token })).datos.length, 0);
  assert.equal((await llamar("/usuarios", { token })).status, 403);
  assert.equal((await llamar("/usuarios/auditoria", { token })).status, 403);
});

test("IT-09 mantenedor: rechaza mínimo mayor que máximo y registra el cambio válido", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const { datos } = await llamar("/tarifas?puertoOrigen=Busan&puertoDestino=San%20Antonio", { token });
  const tarifa = datos.tarifas[0];
  const base = { transitoMinDias: 30, transitoMaxDias: 38, fuente: "Prueba", activa: true };
  const malo = await llamar(`/tarifas/${tarifa.id}`, { metodo: "PUT", token, cuerpo: { ...base, tarifaMinUSD: 5000, tarifaMaxUSD: 100 } });
  assert.equal(malo.status, 400);
  const bueno = await llamar(`/tarifas/${tarifa.id}`, { metodo: "PUT", token, cuerpo: { ...base, tarifaMinUSD: 1800, tarifaMaxUSD: 2900 } });
  assert.equal(bueno.status, 200);
  assert.equal(bueno.datos.modificadoPor, "CINTAC Admin");
  const auditoria = await llamar("/usuarios/auditoria", { token });
  assert.ok(auditoria.datos.some((a) => a.accion === "tarifa.actualizada"));
});

test("IT-10 un intento de inyección SQL en un filtro no altera la consulta", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const { status, datos } = await llamar(`/cotizaciones?proveedor=${encodeURIComponent("' OR 1=1 --")}`, { token });
  assert.equal(status, 200);
  assert.equal(datos.length, 0);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM usuarios");
  assert.equal(rows[0].n, 2); // admin + analista de IT-08
});

test("IT-11 registro limitado al dominio configurado (REGISTRO_DOMINIOS_PERMITIDOS)", { skip: omitir }, async () => {
  process.env.REGISTRO_DOMINIOS_PERMITIDOS = "cintac.cl";
  try {
    const cuerpo = (email, username) => ({ nombre: "Prueba Dominio", username, email, password: "Dominio2026", confirmarPassword: "Dominio2026" });
    const externo = await llamar("/usuarios/registro", { metodo: "POST", cuerpo: cuerpo("alguien@gmail.com", "externo") });
    assert.equal(externo.status, 403);
    const interno = await llamar("/usuarios/registro", { metodo: "POST", cuerpo: cuerpo("comex@cintac.cl", "comex") });
    assert.equal(interno.status, 201);
  } finally {
    delete process.env.REGISTRO_DOMINIOS_PERMITIDOS;
  }
});

test("IT-12 una tarifa desactivada deja de usarse en la comparación", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const { datos } = await llamar("/tarifas?puertoOrigen=Tianjin&puertoDestino=San%20Antonio", { token });
  const tarifa = datos.tarifas.find((t) => t.embarcador === "Delpa Group" && t.tipoContenedor === "40");
  const cambio = { tarifaMinUSD: tarifa.tarifaMinUSD, tarifaMaxUSD: tarifa.tarifaMaxUSD,
    transitoMinDias: tarifa.transitoMinDias, transitoMaxDias: tarifa.transitoMaxDias, fuente: tarifa.fuente, activa: false };
  assert.equal((await llamar(`/tarifas/${tarifa.id}`, { metodo: "PUT", token, cuerpo: cambio })).status, 200);
  const comparacion = await llamar("/cotizaciones/tarifa?puertoOrigen=Tianjin&puertoDestino=San%20Antonio&cantidad=20000&tipoContenedor=40", { token });
  assert.equal(comparacion.datos.opciones.length, 2);
  assert.ok(!comparacion.datos.opciones.some((o) => o.embarcador === "Delpa Group"));
});

test("IT-13 parámetros fuera de rango se rechazan (IVA 19 en vez de 0,19)", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const malo = await llamar("/tarifas/parametros/iva", { metodo: "PUT", token, cuerpo: { valor: 19 } });
  assert.equal(malo.status, 400);
  const { datos } = await llamar("/cotizaciones/catalogo", { token });
  assert.equal(datos.parametros.iva, 0.19);
});

test("IT-14 un token alterado o revocado por cierre de sesión no sirve", { skip: omitir }, async () => {
  const token = await iniciarSesion(ADMIN);
  const alterado = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
  assert.equal((await llamar("/cotizaciones", { token: alterado })).status, 401);
  assert.equal((await llamar("/usuarios/logout", { metodo: "POST", token })).status, 200);
  assert.equal((await llamar("/cotizaciones", { token })).status, 401);
});

test("IT-15 fuerza bruta: el inicio de sesión se bloquea tras 20 intentos en 15 minutos", { skip: omitir }, async () => {
  let bloqueado = null;
  for (let i = 1; i <= 25 && !bloqueado; i += 1) {
    const r = await llamar("/usuarios/login", { metodo: "POST", cuerpo: { identifier: "nadie", password: "x" } });
    if (r.status === 429) bloqueado = i;
  }
  assert.ok(bloqueado, "se esperaba un 429");
  assert.ok(bloqueado <= 21);
});
