-- =====================================================================
-- Cotizador CINTAC - Esquema PostgreSQL (Neon)
-- Modelo en tercera forma normal (3FN):
--   * Cada tabla describe una sola entidad y todos sus atributos dependen
--     solo de su clave primaria.
--   * Puertos, rutas, embarcadores y tarifas están separados para no
--     repetir nombres ni valores (antes vivían escritos en el código).
--   * La cotización guarda una "foto" de la tarifa y del resultado al
--     momento de calcular (resultado JSONB). No es redundancia: las tarifas
--     cambian y la cotización debe seguir mostrando lo que se cotizó.
-- Todas las sentencias son idempotentes: se pueden ejecutar varias veces.
-- =====================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                VARCHAR(100) NOT NULL,
  username              VARCHAR(60)  NOT NULL UNIQUE,
  email                 VARCHAR(160) NOT NULL UNIQUE,
  password_hash         TEXT         NOT NULL,
  rol                   VARCHAR(30)  NOT NULL DEFAULT 'USER'
                        CHECK (rol IN ('USER', 'JEFE_ABASTECIMIENTO', 'ADMIN', 'SUPERADMIN')),
  activo                BOOLEAN      NOT NULL DEFAULT TRUE,
  token_version         INTEGER      NOT NULL DEFAULT 0,
  reset_code_hash       TEXT,
  reset_code_expira     TIMESTAMPTZ,
  confirm_code_hash     TEXT,
  confirm_code_expira   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS embarcadores (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL UNIQUE,
  activo    BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS puertos (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  pais      VARCHAR(60)  NOT NULL,
  tipo      VARCHAR(10)  NOT NULL CHECK (tipo IN ('origen', 'destino')),
  UNIQUE (nombre, tipo)
);

CREATE TABLE IF NOT EXISTS rutas (
  id                 SERIAL PRIMARY KEY,
  puerto_origen_id   INTEGER NOT NULL REFERENCES puertos(id),
  puerto_destino_id  INTEGER NOT NULL REFERENCES puertos(id),
  tipo_ruta          VARCHAR(40) NOT NULL DEFAULT 'Transbordo',
  UNIQUE (puerto_origen_id, puerto_destino_id)
);

CREATE TABLE IF NOT EXISTS tarifas (
  id                 SERIAL PRIMARY KEY,
  ruta_id            INTEGER NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
  embarcador_id      INTEGER NOT NULL REFERENCES embarcadores(id) ON DELETE CASCADE,
  tipo_contenedor    VARCHAR(2) NOT NULL CHECK (tipo_contenedor IN ('20', '40')),
  tarifa_min_usd     NUMERIC(12,2) NOT NULL CHECK (tarifa_min_usd >= 0),
  tarifa_max_usd     NUMERIC(12,2) NOT NULL,
  transito_min_dias  INTEGER NOT NULL CHECK (transito_min_dias > 0),
  transito_max_dias  INTEGER NOT NULL,
  fuente             VARCHAR(120) NOT NULL DEFAULT 'Referencial',
  activa             BOOLEAN NOT NULL DEFAULT TRUE,
  modificado_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  modificado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ruta_id, embarcador_id, tipo_contenedor),
  CHECK (tarifa_max_usd >= tarifa_min_usd),
  CHECK (transito_max_dias >= transito_min_dias)
);
CREATE INDEX IF NOT EXISTS idx_tarifas_ruta ON tarifas (ruta_id) WHERE activa;

CREATE TABLE IF NOT EXISTS parametros (
  nombre          VARCHAR(60) PRIMARY KEY,
  valor           NUMERIC(14,4) NOT NULL,
  descripcion     TEXT NOT NULL,
  modificado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  modificado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_por            UUID NOT NULL REFERENCES usuarios(id),
  ruta_id               INTEGER NOT NULL REFERENCES rutas(id),
  embarcador_id         INTEGER NOT NULL REFERENCES embarcadores(id),
  tipo_contenedor       VARCHAR(2) NOT NULL CHECK (tipo_contenedor IN ('20', '40')),
  cantidad_contenedores INTEGER NOT NULL CHECK (cantidad_contenedores BETWEEN 1 AND 100),
  modo_contenedor       VARCHAR(10) NOT NULL DEFAULT 'peso' CHECK (modo_contenedor IN ('peso', 'manual')),
  peso_kg               NUMERIC(14,2) NOT NULL CHECK (peso_kg > 0),
  valor_fob             NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_fob >= 0),
  moneda                VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'CLP')),
  costos_locales        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (costos_locales >= 0),
  margen_dias           INTEGER NOT NULL DEFAULT 0 CHECK (margen_dias >= 0),
  condicion_pago        VARCHAR(120) NOT NULL DEFAULT '',
  estado                VARCHAR(12) NOT NULL DEFAULT 'en_proceso'
                        CHECK (estado IN ('en_proceso', 'calculada', 'finalizada')),
  tarifa_usada          JSONB NOT NULL,          -- foto de la tarifa al cotizar
  resultado             JSONB,                   -- foto del cálculo (null hasta calcular)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_usuario_fecha ON cotizaciones (creado_por, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_ruta ON cotizaciones (ruta_id);

CREATE TABLE IF NOT EXISTS auditoria (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  actor_nombre  VARCHAR(100) NOT NULL,
  rol           VARCHAR(30)  NOT NULL,
  accion        VARCHAR(80)  NOT NULL,
  entidad       VARCHAR(40)  NOT NULL,
  entidad_id    VARCHAR(64)  NOT NULL DEFAULT '',
  resultado     VARCHAR(10)  NOT NULL DEFAULT 'exitoso',
  ip            VARCHAR(64)  NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (created_at DESC);

CREATE TABLE IF NOT EXISTS aprobaciones_rol (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre              VARCHAR(100) NOT NULL,
  username            VARCHAR(60)  NOT NULL,
  email               VARCHAR(160) NOT NULL,
  password_hash       TEXT NOT NULL,
  rol                 VARCHAR(30) NOT NULL,
  correo_principal    VARCHAR(160) NOT NULL,
  codigo_hash         TEXT NOT NULL DEFAULT '',
  intentos_restantes  INTEGER NOT NULL DEFAULT 5,
  expira_en           TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tipo_cambio (
  fecha        DATE PRIMARY KEY,
  valor        NUMERIC(10,2) NOT NULL,
  obtenido_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
