import { obtenerTipoCambioUSD } from "../utils/tipoCambio.js";
import { obtenerValoresParametros } from "../config/store.js";

export async function obtenerIndicadores(_req, res) {
  try {
    const [dolar, parametros] = await Promise.all([obtenerTipoCambioUSD(), obtenerValoresParametros()]);
    res.json({ dolarObservado: dolar, parametros });
  } catch (err) {
    res.status(502).json({ error: "No se pudo obtener el tipo de cambio en este momento." });
  }
}
