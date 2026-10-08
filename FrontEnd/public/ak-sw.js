/* ==========================================================================
   ak-sw.js — Service Worker de AK Creaciones (PWA)
   --------------------------------------------------------------------------
   Estrategias:
   - Shell (HTML, manifest, CSS base, iconos)  → precacheado en install
   - Navegaciones (SPA)                        → network-first, fallback al shell
   - Imágenes de Supabase Storage (CDN)        → cache-first (inmutables)
   - Fuentes/iconos locales                    → cache-first en runtime
   - API del backend (/api/, :4000)            → SIEMPRE red (nunca datos viejos)
   ========================================================================== */
const VERSION = 'ak-pwa-v2'
const SHELL_CACHE = `${VERSION}-shell`
const IMG_CACHE = `${VERSION}-img`
const IMG_CACHE_MAX = 150

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/fonts/fonts.css',
  '/icons/bootstrap-icons.min.css',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-512.png',
]

/* ---------- install: precache del shell (tolerante a fallos individuales) -- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  )
})

/* ---------- activate: limpiar versiones viejas ---------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

/* ---------- utilidades ---------------------------------------------------- */
const isSupabaseImage = (url) =>
  url.hostname.endsWith('.supabase.co') &&
  url.pathname.includes('/storage/v1/object/public/')

const isApiCall = (url) => url.pathname.startsWith('/api/')

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) {
    cache.put(request, res.clone())
    /* Límite simple de tamaño para el caché de imágenes */
    if (cacheName === IMG_CACHE) {
      const keys = await cache.keys()
      if (keys.length > IMG_CACHE_MAX) cache.delete(keys[0])
    }
  }
  return res
}

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request)
    const cache = await caches.open(SHELL_CACHE)
    cache.put('/index.html', res.clone())
    return res
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    return (
      (await cache.match('/index.html')) ||
      (await cache.match('/')) ||
      new Response('<h1>Sin conexión</h1>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 503,
      })
    )
  }
}

/* ---------- fetch --------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  /* Navegación de la SPA: red primero, shell si está offline */
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  /* API del backend: siempre red (datos frescos del dashboard) */
  if (isApiCall(url)) return

  /* Imágenes del CDN de Supabase: cache-first */
  if (isSupabaseImage(url)) {
    event.respondWith(cacheFirst(request, IMG_CACHE))
    return
  }

  /* Resto del mismo origen (fuentes, CSS de iconos, /pwa/…): cache-first */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
  }
})
