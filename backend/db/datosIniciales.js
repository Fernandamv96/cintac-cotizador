// Datos con los que se llena la base la primera vez (solo si las tablas están vacías).
// Tarifas: valores referenciales de la planilla "Cotizador - Calculadora.xlsx".
// IMPORTANTE: hoy las tres empresas tienen la misma tarifa porque el cliente aún no
// entrega una tarifa por embarcador. Comex debe cargar las reales desde "Tarifas".

export const EMBARCADORES = ["Delpa Group", "MundoMaritimo", "Segucargo"];

export const PUERTOS_ORIGEN = [
  { nombre: "Busan", pais: "Corea del Sur" },
  { nombre: "Ho Chi Minh", pais: "Vietnam" },
  { nombre: "Ningbo", pais: "China" },
  { nombre: "Qingdao", pais: "China" },
  { nombre: "Shanghai", pais: "China" },
  { nombre: "Shenzhen / Yantian", pais: "China" },
  { nombre: "Singapur", pais: "Singapur" },
  { nombre: "Tianjin", pais: "China" },
  { nombre: "Tokio / Yokohama", pais: "Japón" },
];

export const PUERTOS_DESTINO = [
  { nombre: "San Antonio", pais: "Chile" },
  { nombre: "Valparaiso", pais: "Chile" },
];

// [origen, destino, 20' min, 20' max, 40' min, 40' max, tránsito min, tránsito max, tipo de ruta, fuente]
export const TARIFAS_REFERENCIA = [
  ["Shanghai", "San Antonio", 1600, 2800, 2300, 3800, 25, 32, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Shanghai", "Valparaiso", 1650, 2850, 2350, 3850, 26, 34, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Ningbo", "San Antonio", 1600, 2800, 2300, 3800, 26, 32, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Ningbo", "Valparaiso", 1650, 2850, 2350, 3850, 27, 34, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Qingdao", "San Antonio", 1700, 2900, 2400, 3900, 28, 34, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Qingdao", "Valparaiso", 1750, 2950, 2450, 3950, 29, 36, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Shenzhen / Yantian", "San Antonio", 1650, 2850, 2350, 3850, 27, 33, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Shenzhen / Yantian", "Valparaiso", 1700, 2900, 2400, 3900, 28, 35, "Directo / Transbordo", "Segucargo / Delpa Group 2026"],
  ["Tianjin", "San Antonio", 1800, 3000, 2500, 4000, 30, 36, "Transbordo", "Segucargo / Delpa Group 2026"],
  ["Tianjin", "Valparaiso", 1850, 3050, 2550, 4050, 31, 38, "Transbordo", "Segucargo / Delpa Group 2026"],
  ["Busan", "San Antonio", 1700, 2900, 2400, 3900, 30, 38, "Transbordo", "MundoMaritimo / Delpa Group 2026"],
  ["Busan", "Valparaiso", 1750, 2950, 2450, 3950, 31, 40, "Transbordo", "MundoMaritimo / Delpa Group 2026"],
  ["Tokio / Yokohama", "San Antonio", 1900, 3100, 2600, 4100, 32, 40, "Transbordo", "Estimado referencial 2026"],
  ["Tokio / Yokohama", "Valparaiso", 1950, 3150, 2650, 4150, 33, 42, "Transbordo", "Estimado referencial 2026"],
  ["Ho Chi Minh", "San Antonio", 1900, 3200, 2700, 4300, 35, 42, "Transbordo", "Estimado referencial 2026"],
  ["Ho Chi Minh", "Valparaiso", 1950, 3250, 2750, 4350, 36, 44, "Transbordo", "Estimado referencial 2026"],
  ["Singapur", "San Antonio", 1850, 3100, 2600, 4200, 33, 40, "Transbordo", "Estimado referencial 2026"],
  ["Singapur", "Valparaiso", 1900, 3150, 2650, 4250, 34, 42, "Transbordo", "Estimado referencial 2026"],
];

// Reglas entregadas por Comex (reunión de levantamiento, septiembre 2026).
export const PARAMETROS = [
  { nombre: "iva", valor: 0.19, descripcion: "IVA de importación (19 %), se aplica sobre CIF + arancel" },
  { nombre: "arancel", valor: 0, descripcion: "Arancel ad valorem; 0 % porque casi todo se importa con TLC" },
  { nombre: "toneladas_por_contenedor", valor: 25, descripcion: "Tope de carga por contenedor indicado por Comex" },
  { nombre: "margen_contingencia_dias", valor: 0, descripcion: "Días de contingencia por defecto (confirmar valor con Comex)" },
];
