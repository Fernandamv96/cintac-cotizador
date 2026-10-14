// Capa de acceso a datos (PostgreSQL / Neon).
// Mantiene los mismos nombres de funciones que usaba el almacén en memoria del
// prototipo, para que los controladores cambien lo menos posible.
import { query, transaccion } from "./db.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUuid = (valor) => UUID_RE.test(String(valor || ""));
const texto = (valor) => String(valor ?? "").trim();
const minusculas = (valor) => texto(valor).toLowerCase();
const iso = (fecha) => (fecha ? new Date(fecha).toISOString() : null);

// ---------------------------------------------------------------- usuarios

function aUsuario(fila) {
  if (!fila) return null;
  return {
    _id: fila.id,
    nombre: fila.nombre,
    username: fila.username,
    email: fila.email,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    activo: fila.activo,
    tokenVersion: fila.token_version,
    resetCodeHash: fila.reset_code_hash,
    resetCodeExpiresAt: fila.reset_code_expira,
    confirmationCodeHash: fila.confirm_code_hash,
    confirmationCodeExpiresAt: fila.confirm_code_expira,
    createdAt: iso(fila.created_at),
    updatedAt: iso(fila.updated_at),
  };
}

function sinSecretos(usuario) {
  if (!usuario) return null;
  const {
    passwordHash,
    resetCodeHash,
    resetCodeExpiresAt,
    confirmationCodeHash,
    confirmationCodeExpiresAt,
    ...publico
  } = usuario;
  return publico;
}

export async function findUsuarioByLogin(identifier) {
  const valor = minusculas(identifier);
  if (!valor) return null;
  const { rows } = await query("SELECT * FROM usuarios WHERE username = $1 OR email = $1 LIMIT 1", [valor]);
  return aUsuario(rows[0]);
}

export async function findUsuarioById(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [id]);
  return aUsuario(rows[0]);
}

export async function existeUsuario(username, email) {
  const { rows } = await query(
    "SELECT 1 FROM usuarios WHERE username = $1 OR email = $2 LIMIT 1",
    [minusculas(username), minusculas(email)]
  );
  return rows.length > 0;
}

export async function crearUsuario({ nombre, username, email, passwordHash, rol = "USER", activo = true }) {
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, username, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [texto(nombre), minusculas(username), minusculas(email), passwordHash, rol, activo]
  );
  return aUsuario(rows[0]);
}

export async function listarUsuariosMemory() {
  const { rows } = await query("SELECT * FROM usuarios ORDER BY created_at");
  return rows.map((fila) => sinSecretos(aUsuario(fila)));
}

export async function actualizarRolUsuario(id, { rol, activo }) {
  if (!esUuid(id)) return null;
  const { rows } = await query(
    `UPDATE usuarios SET rol = COALESCE($2, rol), activo = COALESCE($3, activo), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, rol || null, typeof activo === "boolean" ? activo : null]
  );
  return sinSecretos(aUsuario(rows[0]));
}

export async function actualizarPasswordUsuario(id, nuevaPasswordHash) {
  if (!esUuid(id)) return null;
  const { rows } = await query(
    `UPDATE usuarios SET password_hash = $2, token_version = token_version + 1,
       reset_code_hash = NULL, reset_code_expira = NULL,
       confirm_code_hash = NULL, confirm_code_expira = NULL, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, nuevaPasswordHash]
  );
  return aUsuario(rows[0]);
}

export async function revocarSesionesUsuario(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query(
    "UPDATE usuarios SET token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING *",
    [id]
  );
  return aUsuario(rows[0]);
}

