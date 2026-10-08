# 🛍️ FrontEnd — AK Creaciones (React + Vite)

Tienda de bisutería artesanal construida con **React 19 + Vite**. El catálogo se
consume desde la API del **BackEnd** (`../BackEnd`, Express + PostgreSQL en
Supabase) usando **axios**, con **CORS** ya configurado en ambos lados.

---

## 📁 Estructura del proyecto

```
FrontEnd/
├── index.html                  ← Entry point de Vite (contiene <div id="root">)
├── package.json                ← Dependencias y scripts npm
├── vite.config.js              ← Config de Vite (puerto fijo 5173)
├── .env.example                ← Ejemplo de variable VITE_API_URL
├── assets/ · fonts/ · icons/   ← Recursos estáticos (logo, tipografías, íconos)
├── img/ · products/            ← Imágenes del carrusel y del catálogo
└── src/
    ├── main.jsx                ← Arranque de React
    ├── App.jsx                 ← Router por hash: #/ (tienda), #/login, #/dashboard
    ├── styles.css              ← Estilos (antes css/styles.css)
    ├── config.js               ← Constantes (WhatsApp, colores, tamaños, money)
    ├── api/
    │   ├── client.js           ← Cliente axios (usuarios y productos)
    │   └── auth.js             ← Login JWT + sesión en localStorage (ak-token, ak-user)
    ├── login/
    │   └── LoginPage.jsx       ← Pantalla de login (logo + colores del sitio)
    ├── dashboard/
    │   ├── Dashboard.jsx       ← Sidebar + navbar del panel admin
    │   └── dashboard.css
    └── components/
        ├── Header.jsx          ← Buscador, nav, tema, login y carrito
        ├── Carousel.jsx        ← Carrusel con autoplay, dots y swipe
        ├── ProductCard.jsx     ← Tarjeta de producto
        ├── ProductModal.jsx    ← Detalle: color, tamaño, cantidad
        ├── CartPanel.jsx       ← Carrito lateral + checkout por WhatsApp
        ├── AdminModal.jsx      ← Login del dueño + alta de productos (a la BD)
        └── Footer.jsx
```

---

## 🚀 Puesta en marcha (paso a paso)

### 1. Instalar dependencias (ya hecho)

```bash
npm install
```

| Paquete              | Para qué sirve |
|----------------------|----------------|
| react / react-dom    | Interfaz de usuario |
| axios                | Consumir la API del BackEnd (`src/api/client.js`) |
| vite + @vitejs/plugin-react | Dev server y build del frontend |

### 2. Iniciar el BackEnd (en otra terminal)

```bash
cd ../BackEnd
npm run seed            # crea tablas users y datos iniciales (una vez)
npm run seed:products   # crea la tabla products con los 9 zarcillos (una vez)
npm run dev             # API en http://localhost:4000
```

### 3. Iniciar este frontend

```bash
npm run dev             # http://localhost:5173
```

El puerto **5173 ya está permitido** en el `CORS_ORIGIN` del BackEnd
(`BackEnd/.env`), así que no verás errores de CORS.

> Si corres la API en otro puerto u host, crea un archivo `.env` aquí con:
> `VITE_API_URL=http://localhost:4000/api`

---

## 🔗 Conexión con la base de datos (a través del BackEnd)

El frontend **nunca habla directo con Supabase**: siempre pasa por la API.

```
React (axios) → http://localhost:4000/api/products → Express → PostgreSQL (Supabase)
```

Endpoints que consume esta interfaz:

| Método | URL                  | Uso en la app |
|--------|----------------------|---------------|
| GET    | `/api/products`      | Catálogo de la página principal |
| POST   | `/api/products`      | Publicar producto nuevo (panel admin) |
| GET/POST/PUT/DELETE | `/api/users` | Listo para un futuro login de usuarios |

Si la API está apagada, el catálogo muestra los 9 productos de ejemplo y un
aviso para que inicies el BackEnd.

### Login y dashboard (JWT)

- Rutas: `http://localhost:5173/#/login` y `#/dashboard` (la tienda sigue en `#/`).
- Credenciales demo (creadas con `npm run seed:auth` en el BackEnd):
  - Correo: `keylaperez@gmail.com` · Contraseña: `1234` · Rol: `admin`
- Al iniciar sesión el backend firma un **JWT** (válido 8h); el frontend lo guarda en
  `localStorage` junto al nombre, apellido y rol: `ak-token` y `ak-user`.
- El dashboard valida el token contra `GET /api/auth/me` al entrar; si expira o es
  inválido, la sesión se limpia y regresa al login.
- Con sesión iniciada, el botón 👤 de la tienda lleva al dashboard; en el panel admin
  del catálogo, **Agregar producto** guarda en Supabase vía `POST /api/products`.

---

## 🧪 Probar la conexión rápido

```bash
# Con la API corriendo:
curl http://localhost:4000/api/products
```

Y en el navegador: abre http://localhost:5173 — deberías ver los zarcillos
cargados desde Supabase.
