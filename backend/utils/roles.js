const ROLES_VALIDOS = new Set(["USER", "JEFE_ABASTECIMIENTO", "ADMIN", "SUPERADMIN"]);

export function normalizarRol(rol) {
  const valor = String(rol || "").trim().toUpperCase();
  if (valor === "ADMINISTRADOR") return "ADMIN";
  if (valor === "SUPERADMINISTRADOR") return "SUPERADMIN";
  if (["ANALISTA"].includes(valor)) return "USER";
  if (["JEFATURA", "JEFE DE ABASTECIMIENTO", "JEFATURA_ABASTECIMIENTO"].includes(valor)) {
    return "JEFE_ABASTECIMIENTO";
  }
  return ROLES_VALIDOS.has(valor) ? valor : null;
}

export function esAdministrador(rol) {
  return ["ADMIN", "SUPERADMIN"].includes(normalizarRol(rol));
}

export function esSuperadministrador(rol) {
  return normalizarRol(rol) === "SUPERADMIN";
}

export function puedeVerTodasLasCotizaciones(rol) {
  return esAdministrador(rol) || normalizarRol(rol) === "JEFE_ABASTECIMIENTO";
}