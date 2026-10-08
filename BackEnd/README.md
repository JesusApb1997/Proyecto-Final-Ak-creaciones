# 🗄️ BackEnd — Proyecto Final AK

API REST construida con **Node.js + Express** que se conecta a una base de datos
**PostgreSQL en la nube (Supabase)**. Está preparada para recibir peticiones CRUD
desde **Postman** y desde el **frontend** (`../FrontEnd`).

---

## 📁 Estructura del proyecto

```
BackEnd/
├── .env                    ← Variables de entorno (puerto, URL de Supabase, CORS)
├── .gitignore              ← Ignora node_modules y .env
├── package.json            ← Dependencias y scripts npm
└── src/
    ├── server.js           ← Servidor principal de Express
    ├── config/
    │   └── db.js           ← Conexión a PostgreSQL (Supabase) con "pg"
    ├── models/
    │   └── User.js         ← Consultas SQL (SELECT, INSERT, UPDATE, DELETE)
    ├── controllers/
    │   └── userController.js ← Valida las peticiones y responde en JSON
    ├── routes/
    │   └── userRoutes.js   ← Define las URLs: /api/users
    └── scripts/
        └── seed.js         ← Crea la tabla e inserta los 5 usuarios iniciales
```

**Flujo de una petición:**
`Postman/Frontend → routes → controllers → models → PostgreSQL (Supabase)`

---

## 🚀 Puesta en marcha (paso a paso)

### 1. Instalar dependencias (ya hecho)

```bash
npm install
```

Dependencias instaladas:

| Paquete  | Para qué sirve |
|----------|----------------|
| express  | Crear el servidor y las rutas de la API |
| pg       | Conectar Node.js con PostgreSQL (Supabase) |
| cors     | Permitir peticiones desde el frontend sin errores de CORS |
| dotenv   | Leer las variables del archivo `.env` |
| axios    | Cliente HTTP (útil para probar o consumir APIs desde scripts) |
| nodemon  | Reinicia el servidor automáticamente en cada cambio (solo desarrollo) |

> Node.js ya viene instalado en tu máquina (v24). `npm start` / `npm run dev` lo usan.

### 2. Configurar la base de datos en Supabase ✅ (ya configurada)

El proyecto usa el **Session Pooler** de Supabase, que funciona con IPv4
(el host directo `db.<ref>.supabase.co` es solo IPv6 y falla en redes caseras):

```env
DATABASE_URL="postgresql://postgres.ieuoeqdukphibffzqiar:CONTRASENA@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
```

> Fíjate que el usuario es `postgres.<project-ref>` y el host es
> `aws-0-us-east-2.pooler.supabase.com` (la región de tu proyecto).
> Si cambias la contraseña de la base en Supabase, actualízala también aquí.

### 3. Crear la tabla y los 5 usuarios iniciales

```bash
npm run seed
```

Esto crea la tabla `users` e inserta:

| id | Name           | Role     | Email                    |
|----|----------------|----------|--------------------------|
| 1  | Rossana Perez  | empleado | rossana.perez@ak.com     |
| 2  | Jesus Perez    | empleado | jesus.perez@ak.com       |
| 3  | Alex Ribeiro   | empleado | alex.ribeiro@ak.com      |
| 4  | Albert Ribeiro | empleado | albert.ribeiro@ak.com    |
| 5  | Keyla Perez    | admin    | keyla.perez@ak.com       |

### 4. Iniciar el servidor

```bash
npm start      # modo normal
npm run dev    # modo desarrollo (se reinicia solo con nodemon)
```

El servidor queda disponible en **http://localhost:4000**

---

## 🔗 Endpoints del CRUD (para Postman)

Base URL: `http://localhost:4000/api/users`

| Método | URL             | Descripción              |
|--------|-----------------|--------------------------|
| GET    | `/api/users`    | Listar todos los usuarios |
| GET    | `/api/users/1`  | Obtener usuario por ID    |
| POST   | `/api/users`    | Crear usuario             |
| PUT    | `/api/users/1`  | Actualizar usuario        |
| DELETE | `/api/users/1`  | Eliminar usuario          |

### Ejemplos de Body (pestaña Body → raw → JSON en Postman)

**POST — crear usuario:**

```json
{
  "name": "Nuevo Usuario",
  "email": "nuevo.usuario@ak.com",
  "role": "empleado"
}
```

**PUT — actualizar usuario (puedes enviar solo los campos a cambiar):**

```json
{
  "role": "admin"
}
```

> El campo `role` solo acepta los valores `admin` o `empleado` (validado en el
> controlador Y en la base de datos). Si falta `name` o `email` en el POST,
> responde con error 400.

---

## 🖥️ Conectar con el Frontend

