export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:4000/api");

function obtenerTokenActual() {
  const persistirSesion = localStorage.getItem("cintac-remember") === "true";
  return (persistirSesion ? localStorage : sessionStorage).getItem("token");
}

async function solicitar(ruta, opciones = {}) {
  const token = obtenerTokenActual();
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...opciones.headers,
    },
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== "/usuarios/login") {
      window.dispatchEvent(new Event("cintac:session-expired"));
    }
    throw new Error(datos.error || "Ocurrió un error al conectar con el servidor.");
  }
  return datos;
}

export const api = {
  salud: () => solicitar("/health"),
  login: (identifier, password) =>
    solicitar("/usuarios/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  registrar: (datos) =>
    solicitar("/usuarios/registro", { method: "POST", body: JSON.stringify(datos) }),
  cambiarPassword: (id, payload) =>
    solicitar(`/usuarios/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  cambiarMiPassword: (payload) =>
    solicitar("/usuarios/me/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  listarUsuarios: () => solicitar("/usuarios"),
  reestablecerPassword: (payload) =>
    solicitar("/usuarios/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  solicitarCodigoReset: (payload) =>
    solicitar("/usuarios/solicitar-codigo-reset", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  solicitarConfirmacionPerfil: (payload) =>
    solicitar("/usuarios/solicitar-confirmacion", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  confirmarPerfil: (payload) =>
    solicitar("/usuarios/confirmar-configuracion", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  solicitarAprobacionRol: (payload) =>
    solicitar("/usuarios/aprobacion-rol/solicitar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  confirmarAprobacionRol: (payload) =>
    solicitar("/usuarios/aprobacion-rol/confirmar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  crearCotizacion: (datos) =>
    solicitar("/cotizaciones", { method: "POST", body: JSON.stringify(datos) }),
  calcularCotizacion: (id) => solicitar(`/cotizaciones/${id}/calcular`, { method: "POST" }),
  finalizarCotizacion: (id) => solicitar(`/cotizaciones/${id}/finalizar`, { method: "POST" }),
  eliminarCotizacion: (id, payload) =>
    solicitar(`/cotizaciones/${id}`, { method: "DELETE", body: JSON.stringify(payload) }),
  obtenerCotizacion: (id) => solicitar(`/cotizaciones/${id}`),
  listarCotizaciones: (filtros = {}) => {
    const query = new URLSearchParams(filtros).toString();
    return solicitar(`/cotizaciones${query ? `?${query}` : ""}`);
  },
  obtenerTarifaCotizacion: (filtros) => {
    const query = new URLSearchParams(filtros).toString();
    return solicitar(`/cotizaciones/tarifa?${query}`);
  },
  compararCotizaciones: (ids) => solicitar(`/cotizaciones/comparar?ids=${ids.join(",")}`),

  obtenerCatalogoCotizacion: () => solicitar("/cotizaciones/catalogo"),

  listarTarifas: (filtros = {}) => {
    const query = new URLSearchParams(filtros).toString();
    return solicitar(`/tarifas${query ? `?${query}` : ""}`);
  },
  actualizarTarifa: (id, datos) => solicitar(`/tarifas/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
  actualizarParametro: (nombre, valor) =>
    solicitar(`/tarifas/parametros/${encodeURIComponent(nombre)}`, { method: "PUT", body: JSON.stringify({ valor }) }),
  crearEmbarcador: (nombre) => solicitar("/tarifas/embarcadores", { method: "POST", body: JSON.stringify({ nombre }) }),
  actualizarEmbarcador: (id, datos) =>
    solicitar(`/tarifas/embarcadores/${id}`, { method: "PATCH", body: JSON.stringify(datos) }),

  obtenerIndicadores: () => solicitar("/tipo-cambio"),
  listarAuditoria: () => solicitar("/usuarios/auditoria?limit=100"),
};