export async function actualizarPerfilUsuario(id, { username, email, passwordHash }) {
  if (!esUuid(id)) return null;
  const { rows } = await query(
    `UPDATE usuarios SET
       username = COALESCE(NULLIF($2, ''), username),
       email = COALESCE(NULLIF($3, ''), email),
       token_version = CASE WHEN $4::text IS NOT NULL AND $4 <> password_hash THEN token_version + 1 ELSE token_version END,
       password_hash = COALESCE($4, password_hash),
       confirm_code_hash = NULL, confirm_code_expira = NULL,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, minusculas(username), minusculas(email), passwordHash || null]
  );
  return aUsuario(rows[0]);
}

// Guarda los códigos de verificación que el controlador asigna al objeto usuario.
export async function guardarCodigosUsuario(usuario) {
  if (!usuario || !esUuid(usuario._id)) return null;
  await query(
    `UPDATE usuarios SET reset_code_hash = $2, reset_code_expira = $3,
       confirm_code_hash = $4, confirm_code_expira = $5, updated_at = now()
     WHERE id = $1`,
    [
      usuario._id,
      usuario.resetCodeHash || null,
      usuario.resetCodeExpiresAt || null,
      usuario.confirmationCodeHash || null,
      usuario.confirmationCodeExpiresAt || null,
    ]
  );
  return usuario;
}

// ------------------------------------------------- aprobaciones de rol elevado

function aAprobacion(fila) {
  if (!fila) return null;
  return {
    _id: fila.id,
    solicitanteId: fila.solicitante_id,
    nombre: fila.nombre,
    username: fila.username,
    email: fila.email,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    correoPrincipal: fila.correo_principal,
    codigoHash: fila.codigo_hash,
    intentosRestantes: fila.intentos_restantes,
    expiraEn: new Date(fila.expira_en).getTime(),
  };
}

export async function crearAprobacionRolElevado(solicitud) {
  return transaccion(async (cliente) => {
    await cliente.query(
      "DELETE FROM aprobaciones_rol WHERE expira_en <= now() OR solicitante_id = $1",
      [solicitud.solicitanteId]
    );
    const { rows } = await cliente.query(
      `INSERT INTO aprobaciones_rol (solicitante_id, nombre, username, email, password_hash, rol,
                                     correo_principal, codigo_hash, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0)) RETURNING *`,
      [
        solicitud.solicitanteId,
        solicitud.nombre,
        solicitud.username,
        solicitud.email,
        solicitud.passwordHash,
        solicitud.rol,
        solicitud.correoPrincipal,
        solicitud.codigoHash || "",
        solicitud.expiraEn,
      ]
    );
    return aAprobacion(rows[0]);
  });
}

export async function guardarCodigoAprobacion(id, codigoHash) {
  if (!esUuid(id)) return;
  await query("UPDATE aprobaciones_rol SET codigo_hash = $2 WHERE id = $1", [id, codigoHash]);
}

export async function buscarAprobacionRolElevado(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query("SELECT * FROM aprobaciones_rol WHERE id = $1 AND expira_en > now()", [id]);
  if (!rows[0]) await eliminarAprobacionRolElevado(id);
  return aAprobacion(rows[0]);
}

export async function registrarIntentoAprobacionRolElevado(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query(
    `UPDATE aprobaciones_rol SET intentos_restantes = intentos_restantes - 1
     WHERE id = $1 AND expira_en > now() RETURNING intentos_restantes`,
    [id]
  );
  if (!rows[0]) return null;
  if (rows[0].intentos_restantes <= 0) {
    await eliminarAprobacionRolElevado(id);
    return 0;
  }
  return rows[0].intentos_restantes;
}

export async function eliminarAprobacionRolElevado(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query("DELETE FROM aprobaciones_rol WHERE id = $1 RETURNING *", [id]);
  return aAprobacion(rows[0]);
}

// ------------------------------------------- catálogo: embarcadores, puertos, tarifas

function aTarifa(fila) {
  return {
    id: fila.id,
    rutaId: fila.ruta_id,
    embarcadorId: fila.embarcador_id,
    embarcador: fila.embarcador,
    embarcadorActivo: fila.embarcador_activo,
    puertoOrigen: fila.puerto_origen,
    paisOrigen: fila.pais_origen,
    puertoDestino: fila.puerto_destino,
    tipoRuta: fila.tipo_ruta,
    tipoContenedor: fila.tipo_contenedor,
    tarifaMinUSD: fila.tarifa_min_usd,
    tarifaMaxUSD: fila.tarifa_max_usd,
    transitoMinDias: fila.transito_min_dias,
    transitoMaxDias: fila.transito_max_dias,
    fuente: fila.fuente,
    activa: fila.activa,
    modificadoPor: fila.modificado_por_nombre || null,
    modificadoEn: iso(fila.modificado_en),
  };
}

const SELECT_TARIFAS = `
  SELECT t.*, e.nombre AS embarcador, e.activo AS embarcador_activo,
         o.nombre AS puerto_origen, o.pais AS pais_origen, d.nombre AS puerto_destino,
         r.tipo_ruta, u.nombre AS modificado_por_nombre
  FROM tarifas t
  JOIN rutas r ON r.id = t.ruta_id
  JOIN puertos o ON o.id = r.puerto_origen_id
  JOIN puertos d ON d.id = r.puerto_destino_id
  JOIN embarcadores e ON e.id = t.embarcador_id
  LEFT JOIN usuarios u ON u.id = t.modificado_por`;

export async function obtenerCatalogo() {
  const [embarcadores, origenes, destinos] = await Promise.all([
    query("SELECT id, nombre, activo FROM embarcadores ORDER BY nombre"),
    query("SELECT nombre, pais FROM puertos WHERE tipo = 'origen' ORDER BY nombre"),
    query("SELECT nombre, pais FROM puertos WHERE tipo = 'destino' ORDER BY nombre"),
  ]);
  return {
    embarcadores: embarcadores.rows,
    puertosOrigen: origenes.rows.map((p) => p.nombre),
    puertosDestino: destinos.rows.map((p) => p.nombre),
  };
}

export async function listarTarifas({ puertoOrigen, puertoDestino, soloActivas = false } = {}) {
  const condiciones = [];
  const valores = [];
  if (puertoOrigen) {
    valores.push(puertoOrigen);
    condiciones.push(`o.nombre = $${valores.length}`);
  }
  if (puertoDestino) {
    valores.push(puertoDestino);
    condiciones.push(`d.nombre = $${valores.length}`);
  }
  if (soloActivas) condiciones.push("t.activa AND e.activo");
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await query(
    `${SELECT_TARIFAS} ${where} ORDER BY o.nombre, d.nombre, e.nombre, t.tipo_contenedor`,
    valores
  );
  return rows.map(aTarifa);
}

export async function buscarTarifa({ puertoOrigen, puertoDestino, embarcador, tipoContenedor }) {
  const { rows } = await query(
    `${SELECT_TARIFAS}
     WHERE o.nombre = $1 AND d.nombre = $2 AND e.nombre = $3 AND t.tipo_contenedor = $4
       AND t.activa AND e.activo`,
    [puertoOrigen, puertoDestino, embarcador, String(tipoContenedor)]
  );
  return rows[0] ? aTarifa(rows[0]) : null;
}

export async function actualizarTarifa(id, cambios, usuarioId) {
  const { rows } = await query(
    `UPDATE tarifas SET
       tarifa_min_usd = $2, tarifa_max_usd = $3, transito_min_dias = $4, transito_max_dias = $5,
       fuente = $6, activa = $7, modificado_por = $8, modificado_en = now()
     WHERE id = $1 RETURNING id`,
    [
      id,
      cambios.tarifaMinUSD,
      cambios.tarifaMaxUSD,
      cambios.transitoMinDias,
      cambios.transitoMaxDias,
      cambios.fuente,
      cambios.activa,
      esUuid(usuarioId) ? usuarioId : null,
    ]
  );
  if (!rows[0]) return null;
  const tarifa = await query(`${SELECT_TARIFAS} WHERE t.id = $1`, [id]);
  return aTarifa(tarifa.rows[0]);
}

// Crea (o reactiva) un embarcador y le copia las tarifas de referencia de otro,
// para que Comex solo tenga que ajustar los valores.
export async function crearEmbarcador(nombre, usuarioId) {
  return transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO embarcadores (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET activo = TRUE RETURNING id, nombre, activo`,
      [texto(nombre)]
    );
    const nuevo = rows[0];
    await cliente.query(
      `INSERT INTO tarifas (ruta_id, embarcador_id, tipo_contenedor, tarifa_min_usd, tarifa_max_usd,
                            transito_min_dias, transito_max_dias, fuente, activa, modificado_por)
       SELECT DISTINCT ON (ruta_id, tipo_contenedor) ruta_id, $1, tipo_contenedor, tarifa_min_usd,
              tarifa_max_usd, transito_min_dias, transito_max_dias, 'Copia referencial: actualizar', FALSE, $2
       FROM tarifas WHERE embarcador_id <> $1
       ORDER BY ruta_id, tipo_contenedor, id
       ON CONFLICT (ruta_id, embarcador_id, tipo_contenedor) DO NOTHING`,
      [nuevo.id, esUuid(usuarioId) ? usuarioId : null]
    );
    return nuevo;
  });
}

