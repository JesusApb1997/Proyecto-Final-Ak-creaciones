/* ==========================================================================
   src/api/auth.js — Autenticación (JWT + localStorage)
   ========================================================================== */
import api from './client.js'

const TOKEN_KEY = 'ak-token'
const USER_KEY = 'ak-user' // { name, lastName, email, role }

/* ---------- Sesión en localStorage ---------- */
export const session = {
  save({ token, user }) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        name: user.name,
        lastName: user.last_name ?? user.lastName ?? '',
        email: user.email,
        role: user.role,
      })
    )
  },

  get() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return null
    try {
      return { token, user: JSON.parse(localStorage.getItem(USER_KEY)) }
    } catch {
      return null
    }
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY))
    } catch {
      return null
    }
  },

  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    // Avisa a la app (App.jsx) para que actualice su estado de sesión
    window.dispatchEvent(new Event('ak-session-cleared'))
  },
}

/* ---------- Interceptor: envía el token en cada petición ----------
   Si la petición ya trae su propio Authorization (p. ej. la sesión del
   cliente de la tienda en storeAuth.js), no se sobreescribe. */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Interceptor de respuesta: si el token del PANEL expiró o es inválido,
   cerrar sesión y llevar al login del personal. Las peticiones marcadas con
   `customerAuth` (login/pedidos de clientes de la tienda) se excluyen: ahí la
   expiración se maneja en su propio flujo (#/acceder, toast del carrito). */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const esCliente = Boolean(error?.config?.customerAuth)
    const msg = String(error?.response?.data?.message || '')
    const invalid =
      status === 401 &&
      (msg.includes('expiró') ||
        msg.includes('inválido') ||
        msg.includes('no proporcionado') ||
        msg.includes('cambió'))
    if (invalid && !esCliente && !location.hash.includes('login')) {
      session.clear()
      location.hash = '#/login'
    }
    return Promise.reject(error)
  }
)

/* ---------- Endpoints ---------- */
export const authApi = {
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    if (data?.success && data?.token) session.save(data)
    return data
  },

  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },

  /* Cuentas con acceso al panel (para el paso "elige tu usuario") */
  accounts: async () => {
    const { data } = await api.get('/auth/accounts')
    return data
  },

  /* Solicita el enlace de recuperación (llega por correo; en dev se imprime en la consola del backend) */
  forgotPassword: async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email })
    return data
  },

  /* Restablece la contraseña con el token del enlace del correo */
  resetPassword: async (token, password) => {
    const { data } = await api.post('/auth/reset-password', { token, password })
    return data
  },

  /* Actualiza los datos del usuario del token (validado con JWT en el backend) */
  updateMe: async (body) => {
    const { data } = await api.put('/auth/me', body)
    return data
  },

  /* Cambia la contraseña del usuario del token */
  changePassword: async (current_password, new_password) => {
    const { data } = await api.put('/auth/password', { current_password, new_password })
    return data
  },
}
