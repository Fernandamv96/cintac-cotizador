# Cotizador de Importaciones — Cintac

Cotizador web del flete de importación marítima para el área de Comercio Exterior
(Comex) de Cintac. Frontend React + Vite, backend Node/Express y base de datos
PostgreSQL en **Neon**, desplegado en **Vercel**.

## Qué hace

- Calcula los contenedores a partir del peso (tope de **25 t** por contenedor, editable).
- Compara el flete y el tránsito de los embarcadores de una ruta y marca el más
  económico y el más rápido.
- Calcula el costo de internación con las reglas de Comex:
  CIF = FOB + flete (sin seguro) · arancel parametrizable (0 % por TLC) ·
  IVA 19 % sobre CIF + arancel · costos locales opcionales · conversión a CLP con
  el dólar observado (mindicador.cl, con respaldo del último valor guardado).
- Suma el margen de contingencia en días al tránsito.
- **Tarifas**: Comex edita tarifas, embarcadores y parámetros sin tocar el código;
  cada cambio queda con usuario y fecha y en la auditoría.
- Exporta la cotización a PDF, Excel (CSV) o Word con el desglose completo.

## Estructura

```
backend/
  config/db.js          conexión a Postgres + creación automática de tablas
  config/store.js       consultas SQL (capa de acceso a datos)
  db/schema.js          esquema (fuente única) · db/schema.sql es una copia para el informe
  db/datosIniciales.js  puertos, rutas, tarifas referenciales y parámetros iniciales
  utils/calculoCosto.js motor de cálculo (funciones puras)
  tests/                pruebas del motor de cálculo (npm test)
frontend/
  src/pages/            Login, Inicio, Nueva cotización, Historial, Comparar, Tarifas, Admin
vercel.json             despliega backend (/api) y frontend en un solo proyecto
```

## Base de datos

Diez tablas en tercera forma normal: `usuarios`, `embarcadores`, `puertos`, `rutas`,
`tarifas`, `parametros`, `cotizaciones`, `auditoria`, `aprobaciones_rol` y
`tipo_cambio`. **No hay que crearlas a mano**: el backend las crea y carga los datos
iniciales la primera vez que recibe una petición (o con `npm run db:setup`).
Si las tablas ya existen, no hace nada.

## Despliegue en Vercel con Neon (paso a paso)

1. **Subir el código a tu GitHub.** Crea un repositorio vacío (por ejemplo
   `cintac-cotizador`) y sube esta carpeta:
   ```bash
   git init            # solo si la carpeta no trae .git
   git add .
   git commit -m "Persistencia en PostgreSQL (Neon), cálculo según Comex y mantenedor de tarifas"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/cintac-cotizador.git
   git push -u origin main
   ```
   Si la carpeta ya trae `.git` (historial de Giovanni), cambia el remoto con
   `git remote set-url origin https://github.com/TU_USUARIO/cintac-cotizador.git`.
2. **Importar en Vercel.** vercel.com → *Add New… → Project* → elige el repositorio →
   deja *Root Directory* en la raíz (donde está `vercel.json`) → *Deploy*.
   El primer despliegue fallará en `/api` porque aún no hay base de datos: es normal.
3. **Crear la base en Neon.** En el proyecto de Vercel: *Storage → Create Database →
   Neon (Serverless Postgres)* → plan **Free** → región más cercana (São Paulo si
   aparece, si no `us-east-1`) → *Connect Project* marcando Production, Preview y
   Development. Vercel crea sola la variable `DATABASE_URL`.

5. **Redeploy.** *Deployments → … → Redeploy*. Abre la URL, entra con `Cintac_Admin`
   y la contraseña del paso 4. En ese primer acceso se crean las tablas.
6. **Revisar los datos.** En Vercel *Storage → (tu base) → Open in Neon → Tables*
   o *SQL Editor* (`SELECT * FROM tarifas;`).

Nunca subas `backend/.env` ni la carpeta `.vercel` al repositorio ni a un zip:
`.gitignore` ya los excluye.

## Trabajar en local

Requisitos: Node 22.

```bash
cd backend
npm install
cp .env.example .env      # pega DATABASE_URL de Neon, JWT_SECRET y ADMIN_INITIAL_PASSWORD
npm run db:setup          # crea tablas y datos iniciales (opcional: también ocurre solo)
npm test                  # 10 pruebas del motor de cálculo
npm run dev               # http://localhost:4000

cd ../frontend
npm install
npm run dev               # http://localhost:5173/frontend/
```

Tip: con la CLI de Vercel (`npm i -g vercel`, `vercel link`, `vercel env pull backend/.env`)
se descargan las mismas variables del proyecto.

## Pendiente de confirmar con Comex

- Los tres embarcadores reales y su tarifa por ruta (hoy los tres tienen la misma
  tarifa referencial de la planilla). Se cargan desde **Tarifas**.
- El margen de contingencia por defecto (hoy 0 días).
- Cómo tratar la carga que no viaja en contenedor.
