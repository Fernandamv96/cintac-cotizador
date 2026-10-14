import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const REMEMBER_KEY = "cintac-remember";
const BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

function getAuthStorage(persistirSesion) {
  return persistirSesion ? localStorage : sessionStorage;
}

function getTokenPayload(token) {
  try {
    const segmento = token?.split(".")[1];
    if (!segmento) return null;
    const base64 = segmento.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

function clearPersistedSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("usuario");
  localStorage.removeItem(REMEMBER_KEY);
}

function getPersistedUser() {
  const persistirSesion = localStorage.getItem(REMEMBER_KEY) === "true";
  const storage = getAuthStorage(persistirSesion);
  const token = storage.getItem("token");
  const payload = getTokenPayload(token);
  if (!token || !payload?.exp || payload.exp * 1000 <= Date.now()) {
    clearPersistedSession();
    return null;
  }

  try {
    const usuario = JSON.parse(storage.getItem("usuario") || "null");
    if (!usuario) clearPersistedSession();
    return usuario;
  } catch {
    clearPersistedSession();
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => getPersistedUser());

  function iniciarSesion(token, datosUsuario, persistirSesion = false) {
    clearPersistedSession();
    const storage = getAuthStorage(persistirSesion);
    storage.setItem("token", token);
    storage.setItem("usuario", JSON.stringify(datosUsuario));
    localStorage.setItem(REMEMBER_KEY, String(Boolean(persistirSesion)));
    setUsuario(datosUsuario);
  }

  function cerrarSesion(revocar = true) {
    const persistirSesion = localStorage.getItem(REMEMBER_KEY) === "true";
    const token = getAuthStorage(persistirSesion).getItem("token");
    clearPersistedSession();
    setUsuario(null);
    if (revocar && token) {
      fetch(`${BASE_URL}/usuarios/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((error) => console.error("No se pudo revocar la sesión en el servidor.", error));
    }
  }

  useEffect(() => {
    function comprobarExpiracion() {
      const persistirSesion = localStorage.getItem(REMEMBER_KEY) === "true";
      const token = getAuthStorage(persistirSesion).getItem("token");
      const payload = getTokenPayload(token);
      if (!token || !payload?.exp || payload.exp * 1000 <= Date.now()) cerrarSesion(false);
    }
    function alExpirarSesion() {
      cerrarSesion(false);
    }

    const timer = window.setInterval(comprobarExpiracion, 30_000);
    window.addEventListener("cintac:session-expired", alExpirarSesion);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("cintac:session-expired", alExpirarSesion);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
