// Recorrido de aceptación en el navegador (PM-01 a PM-12) con capturas de cada pantalla.
// Requisitos: npm i -D playwright && npx playwright install chromium
// Uso (contra el entorno local o uno de pruebas, nunca con datos reales de Comex):
//   BASE=http://127.0.0.1:5173/frontend USUARIO=Cintac_Admin CLAVE=... SALIDA=capturas node e2e/recorrido.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const B = process.env.BASE || "http://127.0.0.1:5173/frontend", out = process.env.SALIDA || "capturas";
const USUARIO = process.env.USUARIO || "Cintac_Admin", CLAVE = process.env.CLAVE;
if (!CLAVE) { console.error("Define CLAVE."); process.exit(1); }
mkdirSync(out, { recursive: true });
const log = [];
const ok = (id, desc, cond, extra = "") => { log.push({ id, desc, resultado: cond ? "Aprobada" : "Fallida", extra, hora: new Date().toISOString() }); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5, acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
const t0 = Date.now();
await page.goto(B + "/login"); await page.waitForTimeout(800);
ok("PM-01", "La pantalla de inicio carga", await page.locator('button[type="submit"]').count() > 0, `${Date.now() - t0} ms`);
await page.screenshot({ path: `${out}/01-login.png` });
// registro bloqueado por dominio
await page.getByText("Crear una cuenta").first().click(); await page.waitForTimeout(500);
const inputs = page.locator("form input");
const n = await inputs.count();
const valores = { text: [], email: "externo@gmail.com" };
for (let i = 0; i < n; i++) {
  const inp = inputs.nth(i); const tipo = await inp.getAttribute("type"); const nombre = (await inp.getAttribute("name")) || (await inp.getAttribute("id")) || "";
  if (tipo === "checkbox") continue;
  if (tipo === "password") await inp.fill("Externo2026");
  else if (tipo === "email" || /mail/i.test(nombre)) await inp.fill("externo@gmail.com");
  else if (/user/i.test(nombre)) await inp.fill("externo");
  else await inp.fill("Persona Externa");
}
await page.locator('form button[type="submit"]').first().click(); await page.waitForTimeout(1000);
const textoReg = await page.locator("body").innerText();
ok("PM-02", "Registro con correo externo es rechazado", /limitado a correos/.test(textoReg));
await page.screenshot({ path: `${out}/02-registro-bloqueado.png` });
await page.goto(B + "/login"); await page.waitForTimeout(600);
await page.locator("input").first().fill(USUARIO);
await page.locator('input[type="password"]').first().fill(CLAVE);
await page.locator('button[type="submit"]').first().click(); await page.waitForTimeout(1500);
ok("PM-03", "Inicio de sesión del administrador", page.url().includes("/admin") || page.url().endsWith("/"), page.url());
await page.locator('a[href="/"]').first().click().catch(() => {}); await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/03-inicio.png` });
await page.locator('a[href="/nueva"]').first().click(); await page.waitForTimeout(1000);
await page.selectOption("#puertoOrigen", "Shanghai"); await page.selectOption("#puertoDestino", "Valparaiso");
await page.fill("#cantidad", "50000"); await page.fill("#precioFOB", "35000"); await page.fill("#margenDias", "3");
await page.waitForTimeout(1500);
const filas = await page.locator("section").nth(1).locator("tbody tr").count();
ok("PM-04", "Comparación muestra los embarcadores activos de la ruta", filas >= 2, `${filas} embarcadores`);
await page.screenshot({ path: `${out}/04-nueva.png`, fullPage: true });
await page.getByRole("button", { name: /Guardar cotización con/ }).click(); await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Calcular costo/ }).click(); await page.waitForTimeout(1500);
const txt = await page.locator("section").nth(2).innerText();
ok("PM-05", "Cálculo muestra CIF, IVA y total en CLP", /CIF/.test(txt) && /IVA/.test(txt) && /CLP/.test(txt));
await page.locator("section").nth(2).screenshot({ path: `${out}/05-resultado.png` });
const dl = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
await page.getByRole("button", { name: /Finalizar y descargar/ }).click();
const d = await dl; let pdfOk = false;
if (d) { await d.saveAs(`${out}/cotizacion.pdf`); pdfOk = true; }
ok("PM-06", "Exporta la cotización a PDF (jsPDF 4)", pdfOk, d ? d.suggestedFilename() : "sin descarga");
await page.locator('a[href="/historial"]').first().click(); await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/06-historial.png` });
const checks = page.locator('input[type="checkbox"]');
const nc = await checks.count();
if (nc >= 2) { await checks.nth(0).check(); await checks.nth(1).check(); }
await page.getByRole("link", { name: /Comparar cotizaciones \(2\)/ }).click().catch(() => {}); await page.waitForTimeout(1500);
const cmp = await page.locator("table").count();
ok("PM-07", "Comparar dos cotizaciones del historial", cmp > 0, page.url());
await page.screenshot({ path: `${out}/07-comparar.png` });
await page.locator('a[href="/tarifas"]').first().click(); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/08-tarifas.png`, fullPage: true });
ok("PM-08", "Mantenedor de tarifas carga parámetros y tarifas", (await page.locator("tbody tr").count()) > 10);
await page.locator('a[href="/admin/usuarios"]').first().click(); await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/09-usuarios.png`, fullPage: true });
const tu = await page.locator("body").innerText();
ok("PM-12", "Gestión de usuarios lista las cuentas", !/Failed to fetch/.test(tu) && /admin@cintac\.cl/.test(tu));
await page.locator('a[href="/admin/auditoria"]').first().click(); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/10-auditoria.png` });
ok("PM-09", "Auditoría lista acciones registradas", (await page.locator("body").innerText()).includes("cotizacion"));
// modo oscuro
await page.evaluate(() => localStorage.setItem("cintac-theme", "oscuro"));
await page.goto(B + "/login"); await page.waitForTimeout(1500);
await page.locator('a[href="/nueva"]').first().click(); await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/11-oscuro.png` });
await page.evaluate(() => localStorage.setItem("cintac-theme", "claro"));
// móvil
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await m.goto(B + "/login"); await m.waitForTimeout(800);
await m.locator("input").first().fill(USUARIO); await m.locator('input[type="password"]').first().fill(CLAVE);
await m.locator('button[type="submit"]').first().click(); await m.waitForTimeout(1500);
await m.locator('a[href="/nueva"]').first().click(); await m.waitForTimeout(1000);
await m.selectOption("#puertoOrigen", "Busan"); await m.selectOption("#puertoDestino", "San Antonio"); await m.fill("#cantidad", "30000"); await m.waitForTimeout(1500);
const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
const tarjetas = await m.locator('input[name="proveedor-movil"]').count();
ok("PM-10", "En móvil la comparación se ve como tarjetas sin desplazamiento horizontal", tarjetas >= 2 && ancho <= 390, `ancho ${ancho}px, ${tarjetas} tarjetas`);
await m.locator('input[name="proveedor-movil"]').first().scrollIntoViewIfNeeded(); await m.waitForTimeout(300);
await m.screenshot({ path: `${out}/12-movil.png` });
ok("PM-11", "Sin errores de JavaScript en el recorrido", errores.length === 0, errores.join(" | "));
console.log(JSON.stringify(log, null, 1));
await browser.close();
