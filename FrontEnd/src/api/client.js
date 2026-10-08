/* ==========================================================================
   src/api/client.js — Cliente axios para la API del BackEnd
   ========================================================================== */
import axios from 'axios'

// URL base de la API. Se puede sobrescribir creando un archivo .env en el
// frontend con: VITE_API_URL=http://localhost:4000/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor simple: muestra el error en consola y normaliza el mensaje
// (conserva el error original para que otros interceptores lean .response)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg =
      error?.response?.data?.message ||
      error?.message ||
      'Error de conexión con el servidor'
    console.error('[API]', msg)
    error.message = msg
    return Promise.reject(error)
  }
)

/* ---------- Usuarios (/api/users) ---------- */
export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (body) => api.post('/users', body),
  update: (id, body) => api.put(`/users/${id}`, body),
  setPassword: (id, password) => api.put(`/users/${id}/password`, { password }),
  remove: (id) => api.delete(`/users/${id}`),
}

/* ---------- Inventario (/api/inventario, solo admin) ----------
   Materiales de fabricación: soutache, perlas, cristales, herrajes…
   cantidad + unidad (cm / m / unidades), color, tipo e imagen. */
export const inventarioApi = {
  getAll: () => api.get('/inventario'),
  getById: (id) => api.get(`/inventario/${id}`),
  create: (body) => api.post('/inventario', body),
  update: (id, body) => api.put(`/inventario/${id}`, body),
  remove: (id) => api.delete(`/inventario/${id}`),
}

/* ---------- Productos (/api/products) ---------- */
export const productsApi = {
  getAll: () => api.get('/products'),
  getById: (id) => api.get(`/products/${id}`),
  create: (body) => api.post('/products', body),
  update: (id, body) => api.put(`/products/${id}`, body),
  remove: (id) => api.delete(`/products/${id}`),
}

/* ---------- Subida de imágenes (/api/uploads, solo admin) ----------
   Envía el archivo como multipart/form-data y devuelve la URL pública. */
export const uploadsApi = {
  upload: async (file) => {
    const fd = new FormData()
    fd.append('image', file)
    const { data } = await api.post('/uploads', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data // { success, url, filename }
  },
}

export default api