export async function actualizarEmbarcador(id, { nombre, activo }) {
  const { rows } = await query(
    `UPDATE embarcadores SET nombre = COALESCE(NULLIF($2, ''), nombre), activo = COALESCE($3, activo)
     WHERE id = $1 RETURNING id, nombre, activo`,
    [id, texto(nombre), typeof activo === "boolean" ? activo : null]
  );
  return rows[0] || null;
}

// --------------------------------------------------------------- parámetros

export async function obtenerParametros() {
  const { rows } = await query(
    `SELECT p.nombre, p.valor, p.descripcion, p.modificado_en, u.nombre AS modificado_por
     FROM parametros p LEFT JOIN usuarios u ON u.id = p.modificado_por ORDER BY p.nombre`
  );
  return rows.map((fila) => ({
    nombre: fila.nombre,
    valor: fila.valor,
    descripcion: fila.descripcion,
    modificadoPor: fila.modificado_por,
    modificadoEn: iso(fila.modificado_en),
  }));
}

export async function obtenerValoresParametros() {
  const lista = await obtenerParametros();
  return Object.fromEntries(lista.map((p) => [p.nombre, p.valor]));
}

export async function actualizarParametro(nombre, valor, usuarioId) {
  const { rows } = await query(
    `UPDATE parametros SET valor = $2, modificado_por = $3, modificado_en = now()
     WHERE nombre = $1 RETURNING nombre`,
    [nombre, valor, esUuid(usuarioId) ? usuarioId : null]
  );
  return rows[0] ? (await obtenerParametros()).find((p) => p.nombre === nombre) : null;
}

