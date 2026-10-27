// Prueba de carga y estrés de la API (no forma parte de npm test).
// Uso:
//   BASE_URL=http://localhost:4000/api USUARIO=Cintac_Admin CLAVE=... node tests/carga.mjs
// Mide tiempos de respuesta con 1, 10, 25 y 50 usuarios simultáneos.
// Úsala contra un entorno de pruebas: crea cotizaciones de prueba.
const BASE = process.env.BASE_URL || "http://localhost:4000/api";
const usuario = process.env.USUARIO || "Cintac_Admin";
const clave = process.env.CLAVE;
if (!clave) {
  console.error("Define CLAVE con la contraseña del usuario de pruebas.");
  process.exit(1);
}

const json = (r) => r.json();
const { token } = await fetch(`${BASE}/usuarios/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: usuario, password: clave }),
}).then(json);
if (!token) throw new Error("No se pudo iniciar sesión");
const H = { "content-type": "application/json", Authorization: `Bearer ${token}` };

const escenarios = {
  "Comparar embarcadores": () =>
    fetch(`${BASE}/cotizaciones/tarifa?puertoOrigen=Shanghai&puertoDestino=Valparaiso&cantidad=50000&tipoContenedor=40`, { headers: H }),
  "Crear y calcular cotización": async () => {
    const r = await fetch(`${BASE}/cotizaciones`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ proveedor: "Delpa Group", puertoOrigen: "Ningbo", puertoDestino: "San Antonio", cantidad: 30000, tipoContenedor: "20", precioFOB: 20000 }),
    });
    if (!r.ok) return r;
    const c = await r.json();
    return fetch(`${BASE}/cotizaciones/${c._id}/calcular`, { method: "POST", headers: H });
  },
  "Historial": () => fetch(`${BASE}/cotizaciones`, { headers: H }),
};

async function medir(nombre, fn, usuarios, porUsuario) {
  const tiempos = [];
  let errores = 0;
  const inicio = performance.now();
  await Promise.all(
    Array.from({ length: usuarios }, async () => {
      for (let i = 0; i < porUsuario; i += 1) {
        const t0 = performance.now();
        try {
          const r = await fn();
          if (!r.ok) errores += 1;
          await r.text();
        } catch {
          errores += 1;
        }
        tiempos.push(performance.now() - t0);
      }
    })
  );
  const total = (performance.now() - inicio) / 1000;
  tiempos.sort((a, b) => a - b);
  const p = (q) => tiempos[Math.min(tiempos.length - 1, Math.floor(q * tiempos.length))].toFixed(1);
  const fila = { escenario: nombre, usuarios, solicitudes: tiempos.length, p50: p(0.5), p95: p(0.95), max: tiempos.at(-1).toFixed(1),
    porSegundo: (tiempos.length / total).toFixed(1), errores };
  console.log(JSON.stringify(fila));
  return fila;
}

for (const [nombre, fn] of Object.entries(escenarios)) {
  for (const usuarios of [1, 10, 25, 50]) {
    await medir(nombre, fn, usuarios, nombre.startsWith("Crear") ? 4 : 10);
  }
}
