# Rutas de la API Conduit

## Convenciones

- URL base local: `http://localhost:8000/api`. Todas las rutas de esta referencia son relativas a `/api`.
- Los cuerpos y respuestas se envían como JSON.
- Rutas protegidas: requieren `Authorization: Token <JWT>`.
- Rutas públicas aceptan solicitudes sin token. Si se envía un token, la API lo valida; un token inválido devuelve `401`.
- Los errores de API usan `{ "errors": { "<campo>": ["<mensaje>"] } }`.
- La paginación de listas usa `limit` (predeterminado `20`) y `offset` (predeterminado `0`). Deben ser enteros no negativos; un valor inválido devuelve `422`.

## Autenticación y usuario

| Método y ruta | Acceso | Éxito | Descripción |
| --- | --- | --- | --- |
| `POST /users` | Público | `201` | Registra un usuario. Recibe `{ "user": { "username", "email", "password" } }`; devuelve `{ "user": { "username", "email", "token", "bio", "image" } }`. |
| `POST /users/login` | Público | `200` | Inicia sesión. Recibe `{ "user": { "email", "password" } }`; devuelve el usuario autenticado y su JWT. |
| `GET /user` | Protegido | `200` | Devuelve el usuario autenticado y un JWT. |
| `PUT /user` | Protegido | `200` | Actualiza los campos enviados dentro de `user`: `username`, `email`, `password`, `bio` o `image`. `bio` e `image` pueden ser `null`; un texto vacío se normaliza a `null`. Devuelve el usuario actualizado y un JWT. |

**Validación y errores específicos**

- Campos requeridos vacíos o un correo inválido: `422`.
- Contraseña al actualizar: de 8 a 128 caracteres.
- Credenciales incorrectas al iniciar sesión: `401`, campo `credentials`.
- Nombre de usuario o correo ya registrados: `409`, campo correspondiente (`username` o `email`).
- Rutas protegidas sin credenciales: `401`, `token: ["is missing"]`; token no válido: `401`.

## Perfiles y seguimiento

| Método y ruta | Acceso | Éxito | Descripción |
| --- | --- | --- | --- |
| `GET /profiles/:username` | Público | `200` | Devuelve `{ "profile": { "username", "bio", "image", "following" } }`. `following` refleja la relación con el usuario autenticado y es `false` sin sesión. |
| `POST /profiles/:username/follow` | Protegido | `200` | Sigue al perfil y devuelve el perfil actualizado. |
| `DELETE /profiles/:username/follow` | Protegido | `200` | Deja de seguir al perfil y devuelve el perfil actualizado. |

Un perfil inexistente devuelve `404` con `profile: ["not found"]`. No se crea una relación al intentar seguirse a uno mismo.

## Artículos

| Método y ruta | Acceso | Éxito | Descripción |
| --- | --- | --- | --- |
| `GET /articles` | Público | `200` | Lista artículos y devuelve `{ "articles": [...], "articlesCount": n }`. Acepta filtros opcionales `tag`, `author` y `favorited`, además de `limit` y `offset`. Los artículos de la lista no incluyen `body`. |
| `GET /articles/feed` | Protegido | `200` | Lista artículos de autores a los que sigue el usuario. Acepta `limit` y `offset`; devuelve el mismo formato de lista. |
| `POST /articles` | Protegido | `201` | Crea un artículo. Recibe `{ "article": { "title", "description", "body", "tagList" } }`; `tagList` es opcional y por defecto `[]`. Devuelve `{ "article": ... }`. |
| `GET /articles/:slug` | Público | `200` | Devuelve `{ "article": ... }` con el cuerpo completo. |
| `PUT /articles/:slug` | Protegido; solo autor | `200` | Actualiza cualquiera de `title`, `description`, `body` y `tagList` presentes dentro de `article`. Si cambia el título, se genera un slug nuevo; si no se envía `tagList`, se conservan las etiquetas. |
| `DELETE /articles/:slug` | Protegido; solo autor | `204` | Elimina el artículo. No devuelve cuerpo. |
| `POST /articles/:slug/favorite` | Protegido | `200` | Marca el artículo como favorito y devuelve el artículo actualizado. |
| `DELETE /articles/:slug/favorite` | Protegido | `200` | Quita el favorito y devuelve el artículo actualizado. |

El objeto de artículo contiene `slug`, `title`, `description`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` y `author`. El detalle también incluye `body`; los objetos de lista lo omiten. Los slugs derivados del título se hacen únicos, incluso para títulos repetidos.

**Filtros y errores específicos**

- `tag=<etiqueta>`: filtra por etiqueta.
- `author=<usuario>`: filtra por autor.
- `favorited=<usuario>`: filtra por usuario que marcó los artículos como favoritos.
- `limit` y `offset`: enteros no negativos; `limit` predeterminado `20`, `offset` predeterminado `0`.
- Título, descripción o cuerpo requeridos vacíos: `422`.
- Artículo inexistente: `404`, `article: ["not found"]`.
- Intentar actualizar o borrar un artículo ajeno: `403`, `article: ["forbidden"]`.
- Feed, creación, edición, borrado y favoritos requieren autenticación.

## Comentarios

| Método y ruta | Acceso | Éxito | Descripción |
| --- | --- | --- | --- |
| `GET /articles/:slug/comments` | Público | `200` | Devuelve `{ "comments": [...] }` para el artículo. |
| `POST /articles/:slug/comments` | Protegido | `201` | Recibe `{ "comment": { "body": "..." } }` y devuelve `{ "comment": ... }`. |
| `DELETE /articles/:slug/comments/:id` | Protegido; solo autor del comentario | `204` | Elimina el comentario. No devuelve cuerpo. |

Un comentario incluye `id`, `body`, `createdAt`, `updatedAt` y `author`. El cuerpo vacío devuelve `422`; un artículo o comentario inexistente devuelve `404`; borrar el comentario de otro usuario devuelve `403`.

## Etiquetas

| Método y ruta | Acceso | Éxito | Descripción |
| --- | --- | --- | --- |
| `GET /tags` | Público | `200` | Devuelve `{ "tags": ["..."] }` con las etiquetas existentes. |

## Formato general de errores

| Código | Uso |
| --- | --- |
| `401` | Falta autenticación en una ruta protegida, token inválido o credenciales incorrectas. |
| `403` | El usuario autenticado no tiene permiso para editar o eliminar el recurso. |
| `404` | No existe el artículo, perfil, comentario o ruta solicitada. |
| `409` | Conflicto con un nombre de usuario o correo ya registrado. |
| `422` | Validación de entrada fallida, JSON mal formado o paginación no válida. |
| `500` | Error interno no esperado. |

