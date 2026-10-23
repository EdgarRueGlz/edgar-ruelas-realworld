# Conduit API y SPA

Implementación full-stack de RealWorld Conduit con API Node.js/TypeScript y una SPA React/TypeScript. El repositorio de partida era una plantilla sin aplicación ni configuración de ejecución; los metadatos y documentos del starter kit se conservaron.

## Alcance

Implementa el contrato vigente de la API RealWorld: autenticación y gestión de usuarios, perfiles y seguimiento, artículos y filtros, feed, favoritos, comentarios y etiquetas. La referencia de contrato es [OpenAPI 3.1.0, versión 2.0.0](https://github.com/realworld-apps/realworld/blob/main/specs/api/openapi.yml), y la colección Hurl mantenida en [`realworld-apps/realworld/specs/api/hurl`](https://github.com/realworld-apps/realworld/tree/main/specs/api/hurl). La autenticación usa `Authorization: Token <JWT>`. Las respuestas de validación, autenticación, permisos y recursos inexistentes usan el formato `errors` de RealWorld.

Incluye una SPA para feeds globales y seguidos, filtros por tag, artículos, comentarios, favoritos, perfiles, seguimiento, registro/login y ajustes de usuario, integrada con esta API.

## Stack y decisiones

- Node.js, TypeScript estricto, Express 5 y Zod.
- SQLite mediante `better-sqlite3`; el esquema relacional y las claves foráneas mantienen usuarios, seguimientos, artículos, etiquetas, favoritos y comentarios persistentes.
- Contraseñas derivadas con `scrypt` y sal aleatoria individual; JWT HS256 firmado con un secreto de entorno.
- Separación en rutas/validación HTTP (`src/routes.ts`), reglas de negocio y serialización (`src/services.ts`) y consultas/esquema (`src/database.ts`).
- Los slugs se forman a partir del título y se hacen únicos con sufijos. Las listas de artículos omiten `body`, como exige el contrato; el detalle sí lo incluye.

El plan fue construir primero la configuración y persistencia, después autenticación y perfiles, y luego las operaciones y permisos de artículos; se cerró con pruebas propias, la colección oficial y documentación. Se eligieron Express y SQLite para reducir la puesta en marcha sin sacrificar persistencia ni una separación sencilla de responsabilidades. No se modificaron las pruebas oficiales.

## Requisitos

- Node.js 20 o posterior y npm.
- Para el frontend se requiere Node.js 20.19+ (Vite).
- Para las pruebas de navegador: Chromium instalado mediante Playwright.
- Para la colección oficial: [Hurl](https://hurl.dev/) 8 o posterior.

## Instalación y ejecución

Desde PowerShell en Windows:

```powershell
npm ci
Copy-Item .env.example .env
```

Antes de iniciar, configura en `.env` un `JWT_SECRET` aleatorio de al menos 32 caracteres. Por ejemplo, genera uno con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Variables:

| Variable | Requerida | Predeterminado | Descripción |
| --- | --- | --- | --- |
| `PORT` | No | `8000` | Puerto HTTP |
| `JWT_SECRET` | Sí | — | Secreto de firma JWT, mínimo 32 caracteres |
| `DATABASE_PATH` | No | `./data/conduit.sqlite` | Ruta del archivo SQLite; también acepta `:memory:` |

Comandos:

```powershell
npm run dev
npm run dev:web
npm run build
npm start
npm test
npm run test:web
npm run typecheck
```

`npm run dev` inicia la API en `http://localhost:8000`; `npm run dev:web` inicia el frontend Vite en `http://localhost:5173` y proxifica `/api` hacia el backend. En producción, `npm run build` compila backend y frontend, y `npm start` sirve la SPA y la API en el puerto configurado. El directorio de datos se crea automáticamente. `.env`, `data/`, `node_modules/`, `dist/` y los resultados Playwright están excluidos de Git.

`VITE_API_BASE_URL` es opcional y por defecto `/api`. En producción debe ser una URL relativa o URL pública alcanzable desde el navegador; no debe contener secretos.

Si la documentación narrativa anterior de RealWorld difiere de los contratos actuales, prevalecen OpenAPI y Hurl. Por ejemplo, se responden `409` para conflictos de nombre/email y `201` al crear usuarios/artículos, tal como establece OpenAPI y verifica la colección vigente.

## Pruebas

### Pruebas propias

`npm test` usa `node:test`, `tsx` y Supertest con una base SQLite en memoria. Verifica registro/login, usuario autenticado, validación y conflictos, autorización, seguimiento/feed, CRUD y filtros de artículos, favoritos, comentarios, etiquetas, slugs y paginación.

`npm run test:web` ejecuta las pruebas propias de interfaz con Playwright. Instala Chromium una vez con `npx playwright install chromium`.

Resultado verificado: **3 pruebas de API aprobadas, 0 fallidas**; **4 pruebas Playwright propias aprobadas, 0 fallidas**.

La suite de navegador oficial está publicada en [`realworld-apps/realworld/specs/e2e`](https://github.com/realworld-apps/realworld/tree/main/specs/e2e). El frontend implementa sus selectores, rutas y la interfaz `window.__conduit_debug__`. Para ejecutarla sin alterar sus pruebas, clona el repositorio oficial y configura el checkout:

```powershell
git clone --depth 1 https://github.com/realworld-apps/realworld.git "$env:TEMP\realworld-e2e-tests"
$env:REALWORLD_E2E_DIR = "$env:TEMP\realworld-e2e-tests"
$env:TEST_MODE = "fullstack"
$env:API_BASE = "http://127.0.0.1:8000/api"
$env:NODE_PATH = (Join-Path (Get-Location).Path "node_modules")
npm run test:web:official
```

`fullstack` ejecuta el contrato de extremo a extremo sobre la API y SPA de este repositorio. La suite omite los casos marcados para `BROWSER_API`, que requieren interceptación de tráfico o inyección directa de tokens en el navegador; no se modificaron los tests oficiales. El comando inicia (o reutiliza) la API y Vite en los puertos `8000` y `5173`.

Resultado verificado de la suite E2E oficial: **74 aprobadas, 65 omitidas por modo, 0 fallidas (139 en total)**.

### Colección oficial Hurl

La fuente oficial es `specs/api/hurl/*.hurl` en [realworld-apps/realworld](https://github.com/realworld-apps/realworld); el script oficial `run-api-tests-hurl.sh` ejecuta Hurl en secuencia. Para ejecutar en Windows:

```powershell
winget install --id Orange-OpenSource.Hurl -e
git clone --depth 1 https://github.com/realworld-apps/realworld.git "$env:TEMP\realworld-spec"
```

Inicia la API en otra terminal y ejecuta desde la raíz de este repositorio:

```powershell
$files = Get-ChildItem "$env:TEMP\realworld-spec\specs\api\hurl" -Filter "*.hurl" | ForEach-Object { $_.FullName }
$uid = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
hurl --test --jobs 1 --variable "host=http://localhost:8000" --variable "uid=$uid" $files
```

En Windows se invoca Hurl directamente con las mismas variables y opciones que usa el script POSIX oficial. Resultado verificado con Hurl 8.0.1 y la colección oficial en `realworld-apps/realworld@ebbcdeb8d55b42a3a613c787560498b8ef10003f`: **13 archivos, 154 solicitudes ejecutadas, 13 exitosos, 0 fallidos**.

## Limitaciones y desviaciones

- La colección oficial cubre satisfactoriamente las rutas incluidas; no se ha ejecutado una prueba formal automatizada de conformidad OpenAPI ni una carga concurrente.
- La base SQLite local está pensada para esta implementación y una instancia de API; no incluye réplica, migraciones versionadas ni almacenamiento compartido entre instancias.
- El secreto JWT es obligatorio y debe configurarse antes del arranque; no se proporciona un secreto débil por defecto.
