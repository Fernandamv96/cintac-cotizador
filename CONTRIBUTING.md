# Cómo trabajamos en el repositorio

## Flujo de trabajo

1. Cada tarea del tablero (Por hacer → En curso → En revisión → Hecho) se trabaja en su propia rama:
   `git checkout -b feature/<tarea>` o `fix/<problema>`.
2. Commits pequeños y en español, con el formato `tipo: qué cambió` (por ejemplo
   `feat: mantenedor de tarifas`, `fix: validar peso cero`, `docs: guía de despliegue`, `test: casos de borde`).
3. Antes de subir: `cd backend && npm test` (y `TEST_DATABASE_URL=... npm test` si cambiaste la API).
4. Se abre un Pull Request hacia `main` con la plantilla del repositorio. Otro integrante lo revisa
   y lo aprueba; recién entonces se une. GitHub Actions ejecuta las pruebas en cada Pull Request.
5. Vercel despliega automáticamente cada cambio que entra a `main`.

## Definición de terminado

- Criterios de aceptación de la HDU cumplidos.
- Pruebas automáticas aprobadas (las nuevas reglas de negocio llevan su prueba).
- Revisado por otro integrante.
- Desplegado y probado en Vercel.

## Reglas de seguridad

- Nunca subir `.env`, la carpeta `.vercel` ni contraseñas. Los secretos van en las variables de entorno de Vercel.
- Todas las consultas a la base usan parámetros (`$1`, `$2`), nunca texto concatenado.
- Toda ruta nueva de la API pasa por `requireAuth` y, si corresponde, `requireRol`.
- Correr `npm audit --omit=dev` en `backend` y `frontend` al cerrar cada sprint.
