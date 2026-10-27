import { guardarTipoCambio, ultimoTipoCambioGuardado } from "../config/store.js";

// mindicador.cl entrega indicadores económicos oficiales de Chile (Banco Central),
// sin API key. El último valor se guarda en la base de datos: si la fuente no
// responde, se usa ese valor y se avisa que puede estar desactualizado (HDU-06).
const MINDICADOR_URL = "https://mindicador.cl/api/dolar";
const CACHE_MS = 1000 * 60 * 30; // 30 minutos por instancia
const RESPALDO_MS = 1000 * 60 * 5; // si la fuente falla, se reintenta a los 5 minutos

let cache = { valor: null, fecha: null, obtenidoEn: 0, fuente: null };
let consultaEnCurso = null; // evita que muchas solicitudes simultáneas consulten la fuente a la vez

export async function obtenerTipoCambioUSD() {
  if (cache.valor && Date.now() - cache.obtenidoEn < CACHE_MS) return cache;
  if (!consultaEnCurso) {
    consultaEnCurso = consultarFuente().finally(() => {
      consultaEnCurso = null;
    });
  }
  return consultaEnCurso;
}

async function consultarFuente() {
  const ahora = Date.now();
  try {
    const respuesta = await fetch(MINDICADOR_URL, { signal: AbortSignal.timeout(5000) });
    if (!respuesta.ok) throw new Error(`mindicador.cl respondió ${respuesta.status}`);
    const datos = await respuesta.json();
    const ultimo = datos.serie?.[0];
    if (!ultimo?.valor) throw new Error("Respuesta de tipo de cambio sin datos");

    cache = { valor: Number(ultimo.valor), fecha: ultimo.fecha, obtenidoEn: ahora, fuente: "mindicador.cl" };
    await guardarTipoCambio(ultimo.fecha, cache.valor).catch((error) =>
      console.error("No se pudo guardar el tipo de cambio:", error.message)
    );
    return cache;
  } catch (error) {
    console.error("Fuente del dólar no disponible, se usa el último valor guardado:", error.message);
    const guardado = await ultimoTipoCambioGuardado();
    if (!guardado) {
      throw new Error("No se pudo obtener el tipo de cambio y no hay un valor guardado.");
    }
    // Se guarda también el respaldo en la caché por 5 minutos, para no reintentar la
    // fuente caída en cada cálculo (hallazgo de la prueba de estrés, Evaluación 3).
    cache = { ...guardado, fuente: "último valor guardado", respaldo: true, obtenidoEn: ahora - CACHE_MS + RESPALDO_MS };
    return cache;
  }
}
