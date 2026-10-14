import React, { useEffect, useState } from "react";
import { useAuth } from "../api/AuthContext.jsx";
import { useLanguage } from "../api/LanguageContext.jsx";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function normalizarRol(rol) {
  if (["administrador", "ADMIN"].includes(rol)) return "ADMIN";
  if (["superadministrador", "SUPERADMIN"].includes(rol)) return "SUPERADMIN";
  if (["jefatura de abastecimiento", "JEFE_ABASTECIMIENTO"].includes(rol)) return "JEFE_ABASTECIMIENTO";
  return "USER";
}

function obtenerTokenActual() {
  const persistirSesion = localStorage.getItem("cintac-remember") === "true";
  return (persistirSesion ? localStorage : sessionStorage).getItem("token");
}

export default function Usuarios() {
  const { usuario } = useAuth();
  const { t } = useLanguage();
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState("");
  const [busquedaUsuarios, setBusquedaUsuarios] = useState("");
  const [nuevasPasswords, setNuevasPasswords] = useState({});
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: "",
    username: "",
    email: "",
    password: "",
    confirmarPassword: "",
    passwordActual: "",
    rol: "USER",
  });
  const token = obtenerTokenActual();
  const usuariosFiltrados = usuarios.filter((item) =>
    [item.nombre, item.username, item.email, normalizarRol(item.rol)]
      .some((valor) => String(valor || "").toLowerCase().includes(busquedaUsuarios.trim().toLowerCase()))
  );

  async function cargar() {
    try {
      const resp = await fetch(`${BASE_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const datos = await resp.json();
      if (!resp.ok) throw new Error(datos.error);
      setUsuarios(datos);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarRol(id, rol) {
    if (rol !== "USER") {
      setError("Los roles administrativos y de jefatura requieren aprobación por correo desde Configuración.");
      return;
    }
    if (!window.confirm(t("¿Confirmas cambiar el rol de esta cuenta a {role}?", { role: t(rol) }))) return;
    const passwordActual = rol === "USER" ? "" : window.prompt(t("Confirma esta acción con tu contraseña actual:"));
    if (rol !== "USER" && !passwordActual) return;
    const response = await fetch(`${BASE_URL}/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rol, passwordActual }),
    });
    const datos = await response.json();
    if (!response.ok) {
      setError(datos.error || "No se pudo cambiar el rol.");
      return;
    }
    cargar();
  }

  async function alternarActivo(id, activo, rol) {
    if (!window.confirm(t(activo ? "¿Confirmas desactivar esta cuenta?" : "¿Confirmas reactivar esta cuenta?"))) return;
    const passwordActual = activo && normalizarRol(rol) !== "USER"
      ? window.prompt(t("Confirma esta acción con tu contraseña actual:"))
      : "";
    if (activo && normalizarRol(rol) !== "USER" && !passwordActual) return;
    const response = await fetch(`${BASE_URL}/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ activo: !activo, passwordActual }),
    });
    const datos = await response.json();
    if (!response.ok) {
      setError(datos.error || "No se pudo actualizar el estado de la cuenta.");
      return;
    }
    cargar();
  }

  async function cambiarPasswordUsuario(id) {
    if (!window.confirm(t("¿Confirmas el cambio de contraseña de esta cuenta?"))) return;
    const passwordActual = window.prompt(t("Confirma esta acción con tu contraseña actual:"));
    if (!passwordActual) return;
    const nuevaPassword = (nuevasPasswords[id] || "").trim();
    if (nuevaPassword.length < 8 || !/[A-Za-z]/.test(nuevaPassword) || !/\d/.test(nuevaPassword)) {
      setError("La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/usuarios/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nuevaPassword, passwordActual }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || "No se pudo cambiar la contraseña.");
      setError("");
      setNuevasPasswords((prev) => ({ ...prev, [id]: "" }));
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function crearUsuario(e) {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch(`${BASE_URL}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(nuevoUsuario),
      });
      const datos = await response.json();
      if (!response.ok) throw new Error(datos.error || "No se pudo crear la cuenta.");
      setNuevoUsuario({ nombre: "", username: "", email: "", password: "", confirmarPassword: "", passwordActual: "", rol: "USER" });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="text-2xl font-semibold">{t("Gestión de usuarios")}</h2>
      <p className="mt-1 text-lg text-acero-claro">
        {t("Gestiona las cuentas de usuario y sus accesos.")}
      </p>

      {error && <p className="mt-4 text-peligro">{t(error)}</p>}

      <form onSubmit={crearUsuario} className="tarjeta mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nuevoNombre">{t("Nombre")}</label>
          <input id="nuevoNombre" required maxLength="100" value={nuevoUsuario.nombre} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })} />
        </div>
        <div>
          <label htmlFor="nuevoUsername">{t("Usuario")}</label>
          <input id="nuevoUsername" required minLength="3" maxLength="50" value={nuevoUsuario.username} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })} />
        </div>
        <div>
          <label htmlFor="nuevoEmail">{t("Correo")}</label>
          <input id="nuevoEmail" type="email" required maxLength="254" value={nuevoUsuario.email} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="nuevoPassword">{t("Contraseña temporal")}</label>
          <input id="nuevoPassword" type="password" required minLength="8" value={nuevoUsuario.password} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })} />
        </div>
        <div>
          <label htmlFor="confirmarNuevoPassword">{t("Confirmar contraseña")}</label>
          <input id="confirmarNuevoPassword" type="password" required minLength="8" value={nuevoUsuario.confirmarPassword} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, confirmarPassword: e.target.value })} />
        </div>
        <p className="sm:col-span-2 text-sm text-acero-claro">
          {t("Para crear cuentas de administrador o jefatura, usa Configuración y confirma la solicitud con el código enviado al correo principal.")}
        </p>
        <button type="submit" className="btn-primario sm:col-span-2">{t("Crear cuenta")}</button>
      </form>

      <div className="mt-6">
        <label htmlFor="buscarUsuario">{t("Buscar usuarios")}</label>
        <input id="buscarUsuario" value={busquedaUsuarios} onChange={(e) => setBusquedaUsuarios(e.target.value)} placeholder={t("Nombre, correo, usuario o rol")} />
      </div>

      <div className="mt-6 space-y-4">
        {usuariosFiltrados.map((u) => (
          <div key={u._id} className="tarjeta flex flex-wrap items-center justify-between gap-4">
            {(() => {
              const rol = normalizarRol(u.rol);
              const puedeGestionar = usuario?.rol === "SUPERADMIN" || rol === "USER";
              const rolesParaCuenta = [...new Set([rol, "USER"])];
              return <>
            <div>
              <p className="text-lg font-medium">{u.nombre}</p>
              <p className="text-acero-claro">{u.email} · {t(rol)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select value={rol} disabled={!puedeGestionar || String(u._id) === String(usuario?.id)} onChange={(e) => cambiarRol(u._id, e.target.value)}>
                {rolesParaCuenta.map((r) => (
                  <option key={r} value={r}>{t(r)}</option>
                ))}
              </select>

              <button
                className="btn-secundario px-4 py-2 text-base"
                onClick={() => alternarActivo(u._id, u.activo, u.rol)}
                disabled={!puedeGestionar || String(u._id) === String(usuario?.id)}
              >
                {u.activo ? t("Desactivar") : t("Activar")}
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder={t("Nueva contraseña")}
                  disabled={!puedeGestionar || String(u._id) === String(usuario?.id)}
                  value={nuevasPasswords[u._id] || ""}
                  onChange={(e) =>
                    setNuevasPasswords((prev) => ({ ...prev, [u._id]: e.target.value }))
                  }
                  className="min-w-[150px]"
                />
                <button
                  className="btn-primario px-3 py-2 text-sm"
                  onClick={() => cambiarPasswordUsuario(u._id)}
                  disabled={!puedeGestionar || String(u._id) === String(usuario?.id)}
                >
                  {t("Guardar")}
                </button>
              </div>
            </div>
              </>;
            })()}
          </div>
        ))}
        {usuariosFiltrados.length === 0 && (
          <p className="text-acero-claro">{t("No hay usuarios que coincidan con la búsqueda.")}</p>
        )}
      </div>
    </div>
  );
}
