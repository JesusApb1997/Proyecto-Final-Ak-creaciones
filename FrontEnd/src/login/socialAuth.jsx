/* ==========================================================================
   src/login/socialAuth.js — Autenticación social compartida (Google · Apple)

   Usado por StoreLoginPage (#/acceder) y LoginPage (#/login) para que ambas
   vistas registren/inicien sesión con la misma lógica y sin duplicar código.
   El id_token devuelto por el proveedor viaja a /api/store-auth/google o
   /api/store-auth/apple, donde el backend verifica la firma contra los JWKS
   oficiales antes de crear la cuenta (rol 'user' / 'cliente', nunca panel).
   ========================================================================== */

/* ---------- Logos oficiales en SVG (sin depender de CDNs externos) ---------- */
export const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.1 3.56-5.18 3.56-8.82z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.27v3.1A12 12 0 0 0 12 24z"/>
    <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1z"/>
    <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z"/>
  </svg>
)

export const AppleLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-.99-1.94.03-3.73 1.13-4.73 2.86-2.02 3.5-.52 8.68 1.45 11.52.96 1.39 2.1 2.95 3.6 2.89 1.45-.06 1.99-.93 3.74-.93s2.24.93 3.77.9c1.56-.03 2.55-1.41 3.5-2.81 1.1-1.61 1.55-3.17 1.58-3.25-.04-.02-3.03-1.16-3.06-4.63zM14.16 4.06c.8-.97 1.34-2.31 1.19-3.66-1.15.05-2.55.77-3.38 1.73-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.62z"/>
  </svg>
)

/* ---------- ¿Qué proveedores están configurados? ----------
   Vite reemplaza import.meta.env.* al arrancar, por eso se leen de forma
   estática. Un proveedor sin credenciales NO se dibuja en la interfaz: así el
   visitante nunca ve un botón que solo puede dar error. */
export const socialConfig = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  appleClientId: import.meta.env.VITE_APPLE_CLIENT_ID || '',
  googleEnabled: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  appleEnabled: Boolean(import.meta.env.VITE_APPLE_CLIENT_ID),
}

/* Carga el SDK de Google Identity Services una sola vez */
function loadGoogleSdk(clientId) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google)
    if (!clientId)
      return reject(
        new Error(
          'Google Sign-In aún no está activo: falta VITE_GOOGLE_CLIENT_ID en FrontEnd/.env y reiniciar el servidor'
        )
      )
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de Google'))
    document.head.appendChild(script)
  })
}

/* Respaldo: flujo OAuth clásico por redirección (cuando One Tap no está disponible).
   El code llega a /auth/google y App.jsx lo intercambia con el backend. */
function startGoogleOauthRedirect(clientId) {
  const state = crypto.randomUUID()
  try { sessionStorage.setItem('ak-oauth-state', state) } catch { /* noop */ }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${location.origin}/auth/google`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  location.href = url.toString()
}

/*
 * Devuelve el `credential` (id_token) de Google vía One Tap oficial.
 * Si One Tap no puede mostrarse (o el usuario lo salta), arranca el flujo
 * OAuth por redirección: en ese caso la promesa nunca se resuelve porque la
 * página navega away (App.jsx completa el intercambio al volver).
 */
export function googleCredential(clientId) {
  return new Promise((resolve, reject) => {
    loadGoogleSdk(clientId)
      .then((g) => {
        let settled = false
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (settled) return
            settled = true
            if (response?.credential) resolve(response.credential)
            else reject(new Error('Google no devolvió credenciales'))
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          /* One Tap a través de FedCM: es la migración que exige Google. Sin
             esto, los métodos de estado del prompt (isNotDisplayed /
             isSkippedMoment, que usa el respaldo de abajo) dejan de funcionar
             cuando FedCM pase a ser obligatorio. */
          use_fedcm_for_prompt: true,
        })
        /* One Tap: ventana nativa de Google con las cuentas del navegador */
        g.accounts.id.prompt((notification) => {
          if (settled) return
          /* One Tap no se pudo mostrar (o el usuario lo saltó): respaldo OAuth */
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            settled = true
            startGoogleOauthRedirect(clientId)
          }
        })
      })
      .catch(reject)
  })
}

/* Carga el SDK de Sign in with Apple una sola vez */
function loadAppleSdk() {
  return new Promise((resolve, reject) => {
    if (window.AppleID) return resolve(window.AppleID)
    const script = document.createElement('script')
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    script.async = true
    script.onload = () => resolve(window.AppleID)
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de Apple'))
    document.head.appendChild(script)
  })
}

/*
 * Abre la ventana de Sign in with Apple (popup) y devuelve { idToken, user }.
 * El nombre (user.name) SOLO llega en el primer consentimiento.
 */
export async function appleSignInToken(clientId) {
  window.AppleID.auth.init({
    clientId, // Services ID (web) o Bundle ID (app) registrado en Apple
    scope: 'name email',
    redirectURI: `${location.origin}/`, // debe estar registrado en Apple (con popup no recarga)
    responseMode: 'form_post',
    usePopup: true,
  })
  const res = await window.AppleID.auth.signIn()
  const idToken = res?.authorization?.id_token || res?.id_token
  if (!idToken) throw new Error('Apple no devolvió el token de sesión')
  return { idToken, user: res?.user }
}

/* ¿El error de Apple significa que el usuario canceló el popup? (no es error) */
export function isAppleCancel(err) {
  return ['user_cancelled_authorize', 'user_cancelled_login', 'unknown error'].includes(err?.error)
}
