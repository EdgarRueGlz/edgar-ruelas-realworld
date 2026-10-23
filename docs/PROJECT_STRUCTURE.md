# Estructura del proyecto

```text
edgar-ruelas-realworld/
├── docs/
│   ├── API_ROUTES.md              # Rutas HTTP, autorización y respuestas
│   └── PROJECT_STRUCTURE.md       # Este árbol y responsabilidades
├── src/                            # API Node.js/Express
│   ├── app.ts                      # Configuración Express y servicio de la SPA compilada
│   ├── database.ts                 # Esquema SQLite, persistencia y consultas
│   ├── errors.ts                   # Errores de API y formato de respuesta
│   ├── routes.ts                   # Rutas HTTP, autenticación y validación Zod
│   ├── server.ts                   # Entorno e inicio del servidor
│   └── services.ts                 # Lógica de negocio, JWT y serialización
├── test/
│   └── api.test.ts                 # Pruebas de integración de la API
├── web/                            # Aplicación React/TypeScript
│   ├── e2e/
│   │   └── app.spec.ts             # Pruebas Playwright propias
│   ├── public/
│   │   └── default-avatar.svg      # Avatar predeterminado
│   ├── src/
│   │   ├── api/client.ts           # Cliente HTTP y tipos de respuesta
│   │   ├── auth/AuthContext.tsx    # Estado de sesión y autenticación
│   │   ├── components/             # Layout, avatar, tarjetas, errores y paginación
│   │   ├── pages/                  # Home, artículos, perfiles, editor y ajustes
│   │   ├── App.tsx                 # Rutas de navegación
│   │   ├── main.tsx                # Punto de entrada React
│   │   ├── styles.css              # Estilos de la aplicación
│   │   ├── types.ts                # Tipos compartidos de UI
│   │   └── vite-env.d.ts           # Tipos de Vite
│   └── tsconfig.json               # Configuración TypeScript del frontend
├── .env.example                    # Ejemplo seguro de variables locales
├── .gitignore                      # Exclusiones de Git
├── CODE_OF_CONDUCT.md              # Documento conservado del starter kit
├── favicon.ico                     # Recurso conservado del starter kit
├── index.html                      # HTML de entrada de Vite
├── LICENSE                         # Licencia conservada del starter kit
├── logo.png                        # Recurso conservado del starter kit
├── package-lock.json               # Versiones bloqueadas de dependencias npm
├── package.json                    # Dependencias y comandos del proyecto
├── playwright.config.ts            # Configuración Playwright de pruebas propias
├── playwright.official.config.ts   # Ejecución de la suite E2E oficial sin modificarla
├── README.md                       # Instalación, ejecución, decisiones y pruebas
├── tsconfig.json                   # Configuración TypeScript de la API
└── vite.config.mts                 # Build del frontend y proxy API local
```

## Responsabilidades

- **`src/routes.ts`**: define endpoints bajo `/api`, valida cuerpos y query strings, interpreta `Authorization: Token ...` y transforma errores en respuestas HTTP.
- **`src/services.ts`**: implementa reglas de autenticación y del dominio, y coordina las operaciones de persistencia.
- **`src/database.ts`**: inicializa el esquema SQLite y encapsula consultas y escrituras.
- **`src/app.ts`**: conecta Express, el router y el manejador de errores; sirve `dist/web` cuando existe el build del frontend.
- **`src/server.ts`**: carga variables de entorno, valida configuración, abre la base y arranca/cierra el servidor.
- **`web/src/api/client.ts`** y **`web/src/auth/AuthContext.tsx`**: centralizan la comunicación con la API y el estado autenticado de la SPA.
- **`web/src/pages/`**: contiene las pantallas y flujos de navegación de Conduit.
- **`web/src/components/`**: contiene componentes compartidos para layout, artículos, errores y navegación.
- **`web/e2e/app.spec.ts`** y **`test/api.test.ts`**: prueban respectivamente los flujos de navegador propios y la API.
- **`playwright.official.config.ts`**: apunta al checkout de la suite oficial en `REALWORLD_E2E_DIR`; los specs oficiales no se copian ni modifican.
- **`docs/API_ROUTES.md`**: detalla rutas, autorización, parámetros, payloads y errores.

## Directorios generados localmente

Se excluyen del control de versiones:

```text
node_modules/   Dependencias npm
dist/           JavaScript y archivos del frontend generados por el build
data/           Base SQLite local predeterminada
test-results/   Resultados y trazas de Playwright
```

El archivo `.env` también es local e ignorado por Git; `.env.example` es la plantilla segura versionada.
