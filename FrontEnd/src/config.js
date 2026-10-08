/* ==========================================================================
   src/config.js — Constantes del sitio
   ========================================================================== */
/* WhatsApp e Instagram del negocio (número en formato internacional sin '+') */
export const WHATSAPP_NUMBER = '584142277642'
export const WHATSAPP_DISPLAY = '+58 414-2277642'
export const INSTAGRAM_URL = 'https://www.instagram.com/akcreaciones'
export const INSTAGRAM_USER = '@akcreaciones'

export const COLORS = ['Dorado', 'Plateado']
export const COLOR_HEX = { Dorado: '#E9B44C', Plateado: '#C9CDD6' }

export const SIZES_BY_CAT = {
  zarcillos: ['Pequeño', 'Mediano', 'Largo'],
  collares: ['40 cm', '45 cm', '50 cm'],
  pulseras: ['16 cm', '18 cm', '20 cm'],
  anillos: ['6', '7', '8', '9'],
  sets: ['Único'],
}

export const money = (n) =>
  '$' +
  Number(n).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/* Categorías e imágenes válidas para los formularios de producto
   (deben coincidir con CAT_ALLOWED del productController en el BackEnd) */
export const PRODUCT_CATEGORIES = ['zarcillos', 'collares', 'pulseras', 'anillos', 'sets']

/* ==========================================================================
   Imágenes servidas desde Supabase Storage
   ========================================================================== */
/* URL base del bucket público (se puede sobrescribir con VITE_SUPABASE_URL
   y VITE_SUPABASE_BUCKET; el bucket real se llama "Imagenes", con mayúscula) */
export const STORAGE_BASE =
  (import.meta.env.VITE_SUPABASE_URL || 'https://ieuoeqdukphibffzqiar.supabase.co').replace(/\/$/, '') +
  `/storage/v1/object/public/${import.meta.env.VITE_SUPABASE_BUCKET || 'Imagenes'}/`

/* QR del WhatsApp — alojado en Supabase Storage (regenerable con `npm run gen:qr` en BackEnd) */
export const WHATSAPP_QR_URL = STORAGE_BASE + 'marca/qr-whatsapp.png'

/* ==========================================================================
   Ubicación física del negocio (goo.gl/maps/6937G2g67AHX9g5RA → Caracas)
   ========================================================================== */
export const UBICACION = {
  lat: 10.4972,
  lng: -66.8565,
  direccion: 'Av. Blandín, La Castellana, Caracas — Municipio Chacao, Estado Miranda 1060, Venezuela',
}

/* Mapa interactivo embebido (embed oficial de Google, no requiere API key) */
export const UBICACION_EMBED_SRC =
  `https://www.google.com/maps?q=${UBICACION.lat},${UBICACION.lng}&hl=es&z=17&output=embed`

/* Enlaces de navegación (URLs oficiales de Google Maps y Waze) */
export const UBICACION_DIRECCIONES_URL =
  `https://www.google.com/maps/dir/?api=1&destination=${UBICACION.lat},${UBICACION.lng}`
export const UBICACION_MAPS_URL =
  `https://www.google.com/maps/search/?api=1&query=${UBICACION.lat},${UBICACION.lng}`
export const UBICACION_WAZE_URL =
  `https://waze.com/ul?ll=${UBICACION.lat},${UBICACION.lng}&navigate=yes`

/*
 * Mapa carpeta-local -> carpeta-del-bucket (las usa migrate:images al subir):
 *   /products/x.jpeg        -> productos/x.jpeg
 *   /img/x.jpeg             -> carrusel/x.jpeg
 *   /assets/brand/x.png     -> marca/x.png
 *   /imagenes_prod_inv/x.svg-> inventario/x.svg
 */
const BUCKET_MAP = [
  [/^\/products\//, 'productos/'],
  [/^\/img\//, 'carrusel/'],
  [/^\/assets\/brand\//, 'marca/'],
  [/^\/imagenes_prod_inv\//, 'inventario/'],
]

export const cdn = (ruta) => {
  if (!ruta) return ruta
  if (/^(https?:)?\/\//.test(ruta) || ruta.startsWith('data:')) return ruta // ya es absoluta
  const local = ruta.startsWith('/') ? ruta : `/${ruta}`
  for (const [re, folder] of BUCKET_MAP) {
    if (re.test(local)) return STORAGE_BASE + folder + local.replace(re, '')
  }
  return STORAGE_BASE + local.replace(/^\//, '')
}

/*
 * Fallback onError para una imagen: si la URL es del bucket pero el objeto no
 * existe (p. ej. borrado), intenta la ruta base relativa dentro del mismo
 * bucket; si es relativa vieja, la resuelve con cdn(). Nunca apunta a archivos
 * locales (ya no existen en el deploy).
 */
export const localFallback = (url) => {
  if (!url) return url
  const s = String(url)
  const marker = '/storage/v1/object/public/'
  const i = s.indexOf(marker)
  if (i !== -1) {
    // URL de Supabase: reconstruir con nuestro STORAGE_BASE (por si cambió el bucket)
    return STORAGE_BASE + s.slice(i + marker.length).split('/').slice(1).join('/')
  }
  return cdn(s) // ruta relativa vieja -> URL del bucket
}

export const PRODUCT_IMAGES = [
  '/products/zarcillo-vino.jpeg',
  '/products/zarcillo-negro-oro.jpeg',
  '/products/zarcillo-azul-royal.jpeg',
  '/products/zarcillo-turquesa.jpeg',
  '/products/zarcillo-esmeralda.jpeg',
  '/products/zarcillo-menta.jpeg',
  '/products/zarcillo-zafiro.jpeg',
  '/products/zarcillo-fiesta.jpeg',
  '/products/zarcillo-ambar.jpeg',
]

/* Galería de materiales de inventario (bucket "imagenes", carpeta inventario/) */
export const INVENTARIO_IMAGES = [
  '/imagenes_prod_inv/soutache-vino.svg',
  '/imagenes_prod_inv/soutache-negro-oro.svg',
  '/imagenes_prod_inv/soutache-azul-royal.svg',
  '/imagenes_prod_inv/soutache-turquesa.svg',
  '/imagenes_prod_inv/soutache-esmeralda.svg',
  '/imagenes_prod_inv/soutache-menta.svg',
  '/imagenes_prod_inv/soutache-fucsia.svg',
  '/imagenes_prod_inv/soutache-blanco.svg',
  '/imagenes_prod_inv/perlas-blancas.svg',
  '/imagenes_prod_inv/perlas-rosadas.svg',
  '/imagenes_prod_inv/perlas-gris.svg',
  '/imagenes_prod_inv/perlas-doradas.svg',
  '/imagenes_prod_inv/mostacillas-multicolor.svg',
  '/imagenes_prod_inv/cristal-ab.svg',
  '/imagenes_prod_inv/cantera-ambar.svg',
  '/imagenes_prod_inv/cantera-turquesa.svg',
  '/imagenes_prod_inv/cantera-rubi.svg',
  '/imagenes_prod_inv/cantera-jade.svg',
  '/imagenes_prod_inv/hiilo-soutache-oro.svg',
  '/imagenes_prod_inv/hiilo-soutache-negro.svg',
  '/imagenes_prod_inv/base-zarcillo-oro.svg',
  '/imagenes_prod_inv/base-zarcillo-plata.svg',
  '/imagenes_prod_inv/broches-plata.svg',
  '/imagenes_prod_inv/cierre-oro.svg',
  '/imagenes_prod_inv/cauchos-transparentes.svg',
]
