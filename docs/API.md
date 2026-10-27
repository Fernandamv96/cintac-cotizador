# API del cotizador CINTAC

Base: `/api`. Todas las respuestas son JSON. Salvo las marcadas como públicas, todas las rutas exigen
el encabezado `Authorization: Bearer <token>` que entrega el inicio de sesión. El token dura 45 minutos.

## Usuarios y sesión

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| POST | `/usuarios/login` | Pública (20 intentos / 15 min) | Inicia sesión con usuario o correo y contraseña. Devuelve `token` y `usuario`. |
| POST | `/usuarios/registro` | Pública (20 intentos / 15 min) | Crea una cuenta con rol USER. Si `REGISTRO_DOMINIOS_PERMITIDOS` está definida, solo acepta esos dominios. |
| POST | `/usuarios/logout` | Autenticado | Revoca todos los tokens del usuario (aumenta `token_version`). |
| POST | `/usuarios/solicitar-codigo-reset` | Pública | Envía un código de 6 dígitos al correo (requiere SMTP). |
| POST | `/usuarios/reset-password` | Pública | Cambia la contraseña con el código recibido. |
| POST | `/usuarios/solicitar-confirmacion` | Autenticado | Envía código para confirmar cambios de perfil. |
| POST | `/usuarios/confirmar-configuracion` | Autenticado | Cambia usuario, correo o contraseña con el código. |
| PATCH | `/usuarios/me/password` | Autenticado | Cambia la contraseña propia. |
| GET | `/usuarios` | ADMIN, SUPERADMIN | Lista las cuentas (sin datos sensibles). |
| POST | `/usuarios` | ADMIN, SUPERADMIN | Crea una cuenta USER. |
| PATCH | `/usuarios/:id` | ADMIN, SUPERADMIN | Activa o desactiva una cuenta. |
| PATCH | `/usuarios/:id/password` | La propia cuenta, o ADMIN y SUPERADMIN | Cambia la contraseña propia (con código) o restablece la de otra cuenta (con la contraseña del administrador). |
| POST | `/usuarios/aprobacion-rol/solicitar` | ADMIN, SUPERADMIN | Pide crear una cuenta ADMIN o JEFE_ABASTECIMIENTO; envía código al correo de aprobación. |
| POST | `/usuarios/aprobacion-rol/confirmar` | ADMIN, SUPERADMIN | Confirma la cuenta con el código (10 minutos, 5 intentos). |
| GET | `/usuarios/auditoria?limit=100` | ADMIN, SUPERADMIN | Últimos eventos de auditoría. |

## Cotizaciones

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| GET | `/cotizaciones/catalogo` | Autenticado | Embarcadores activos, puertos de origen y destino y parámetros vigentes. |
| GET | `/cotizaciones/tarifa?puertoOrigen&puertoDestino&cantidad&tipoContenedor&modoContenedor&cantidadContenedores` | Autenticado | Calcula contenedores (tope 25 t) y compara el flete de todos los embarcadores activos de la ruta. |
| POST | `/cotizaciones` | Autenticado | Guarda una cotización con el embarcador elegido (estado `en_proceso`). |
| POST | `/cotizaciones/:id/calcular` | Dueño o ADMIN | Calcula CIF, arancel, IVA, total en US$ y CLP y tránsito con contingencia (estado `calculada`). |
| POST | `/cotizaciones/:id/finalizar` | Dueño o ADMIN | Marca la cotización como `finalizada`. |
| GET | `/cotizaciones?proveedor&puertoOrigen&puertoDestino` | Autenticado | Historial (propio; JEFE y ADMIN ven todo). Máximo 200, del más reciente al más antiguo. |
| GET | `/cotizaciones/:id` | Dueño, JEFE o ADMIN | Una cotización. |
| GET | `/cotizaciones/comparar?ids=a,b` | Autenticado | Varias cotizaciones para compararlas (2 a 10). |
| DELETE | `/cotizaciones/:id` | ADMIN, SUPERADMIN | Elimina; exige `passwordActual` en el cuerpo. |

## Tarifas y parámetros (mantenedor de Comex)

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| GET | `/tarifas?puertoOrigen&puertoDestino` | Autenticado | Tarifas con ruta, embarcador, contenedor, quién y cuándo las modificó; también catálogo y parámetros. |
| PUT | `/tarifas/:id` | Autenticado | Actualiza mínimo, máximo, tránsito, fuente y si está activa. Valida mínimo ≤ máximo. |
| PUT | `/tarifas/parametros/:nombre` | Autenticado | Cambia `iva` (0–1), `arancel` (0–1), `toneladas_por_contenedor` (1–40) o `margen_contingencia_dias` (0–365). |
| POST | `/tarifas/embarcadores` | Autenticado | Agrega un embarcador y le copia tarifas referenciales inactivas. |
| PATCH | `/tarifas/embarcadores/:id` | Autenticado | Cambia nombre o activa/desactiva un embarcador. |

## Otros

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| GET | `/health` | Pública | `{ "ok": true, "baseDeDatos": "postgres" }` |
| GET | `/tipo-cambio` | Autenticado | Dólar observado (mindicador.cl; si falla, último valor guardado) y parámetros. |

## Errores

| Código | Cuándo |
| --- | --- |
| 400 | Datos inválidos (el cuerpo trae `error` con el motivo). |
| 401 | Sin sesión, token vencido, alterado o revocado. |
| 403 | El rol no tiene permiso, o el dominio del correo no está autorizado para registrarse. |
| 404 | El recurso no existe. |
| 409 | Usuario, correo o embarcador duplicado. |
| 429 | Demasiados intentos de inicio de sesión o registro. |
| 500 | Error inesperado (se registra en los logs de Vercel). |
