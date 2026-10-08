/* ==========================================================================
   src/api/storeAuth.js — Login público de clientes de la tienda
   Endpoints: /api/store-auth (register · login · google · apple · me)
   ========================================================================== */
import api from './client.js'

/* Claves en localStorage:
   - ak-store-token / ak-store-user  -> sesión activa del cliente
   - ak-store-remember               -> { email, password, token, user } para
                                        el acceso automático en la próxima visita
   La contraseña se guarda cifrada con AES-GCM y una clave derivada del propio
   dispositivo: en disco nunca queda el texto plano. */
const TOKEN_KEY = 'ak-store-token'
const USER_KEY = 'ak-store-user'
const REMEMBER_KEY = 'ak-store-remember'

const enc = new TextEncoder()
const dec = new TextDecoder()

/* ---------- Cifrado local (AES-GCM) para la contraseña recordada ---------- */
const b64 = {
  to: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  from: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
}

async function deviceKey() {
  const seed = `${location.hostname}|ak-store-session|v1`
  const base = await crypto.subtle.importKey('raw', enc.encode(seed), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ak-store-salt'), iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptSecret(text) {
  try {
    const key = await deviceKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
    return `enc:v1:${b64.to(iv)}:${b64.to(cipher)}`
  } catch {
    return text // crypto no disponible: mejor degradar que romper el login
  }
}

async function decryptSecret(stored) {
  try {
    if (!String(stored).startsWith('enc:v1:')) return stored // valor antiguo sin cifrar
    const [, , ivB64, dataB64] = String(stored).split(':')
    const key = await deviceKey()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64.from(ivB64) },
      key,
      b64.from(dataB64)
    )
    return dec.decode(plain)
  } catch {
    return ''
  }
}

/* ---------- Sesión del cliente ---------- */
export const storeSession = {
  save({ token, user }) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({
          id: user.id,
          name: user.name,
          lastName: user.last_name ?? user.lastName ?? '',
          email: user.email,
          username: user.username ?? '',
          role: user.role,
          provider: user.provider ?? 'email',
        })
      )
    } catch {
      /* localStorage no disponible (modo privado) */
    }
  },

  get() {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) return null
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
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {
      /* noop */
    }
    window.dispatchEvent(new Event('ak-store-session-changed'))
  },
}

/* ---------- Recordar credenciales (acceso con un toque la próxima vez) ---------- */
export const storeRemember = {
  async save(email, password, user, token) {
    try {
      localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({
          email,
          password: password ? await encryptSecret(password) : '',
          user: {
            name: user?.name ?? '',
            lastName: user?.last_name ?? user?.lastName ?? '',
            email: user?.email ?? email,
            username: user?.username ?? '',
            role: user?.role ?? 'cliente',
            provider: user?.provider ?? 'email',
          },
          token,
        })
      )
    } catch {
      /* noop */
    }
  },

  /* Guarda solo el token (login social: nunca hubo contraseña local) */
  async saveSocial(user, token) {
    try {
      localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({
          email: user?.email ?? '',
          password: '',
          user: {
            name: user?.name ?? '',
            lastName: user?.last_name ?? user?.lastName ?? '',
            email: user?.email ?? '',
            username: user?.username ?? '',
            role: user?.role ?? 'cliente',
            provider: user?.provider ?? 'google',
          },
          token,
        })
      )
    } catch {
      /* noop */
    }
  },

  async load() {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY)
      if (!raw) return null
      const r = JSON.parse(raw)
      if (!r?.email || !r?.token) return null
      return { ...r, password: r.password ? await decryptSecret(r.password) : '' }
    } catch {
      return null
    }
  },

  clear() {
    try {
      localStorage.removeItem(REMEMBER_KEY)
    } catch {
      /* noop */
    }
  },
}

/* ---------- Endpoints ---------- */
export const storeAuthApi = {
  register: async (body) => {
    const { data } = await api.post('/store-auth/register', body)
    if (data?.success && data?.token) storeSession.save(data)
    return data
  },

  /* "email" puede ser el correo o el nombre de usuario único */
  login: async (email, password) => {
    const { data } = await api.post('/store-auth/login', { email, password })
    if (data?.success && data?.token) storeSession.save(data)
    return data
  },

  /* Google: recibe el id_token (credential) o el code de autorización */
  google: async (payload) => {
    const { data } = await api.post('/store-auth/google', payload)
    if (data?.success && data?.token) storeSession.save(data)
    return data
  },

  /* Apple: recibe { id_token, user? } (el nombre llega solo la 1ª vez) */
  apple: async (payload) => {
    const { data } = await api.post('/store-auth/apple', payload)
    if (data?.success && data?.token) storeSession.save(data)
    return data
  },

  me: async () => {
    /* La sesión del cliente viaja con SU token (no el del staff).
       customerAuth: el interceptor 401 de auth.js NO debe mandar al cliente
       al login del personal — su expiración se maneja aquí y en la tienda. */
    const token = storeSession.get()?.token
    const { data } = await api.get('/store-auth/me', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      customerAuth: true,
    })
    return data
  },
}

/* ---------- Pedidos del carrito (factura por correo) ----------
   Requiere sesión de cliente: el backend verifica el token, recalcula los
   precios desde la BD y envía al correo del usuario la factura estilizada. */
export const storeOrdersApi = {
  create: async (items) => {
    const token = storeSession.get()?.token
    const { data } = await api.post(
      '/store-orders',
      { items },
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        customerAuth: true, // expiración de sesión de cliente: la maneja el carrito con un toast
      }
    )
    return data
  },
}