// ------------------------------------------------------------- tipo de cambio

export async function guardarTipoCambio(fecha, valor) {
  await query(
    `INSERT INTO tipo_cambio (fecha, valor) VALUES ($1, $2)
     ON CONFLICT (fecha) DO UPDATE SET valor = EXCLUDED.valor, obtenido_en = now()`,
    [String(fecha).slice(0, 10), valor]
  );
}

export async function ultimoTipoCambioGuardado() {
  const { rows } = await query("SELECT fecha, valor, obtenido_en FROM tipo_cambio ORDER BY fecha DESC LIMIT 1");
  if (!rows[0]) return null;
  return { valor: rows[0].valor, fecha: iso(rows[0].fecha), obtenidoEn: new Date(rows[0].obtenido_en).getTime() };
}

// --------------------------------------------------------------- cotizaciones

const SELECT_COTIZACIONES = `
  SELECT c.*, e.nombre AS embarcador, o.nombre AS puerto_origen, d.nombre AS puerto_destino,
         r.tipo_ruta, u.nombre AS creado_por_nombre, u.email AS creado_por_email
  FROM cotizaciones c
  JOIN rutas r ON r.id = c.ruta_id
  JOIN puertos o ON o.id = r.puerto_origen_id
  JOIN puertos d ON d.id = r.puerto_destino_id
  JOIN embarcadores e ON e.id = c.embarcador_id
  JOIN usuarios u ON u.id = c.creado_por`;

function aCotizacion(fila) {
  if (!fila) return null;
  return {
    ...(fila.tarifa_usada || {}),
    ...(fila.resultado || {}),
    _id: fila.id,
    proveedor: fila.embarcador,
    embarcador: fila.embarcador,
    puertoOrigen: fila.puerto_origen,
    puertoDestino: fila.puerto_destino,
    tipoRuta: fila.tipo_ruta,
    tipoProducto: "carga_general",
    cantidad: fila.peso_kg,
    pesoKg: fila.peso_kg,
    precioFOB: fila.valor_fob,
    valorFOB: fila.valor_fob,
    moneda: fila.moneda,
    otrosGastos: fila.costos_locales,
    costosLocales: fila.costos_locales,
    margenDias: fila.margen_dias,
    condicionPago: fila.condicion_pago,
    modoContenedor: fila.modo_contenedor,
    tipoContenedor: fila.tipo_contenedor,
    cantidadContenedores: fila.cantidad_contenedores,
    estado: fila.estado,
    creadoPor: fila.creado_por,
    creadoPorNombre: fila.creado_por_nombre,
    creadoPorEmail: fila.creado_por_email,
    createdAt: iso(fila.created_at),
    updatedAt: iso(fila.updated_at),
  };
}

