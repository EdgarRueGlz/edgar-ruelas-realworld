# Conduit API

Implementación backend de RealWorld Conduit con Node.js, TypeScript y SQLite. El repositorio de partida era una plantilla sin aplicación ni configuración de ejecución; los metadatos y documentos del starter kit se conservaron y este README documenta la implementación.

## Alcance

Implementa el contrato vigente de la API RealWorld: autenticación y gestión de usuarios, perfiles y seguimiento, artículos y filtros, feed, favoritos, comentarios y etiquetas. La referencia de contrato es [OpenAPI 3.1.0, versión 2.0.0](https://github.com/realworld-apps/realworld/blob/main/specs/api/openapi.yml), y la colección Hurl mantenida en [`realworld-apps/realworld/specs/api/hurl`](https://github.com/realworld-apps/realworld/tree/main/specs/api/hurl). La autenticación usa `Authorization: Token <JWT>`. Las respuestas de validación, autenticación, permisos y recursos inexistentes usan el formato `errors` de RealWorld.

## Stack y decisiones

- Node.js, TypeScript estricto, Express 5 y Zod.
- SQLite mediante `better-sqlite3`; el esquema relacional y las claves foráneas mantienen usuarios, seguimientos, artículos, etiquetas, favoritos y comentarios persistentes.
- Contraseñas derivadas con `scrypt` y sal aleatoria individual; JWT HS256 firmado con un secreto de entorno.
- Separación en rutas/validación HTTP (`src/routes.ts`), reglas de negocio y serialización (`src/services.ts`) y consultas/esquema (`src/database.ts`).
- Los slugs se forman a partir del título y se hacen únicos con sufijos. Las listas de artículos omiten `body`, como exige el contrato; el detalle sí lo incluye.

El plan fue construir primero la configuración y persistencia, después autenticación y perfiles, y luego las operaciones y permisos de artículos; se cerró con pruebas propias, la colección oficial y documentación. Se eligieron Express y SQLite para reducir la puesta en marcha sin sacrificar persistencia ni una separación sencilla de responsabilidades. No se modificaron las pruebas oficiales.

## Requisitos

- Node.js 20 o posterior y npm.
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
npm run build
npm start
npm test
npm run typecheck
```

La API se sirve bajo `http://localhost:8000/api`. El directorio de datos se crea automáticamente. `.env`, `data/`, `node_modules/` y `dist/` están excluidos de Git.

Si la documentación narrativa anterior de RealWorld difiere de los contratos actuales, prevalecen OpenAPI y Hurl. Por ejemplo, se responden `409` para conflictos de nombre/email y `201` al crear usuarios/artículos, tal como establece OpenAPI y verifica la colección vigente.

## Pruebas

### Pruebas propias

`npm test` usa `node:test`, `tsx` y Supertest con una base SQLite en memoria. Verifica registro/login, usuario autenticado, validación y conflictos, autorización, seguimiento/feed, CRUD y filtros de artículos, favoritos, comentarios, etiquetas, slugs y paginación.

Resultado verificado: **3 pruebas aprobadas, 0 fallidas**.

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
