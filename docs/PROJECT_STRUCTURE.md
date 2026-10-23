# Estructura del proyecto

```text
edgar-ruelas-realworld/
├── docs/
│   ├── API_ROUTES.md          # Referencia de rutas HTTP, acceso y respuestas
│   └── PROJECT_STRUCTURE.md   # Este árbol de carpetas y responsabilidades
├── src/
│   ├── app.ts                 # Configuración Express y montaje de /api
│   ├── database.ts            # Esquema SQLite, persistencia y consultas
│   ├── errors.ts              # Error tipado de API y formato de error
│   ├── routes.ts              # Rutas HTTP, autenticación y validación Zod
│   ├── server.ts              # Configuración de entorno e inicio del servidor
│   └── services.ts            # Reglas de negocio, JWT, contraseñas y serialización
├── test/
│   └── api.test.ts            # Pruebas de integración con SQLite en memoria
├── .env.example               # Ejemplo de configuración local
├── .gitignore                 # Exclusiones de Git
├── CODE_OF_CONDUCT.md         # Documento conservado del starter kit
├── favicon.ico                # Recurso conservado del starter kit
├── LICENSE                    # Licencia conservada del starter kit
├── logo.png                   # Recurso conservado del starter kit
├── package-lock.json          # Versiones bloqueadas de dependencias npm
├── package.json               # Dependencias y comandos del proyecto
├── README.md                  # Instalación, ejecución, decisiones y pruebas
└── tsconfig.json              # Configuración estricta de TypeScript
```

## Responsabilidades

- **`src/routes.ts`**: define endpoints bajo `/api`, valida cuerpos/query, interpreta el encabezado `Authorization: Token ...` y transforma errores en respuestas HTTP.
- **`src/services.ts`**: contiene las reglas de autenticación y del dominio (usuarios, perfiles, artículos, favoritos y comentarios); coordina el acceso a los datos.
- **`src/database.ts`**: inicializa el esquema SQLite y encapsula consultas y escrituras de persistencia.
- **`src/app.ts`**: instancia Express, configura JSON y conecta el router y el manejador de errores.
- **`src/server.ts`**: carga variables de entorno, valida puerto/secreto, abre la base y arranca/cierra el servidor.
- **`test/api.test.ts`**: prueba los flujos HTTP sobre una base temporal en memoria.
- **`docs/API_ROUTES.md`**: detalla rutas, autorización, parámetros, payloads y errores.

## Directorios generados localmente

Los siguientes directorios se generan durante la instalación, compilación o ejecución y están excluidos del control de versiones:

```text
node_modules/   Dependencias instaladas por npm
dist/           JavaScript generado por el build de TypeScript
data/           Base SQLite local predeterminada
```

El archivo `.env` también es local y está ignorado por Git; `.env.example` es la plantilla segura que sí se versiona.

