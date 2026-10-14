import bcrypt from "bcryptjs";
import {
  findUsuarioByLogin,
  crearUsuario,
} from "../config/store.js";

const ADMIN_USERNAME = "Cintac_Admin";
const ADMIN_EMAIL = "admin@cintac.cl";
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || null;

function adminInitialPasswordIsValid() {
  const longitudMinima = 12;
  return ADMIN_PASSWORD && ADMIN_PASSWORD.length >= longitudMinima && /[A-Za-z]/.test(ADMIN_PASSWORD) && /\d/.test(ADMIN_PASSWORD);
}

export async function ensureDefaultAdmin() {
  const existente = (await findUsuarioByLogin(ADMIN_USERNAME)) || (await findUsuarioByLogin(ADMIN_EMAIL));
  if (existente) return existente;
  if (!adminInitialPasswordIsValid()) {
    throw new Error("ADMIN_INITIAL_PASSWORD debe cumplir la longitud mínima e incluir letras y números.");
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  return crearUsuario({
    nombre: "CINTAC Admin",
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    rol: "ADMIN",
    activo: true,
  });
}

export async function ensureConfiguredSuperadmin() {
  const username = String(process.env.SUPERADMIN_USERNAME || "").trim().toLowerCase();
  const email = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_INITIAL_PASSWORD;
  if (!username && !email && !password) return null;
  if (!username || !email || !password || password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("SUPERADMIN_USERNAME, SUPERADMIN_EMAIL y una SUPERADMIN_INITIAL_PASSWORD de 12 caracteres son obligatorios.");
  }

  const existente = (await findUsuarioByLogin(username)) || (await findUsuarioByLogin(email));
  if (existente) return existente;

  const passwordHash = await bcrypt.hash(password, 12);
  const datos = {
    nombre: String(process.env.SUPERADMIN_NAME || "CINTAC Superadmin").trim().slice(0, 100),
    username,
    email,
    passwordHash,
    rol: "SUPERADMIN",
    activo: true,
  };
  return crearUsuario(datos);
}

if (process.argv[1] && process.argv[1].includes("seedAdmin.js")) {
  try {
    const admin = await ensureDefaultAdmin();
    await ensureConfiguredSuperadmin();
    console.log(`Usuario administrador listo: ${admin.username}`);
    process.exit(0);
  } catch (error) {
    console.error("No se pudo crear el usuario administrador:", error.message);
    process.exit(1);
  }
}
