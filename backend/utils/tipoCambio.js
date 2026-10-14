import { guardarTipoCambio, ultimoTipoCambioGuardado } from "../config/store.js";

// mindicador.cl entrega indicadores económicos oficiales de Chile (Banco Central),
// sin API key. El último valor se guarda en la base de datos: si la fuente no
// responde, se usa ese valor y se avisa que puede estar desactualizado (HDU-06).
const MINDICADOR_URL = "https://mindicador.cl/api/dolar";
const CACHE_MS = 1000 * 60 * 30; // 30 minutos por instancia

let cache = { valor: null, fecha: null, obtenidoEn: 0, fuente: null };

export async function obtenerTipoCambioUSD() {
  const ahora = Date.now();
  if (cache.valor && ahora - cache.obtenidoEn < CACHE_MS) return cache;

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
    return { ...guardado, fuente: "último valor guardado", respaldo: true };
  }
}