export async function crearCotizacion(datos) {
  const { rows } = await query(
    `INSERT INTO cotizaciones (creado_por, ruta_id, embarcador_id, tipo_contenedor, cantidad_contenedores,
                               modo_contenedor, peso_kg, valor_fob, moneda, costos_locales, margen_dias,
                               condicion_pago, tarifa_usada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      datos.creadoPor,
      datos.rutaId,
      datos.embarcadorId,
      datos.tipoContenedor,
      datos.cantidadContenedores,
      datos.modoContenedor,
      datos.pesoKg,
      datos.valorFOB,
      datos.moneda,
      datos.costosLocales,
      datos.margenDias,
      datos.condicionPago,
      JSON.stringify(datos.tarifaUsada),
    ]
  );
  return buscarCotizacionPorId(rows[0].id);
}

export async function buscarCotizacionPorId(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query(`${SELECT_COTIZACIONES} WHERE c.id = $1`, [id]);
  return aCotizacion(rows[0]);
}

export async function guardarResultadoCotizacion(id, resultado) {
  await query(
    "UPDATE cotizaciones SET resultado = $2, estado = 'calculada', updated_at = now() WHERE id = $1",
    [id, JSON.stringify(resultado)]
  );
  return buscarCotizacionPorId(id);
}

export async function actualizarEstadoCotizacion(id, estado) {
  await query("UPDATE cotizaciones SET estado = $2, updated_at = now() WHERE id = $1", [id, estado]);
  return buscarCotizacionPorId(id);
}

export async function eliminarCotizacion(id) {
  if (!esUuid(id)) return null;
  const { rows } = await query("DELETE FROM cotizaciones WHERE id = $1 RETURNING id", [id]);
  return rows[0] ? { _id: rows[0].id } : null;
}

export async function listarCotizaciones(filtro = {}, { creadoPor = null, limite = 200 } = {}) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replace("?", `$${valores.length}`));
  };
  if (creadoPor) agregar("c.creado_por = ?", creadoPor);
  if (filtro.proveedor) agregar("e.nombre ILIKE ?", `%${filtro.proveedor}%`);
  if (filtro.puertoOrigen) agregar("o.nombre = ?", filtro.puertoOrigen);
  if (filtro.puertoDestino) agregar("d.nombre = ?", filtro.puertoDestino);
  valores.push(limite);
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await query(
    `${SELECT_COTIZACIONES} ${where} ORDER BY c.created_at DESC LIMIT $${valores.length}`,
    valores
  );
  return rows.map(aCotizacion);
}

export async function listarCotizacionesPorIds(ids = []) {
  const validos = ids.filter(esUuid);
  if (!validos.length) return [];
  const { rows } = await query(`${SELECT_COTIZACIONES} WHERE c.id = ANY($1::uuid[]) ORDER BY c.created_at`, [validos]);
  return rows.map(aCotizacion);
}

// ---------------------------------------------------------------- auditoría

export async function crearAuditoriaMemory(registro) {
  const { rows } = await query(
    `INSERT INTO auditoria (actor_id, actor_nombre, rol, accion, entidad, entidad_id, resultado, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      esUuid(registro.actorId) ? registro.actorId : null,
      texto(registro.actorNombre).slice(0, 100) || "Usuario",
      texto(registro.rol).slice(0, 30) || "desconocido",
      texto(registro.accion).slice(0, 80),
      texto(registro.entidad).slice(0, 40),
      texto(registro.entidadId).slice(0, 64),
      texto(registro.resultado).slice(0, 10) || "exitoso",
      texto(registro.ip).slice(0, 64),
    ]
  );
  return rows[0];
}

export async function listarAuditoriaMemory(limit = 100) {
  const { rows } = await query("SELECT * FROM auditoria ORDER BY created_at DESC LIMIT $1", [limit]);
  return rows.map((fila) => ({
    _id: fila.id,
    actorId: fila.actor_id,
    actorNombre: fila.actor_nombre,
    rol: fila.rol,
    accion: fila.accion,
    entidad: fila.entidad,
    entidadId: fila.entidad_id,
    resultado: fila.resultado,
    ip: fila.ip,
    createdAt: iso(fila.created_at),
    fecha: iso(fila.created_at),
  }));
}