El frontend (`../FrontEnd`) es HTML/CSS/JS estático. El backend ya acepta
peticiones desde `http://127.0.0.1:5500` (Live Server de VS Code), configurado
en la variable `CORS_ORIGIN` del `.env`. Si tu Live Server usa otro puerto,
cámbialo ahí.

Ejemplo de uso con **Axios** desde cualquier archivo JS del frontend:

```js
// Consumir la API desde el frontend
const API = 'http://localhost:4000/api/users';

// GET - listar usuarios
const { data } = await axios.get(API);
console.log(data.data); // array de usuarios

// POST - crear usuario
await axios.post(API, {
  name: 'Nuevo Usuario',
  email: 'nuevo@ak.com',
  role: 'empleado',
});

// PUT - actualizar
await axios.put(`${API}/1`, { role: 'admin' });

// DELETE - eliminar
await axios.delete(`${API}/5`);
```

---

## 🧪 Probar rápido sin Postman

```bash
# Listar usuarios
curl http://localhost:4000/api/users

# Crear usuario
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Prueba","email":"prueba@ak.com","role":"empleado"}'
```

---

## ☁️ Imágenes en Supabase Storage (para desplegar el front en Vercel ligero)

Todas las imágenes (zarcillos, carrusel, logo y materiales de inventario) se
sirven desde el **bucket público `imagenes`** de Supabase Storage, no desde el
frontend. Así el deploy de Vercel solo incluye código y fuentes.

### Configuración inicial (una sola vez)

1. **Crear el bucket:** Panel Supabase → **Storage** → *New bucket* → nombre
   `imagenes` → marca **Public bucket** → Create.
2. **Obtener la clave service_role:** Panel Supabase → **Project Settings →
   API** → copia la clave `service_role` (secreta — SOLO para el backend,
   jamás la pongas en el frontend ni la subas a GitHub).
3. **Agregarla a `BackEnd/.env`:**

```env
SUPABASE_URL=https://ieuoeqdukphibffzqiar.supabase.co   ← ya la tienes
SUPABASE_SERVICE_ROLE="eyJhbGciOi..."   ← pega aquí la clave service_role
SUPABASE_BUCKET=imagenes
```

4. **Subir las imágenes y actualizar la BD:**

```bash
npm run migrate:images
```

Sube `products/` → `productos/`, `img/` → `carrusel/`, `assets/brand/` →
`marca/` y `public/imagenes_prod_inv/` → `inventario/` del bucket, y actualiza
las columnas `products.img` e `inventario.img` con las URLs públicas.

### Desde entonces

- **Subir una imagen nueva** (Producto o Inventario del dashboard): el backend
  la guarda en Supabase Storage y devuelve su URL pública; si estás editando
  un ítem existente, **la URL se guarda automáticamente en la BD**.
- **Editar cualquier dato** de un producto o material: se persiste en Supabase
  al guardar (los formularios hacen PUT a la API, que escribe en la BD).
- El front muestra siempre la URL de la BD; si una imagen aún no existe en el
  bucket, cae automáticamente a la copia local (`public/`) para que en
  desarrollo nada se vea roto.

> En Vercel configura también `VITE_API_URL` (la URL de tu backend desplegado)
> y `VITE_SUPABASE_URL` (opcional, ya hay un default correcto).

---

## 🔐 Recuperación de contraseña por correo

Flujo: en el login, "¿Olvidaste tu contraseña?" → llega un correo con un enlace
(`#/reset-password?token=...`) → el usuario crea una nueva contraseña.

Características de seguridad:
- El token es aleatorio de 32 bytes, de **un solo uso** y expira en **30 minutos**.
- En la BD solo se guarda el **SHA-256** del token (nunca el token en claro).
- La respuesta no revela si el correo existe o no.
- Al restablecer (o cambiar) la contraseña, los **JWT anteriores se invalidan**
  (todas las sesiones abiertas deben iniciar sesión de nuevo).

### Configurar el envío real de correos (SMTP)

Sin configuración, los correos se imprimen en la consola del backend y se guardan
en `BackEnd/.mail-out/` (modo desarrollo). Para enviarlos de verdad, agrega esto
al `.env` del backend:

**Opción Gmail** (requiere activar verificación en 2 pasos y crear una
"contraseña de aplicación" en https://myaccount.google.com/apppasswords):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=abcd efgh ijkl mnop   ← contraseña de aplicación (16 caracteres)
MAIL_FROM=AK Creaciones <tucorreo@gmail.com>
FRONT_URL=http://localhost:5173  ← URL del front para armar el enlace del correo
```

**Opción Brevo (ex Sendinblue, 300 correos/día gratis):**

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=tu-login-brevo@smtp-brevo.com
SMTP_PASS=tu-clave-smtp
MAIL_FROM=AK Creaciones <tu-correo-verificado@tudominio.com>
FRONT_URL=http://localhost:5173
```

Al reiniciar el backend verás `📧 Mailer SMTP listo` si se cargó bien.

> En modo desarrollo (sin SMTP), la respuesta de `POST /api/auth/forgot-password`
> incluye `dev_reset_url` con el enlace listo para probar el flujo sin correo.

---

## 🛍️ Login público de clientes (email · Google · Apple)

La tienda tiene un **login público para clientes** en la ruta `#/acceder` del
frontend. Los clientes se guardan en la misma tabla `users` de Supabase con el
rol `cliente` (sin acceso al panel) y pueden entrar con:

- **Correo + contraseña** (`POST /api/store-auth/register` y `/login`): la
  contraseña se guarda **hasheada con bcrypt** (10 rondas).
- **Nombre de usuario único**: al registrarse el cliente crea su `@usuario`
  (3–24 caracteres, letras/números/._- sin tildes). El login acepta **el
  correo O el @usuario** con la misma contraseña.
- **Google** (`POST /api/store-auth/google`): verifica el `id_token` contra los
  JWKS oficiales de Google; el primer login registra la cuenta.
- **Apple** (`POST /api/store-auth/apple`): igual, contra los JWKS de Apple.

Estructura (mismo patrón models → controllers → routes):

```
BackEnd/src/
├── controllers/publicAuthController.js   ← registro/login/Google/Apple de clientes
├── controllers/storeOrderController.js   ← pedidos del carrito (factura por correo)
├── routes/publicAuthRoutes.js            ← /api/store-auth/*
├── routes/storeOrderRoutes.js            ← /api/store-orders (requiere token)
├── utils/username.js                     ← validación del @usuario único
└── scripts/migrate-customers.js          ← provider, provider_id, username + rol 'cliente'
```

### Puesta en marcha

```bash
npm run migrate:customers   # columnas provider / provider_id / username + CHECK de roles
```

Luego agrega las variables OAuth a `.env` (plantilla completa en
`.env.store-auth.example`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI` y `APPLE_CLIENT_ID`. En el frontend configura
`VITE_GOOGLE_CLIENT_ID` y `VITE_APPLE_CLIENT_ID` (ver `FrontEnd/.env.example`).

Sin OAuth configurado, el **registro por correo funciona de una vez**; los
botones de Google/Apple muestran un mensaje claro de que falta configuración.

### Seguridad

- El backend **jamás confía en datos sin verificar** de Google/Apple: los
  `id_token` se validan por firma (JWKS), emisor y audiencia.
- El registro público siempre crea rol `cliente` — un cliente no puede
  autoproclamarse admin.
- El token de sesión del cliente dura **30 días** (el del staff, 8 horas).
- El admin puede **eliminar cualquier usuario** (clientes incluidos) desde
  Dashboard → Usuarios, y protegimos la cuenta admin de autoeliminarse.

## 🧾 Factura del pedido por correo (WhatsApp → email)

Cuando un **cliente con sesión** confirma su carrito con "Continuar por
WhatsApp", el frontend además registra el pedido en el backend con **su token
JWT**:

1. `POST /api/store-orders` **verifica el token** (identidad real del usuario).
2. Los precios se **recalculan desde la base de datos** (nunca desde el
   navegador) y se genera el número de pedido `AK-YYYYMMDD-XXXX`.
3. Al correo del usuario le llega la **factura estilizada de la marca** con el
   detalle de las piezas, cantidades, subtotales y el **monto total**.

Sin sesión, el flujo por WhatsApp funciona igual que siempre (solo no hay
factura por correo). Sin SMTP configurado, los correos se imprimen en consola
y se guardan en `BackEnd/.mail-out/` para poder probarlos en el navegador.

### Activar el envío real con Gmail SMTP (500 correos/día)

1. Activa la verificación en 2 pasos: <https://myaccount.google.com/security>
2. Crea una **contraseña de aplicación** de 16 caracteres:
   <https://myaccount.google.com/apppasswords>
3. En `BackEnd/.env` (plantilla en `.env.example`) agrega:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
MAIL_FROM=AK Creaciones <tu-correo@gmail.com>
```

y reinicia el backend (`npm run dev:kill`). Con eso las facturas —y los
correos de recuperación de contraseña— salen reales.

---

## 📌 Siguientes pasos sugeridos

- Agregar **autenticación con JWT** (login con email/contraseña, roles admin).
- Agregar más tablas (productos, pedidos, etc.) repitiendo el patrón
  `models → controllers → routes`.
- Validaciones más estrictas con la librería `zod` o `express-validator`.
