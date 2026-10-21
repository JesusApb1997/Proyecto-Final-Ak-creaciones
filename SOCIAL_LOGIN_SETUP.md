# Activar el registro con Google y Apple

Los botones "Continuar con Google" / "Continuar con Apple" de `#/acceder` y
`#/registro` solo aparecen cuando existen credenciales. Si no hay, el botón no
se dibuja (así el visitante nunca ve un botón que solo puede dar error).

- **Google** → necesita `VITE_GOOGLE_CLIENT_ID` (frontend) y `GOOGLE_CLIENT_ID`
  (backend).
- **Apple** → necesita `VITE_APPLE_CLIENT_ID` y `APPLE_CLIENT_ID`. Requiere una
  cuenta de Apple Developer de pago (99 $/año). **Hoy está desactivado**: deja
  las dos variables vacías y el botón simplemente no aparece.

> ⚠️ Vite lee los `.env` **al arrancar**. Después de cambiarlos hay que reiniciar
> `npm run dev` en `FrontEnd/`. Si no, el navegador sigue con los valores viejos.

---

## 1. Google (gratis, ~5 minutos)

1. Entra a <https://console.cloud.google.com/apis/credentials>.
2. Crea un proyecto (o usa uno existente).
3. **Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre de la app
   "AK Creaciones", tu correo de soporte y el de contacto. Guarda.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
5. Rellena:
   - **Orígenes autorizados de JavaScript**
     - `http://localhost:5173`
     - `https://tu-dominio.com` (cuando publiques)
   - **URIs de redirección autorizados**
     - `http://localhost:5173/auth/google`
     - `https://tu-dominio.com/auth/google`
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

En `FrontEnd/.env`:

```env
VITE_GOOGLE_CLIENT_ID=1234567890-xxxxxxxx.apps.googleusercontent.com
```

### El secreto (opcional pero recomendado)

Cuando entras desde un navegador donde One Tap del navegador no puede
mostrarse, la app usa el flujo OAuth clásico por redirección, y ese flujo sí
necesita el secreto. El **secreto de cliente** (`GOCSPX-…`) es privado: va
**solo** en `BackEnd/.env`, nunca en el frontend y nunca en el chat.

```env
GOOGLE_CLIENT_ID=1234567890-xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-secreto
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google
```

Sin secreto, el botón funciona igual siempre que One Tap pueda mostrarse; si no,
verás el aviso *"No se pudo verificar el token de Google…"* y basta con añadir
las tres líneas de arriba.

---

## 2. Apple (de pago)

1. Cuenta de Apple Developer activa → <https://developer.apple.com/account>.
2. **Certificates, IDs & Profiles → Identifiers → Services ID** (web):
   - Activa **Sign In with Apple**.
   - *Domains*: `tu-dominio.com` (Apple no admite `localhost`: en local, la
     ventana de Apple no llegará a abrir).
   - *Return URLs*: `https://tu-dominio.com/` — debe coincidir con el
     `redirectURI` que envía `appleSignInToken()` en `src/login/socialAuth.jsx`.
3. En `FrontEnd/.env`: `VITE_APPLE_CLIENT_ID=com.akcreaciones.web`
   y en `BackEnd/.env`: `APPLE_CLIENT_ID=com.akcreaciones.web`

---

## 3. Comprobar que quedó bien

0. Antes de tocar el navegador, comprueba las credenciales desde la terminal:

   ```bash
   cd BackEnd
   npm run check:google
   ```

   El script pregunta a Google si el `GOOGLE_CLIENT_ID` sigue existiendo y si
   el `GOOGLE_CLIENT_SECRET` corresponde a ese cliente. Imprime el paso a
   seguir si algo falla. También puedes probar un ID candidato sin tocar los
   `.env`: `node scripts/check-google-client.js <client_id>`.

1. Reinicia el frontend: `cd FrontEnd && npm run dev`.
2. Abre `http://localhost:5173/#/acceder`: debe aparecer el botón de Google.
3. Ábrela consola (F12). Si al pulsar el botón ves
   `The given origin is not allowed for the given client ID`, falta añadir
   `http://localhost:5173` en **Orígenes autorizados** del paso 5 de Google.
4. Al entrar, el backend verifica el token contra los JWKS de Google y crea el
   cliente con rol `user`; la sesión queda en `localStorage` y te deja en la
   página de productos (`#/`).

### Errores frecuentes

| Mensaje | Causa |
| --- | --- |
| `Google Sign-In aún no está activo…` | Falta `VITE_GOOGLE_CLIENT_ID` o no reiniciaste Vite |
| `The given origin is not allowed…` | El origen no está en la lista de Google |
| `No se pudo verificar el token de Google. Revisa GOOGLE_CLIENT_ID en el backend.` | El backend tiene otro `GOOGLE_CLIENT_ID` (o ninguno) distinto al del frontend |
| `Acceso bloqueado: error de autorización` → `The OAuth client was not found.` (Error 401 `invalid_client`) | **El ID de cliente ya no existe en Google Cloud**: se borró la credencial, se eliminó el proyecto o el ID quedó mal copiado en los `.env`. Vuelve a crearlo en *Credenciales* y actualiza `BackEnd/.env` (ID + secreto) y `FrontEnd/.env` (ID). Confírmalo con `npm run check:google` |
| El botón no aparece | El proveedor no tiene credenciales: es intencional |
