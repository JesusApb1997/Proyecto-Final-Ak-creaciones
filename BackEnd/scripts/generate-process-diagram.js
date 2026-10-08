/**
 * Genera el PDF "DIAGRAMADEPROCESOS.pdf"
 * Práctica Nº1 — Diagrama de procesos (proyecto final) — AK Creaciones
 *
 * Cada página es una imagen 2000×1414 (proporción A4 apaisada) dibujada como
 * SVG con la paleta del proyecto y renderizada a PNG con sharp; pdfkit las
 * une en el PDF. Ejecutar:  npm run gen:diagram
 */
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '.diagram-out');
const LOGO = path.join(__dirname, '..', '..', 'FrontEnd', 'public', 'pwa', 'icon-512.png');
const PDF_PATH = path.join(OUT_DIR, 'DIAGRAMADEPROCESOS.pdf');

/* ---------- Paleta (misma de styles.css) ---------- */
const C = {
  turq: '#1FA2C7', turqDeep: '#12718F', pink: '#E85D9E', rose: '#F58BB8',
  blush: '#FFA9A0', cream: '#FFF7EE', gold: '#E9B44C',
  bg: '#FFF9F4', surface: '#FFFFFF', text: '#2B2233', muted: '#6E6478', border: '#F0E2EA',
};
const FONT = 'Segoe UI, Arial, sans-serif';
const W = 2000, H = 1414;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Logo embebido como data URI (librsvg no resuelve file:// externos de forma fiable)
let _logoCache = null;
function logoDataUri() {
  if (!_logoCache) _logoCache = `data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}`;
  return _logoCache;
}

/* ================= Helpers de dibujo ================= */
function defs() {
  return `<defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.turq}"/><stop offset=".35" stop-color="#3EC6E0"/>
      <stop offset=".78" stop-color="${C.rose}"/><stop offset="1" stop-color="${C.blush}"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#2B2233" flood-opacity="0.13"/>
    </filter>
  </defs>`;
}

function fondo(extraBlobs = '') {
  return `<rect width="${W}" height="${H}" fill="${C.bg}"/>
  <circle cx="1830" cy="120" r="230" fill="#3EC6E0" opacity=".12"/>
  <circle cx="130" cy="1310" r="250" fill="${C.rose}" opacity=".13"/>${extraBlobs}`;
}

function header(titulo, etapa) {
  return `
  <rect x="70" y="52" width="430" height="56" rx="28" fill="url(#grad)"/>
  <text x="285" y="89" font-family="${FONT}" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">AK CREACIONES</text>
  <text x="70" y="185" font-family="${FONT}" font-size="52" font-weight="800" fill="${C.text}">${esc(titulo)}</text>
  <rect x="${W - 70 - 260}" y="60" width="260" height="48" rx="24" fill="${C.surface}" stroke="${C.turq}" stroke-width="2.5"/>
  <text x="${W - 70 - 130}" y="92" font-family="${FONT}" font-size="22" font-weight="700" fill="${C.turqDeep}" text-anchor="middle">${esc(etapa)}</text>
  <line x1="70" y1="215" x2="${W - 70}" y2="215" stroke="${C.border}" stroke-width="3"/>`;
}

function footer(n) {
  return `<text x="${W - 70}" y="${H - 40}" font-family="${FONT}" font-size="20" fill="${C.muted}" text-anchor="end">Página ${n} · Diagrama de procesos — Proyecto Final AK</text>
  <text x="70" y="${H - 40}" font-family="${FONT}" font-size="20" fill="${C.muted}">React 19 + Vite · Express 5 · Supabase (PostgreSQL + Storage)</text>`;
}

/* Caja de proceso */
function node(x, y, w, h, { title, subs = [], fill = C.surface, stroke = C.turq, titleColor = C.text, dash = '', tfs = 26 }) {
  const lines = subs
    .map((s, i) => `<text x="${x + w / 2}" y="${y + 66 + i * 34}" font-family="${FONT}" font-size="20" fill="${C.muted}" text-anchor="middle">${esc(s)}</text>`)
    .join('');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="${stroke}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''} filter="url(#soft)"/>
    <text x="${x + w / 2}" y="${y + 44}" font-family="${FONT}" font-size="${tfs}" font-weight="700" fill="${titleColor}" text-anchor="middle">${esc(title)}</text>${lines}`;
}

/* Flecha horizontal (dx positivo → punta a la derecha) */
function arrowH(x1, x2, y, { label = '', color = C.turqDeep, left = false, dashed = false } = {}) {
  const head = left
    ? `<polygon points="${x2},${y} ${x2 + 18},${y - 11} ${x2 + 18},${y + 11}" fill="${color}"/>`
    : `<polygon points="${x2},${y} ${x2 - 18},${y - 11} ${x2 - 18},${y + 11}" fill="${color}"/>`;
  return `<line x1="${x1}" y1="${y}" x2="${left ? x2 + 14 : x2 - 14}" y2="${y}" stroke="${color}" stroke-width="4" ${dashed ? 'stroke-dasharray="10 8"' : ''}/>${head}
  ${label ? `<text x="${(x1 + x2) / 2}" y="${y - 16}" font-family="${FONT}" font-size="19" font-weight="600" fill="${color}" text-anchor="middle">${esc(label)}</text>` : ''}`;
}

/* Flecha vertical hacia abajo */
function arrowV(x, y1, y2, { label = '', color = C.turqDeep } = {}) {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 14}" stroke="${color}" stroke-width="4"/>
  <polygon points="${x},${y2} ${x - 11},${y2 - 18} ${x + 11},${y2 - 18}" fill="${color}"/>
  ${label ? `<text x="${x + 16}" y="${(y1 + y2) / 2}" font-family="${FONT}" font-size="19" font-weight="600" fill="${color}">${esc(label)}</text>` : ''}`;
}

function chip(x, y, text, { fill = C.cream, stroke = C.turq, color = C.turqDeep, w = 0 } = {}) {
  const width = w || 34 + text.length * 12.5;
  return `<rect x="${x}" y="${y}" width="${width}" height="46" rx="23" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
  <text x="${x + width / 2}" y="${y + 30}" font-family="${FONT}" font-size="20" font-weight="600" fill="${color}" text-anchor="middle">${esc(text)}</text>`;
}

function desc(texto) { /* franja de descripción al pie del diagrama */
  return `<rect x="70" y="${H - 118}" width="${W - 140}" height="66" rx="16" fill="${C.cream}" stroke="${C.border}" stroke-width="2.5"/>
  <text x="95" y="${H - 77}" font-family="${FONT}" font-size="22" fill="${C.text}">${esc(texto)}</text>`;
}

/* Número de paso */
function paso(x, y, n) {
  return `<circle cx="${x}" cy="${y}" r="26" fill="url(#grad)"/>
  <text x="${x}" y="${y + 9}" font-family="${FONT}" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">${n}</text>`;
}

/* ================= Páginas ================= */

/* PORTADA */
function coverSVG() {
  const chips = ['1 · Arquitectura general', '2 · Tienda en línea', '3 · Login de clientes', '4 · Panel de administración', '5 · Recuperar contraseña', '6 · Base de datos'];
  const chipTags = chips
    .map((t, i) => chip(170 + (i % 2) * 830, 880 + Math.floor(i / 2) * 70, t))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo(`<circle cx="1000" cy="330" r="330" fill="#3EC6E0" opacity=".08"/><circle cx="1650" cy="1150" r="260" fill="${C.blush}" opacity=".12"/>`)}
  <rect x="0" y="0" width="14" height="${H}" fill="url(#grad)"/>
  <image href="${logoDataUri()}" x="890" y="180" width="220" height="220"/>
  <text x="1000" y="520" font-family="${FONT}" font-size="34" font-weight="700" letter-spacing="14" fill="${C.turq}" text-anchor="middle">PRÁCTICA Nº1 · PROYECTO FINAL</text>
  <text x="1000" y="640" font-family="${FONT}" font-size="96" font-weight="800" fill="${C.text}" text-anchor="middle">Diagrama de Procesos</text>
  <text x="1000" y="730" font-family="${FONT}" font-size="44" font-weight="600" fill="${C.turqDeep}" text-anchor="middle">Tienda en línea <tspan font-weight="800" fill="${C.pink}">AK Creaciones</tspan></text>
  <text x="1000" y="805" font-family="${FONT}" font-size="28" fill="${C.muted}" text-anchor="middle">Bisutería artesanal · zarcillos soutache hechos a mano</text>
  ${chipTags}
  <text x="1000" y="1150" font-family="${FONT}" font-size="26" fill="${C.muted}" text-anchor="middle">Frontend React 19 (Vite) · Backend Express 5 · Base de datos PostgreSQL en Supabase</text>
  <text x="1000" y="1240" font-family="${FONT}" font-size="24" fill="${C.muted}" text-anchor="middle">Generado el ${new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</text>
  </svg>`;
}

/* 1 · ARQUITECTURA */
function d1() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Arquitectura general del sistema', 'ETAPA 1 DE 6')}
  ${node(90, 330, 430, 330, { title: 'FRONTEND (Cliente)', subs: ['React 19 + Vite 7 — SPA en index.html', 'PWA instalable en móvil y PC', 'Componentes: tienda, login, dashboard', 'Puerto de desarrollo: 5173'] })}
  ${node(790, 300, 430, 390, { title: 'BACKEND (API REST)', subs: ['Express 5 — Node.js, puerto 4000', '/api/auth · /api/store-auth', '/api/products · /api/users', '/api/inventario · /api/uploads', 'JWT + bcrypt + roles', 'CORS hacia el frontend'] , stroke: C.pink})}
  ${node(1490, 300, 430, 390, { title: 'SUPABASE (Nube)', subs: ['PostgreSQL — tablas del sistema', 'Storage — bucket "Imagenes"', 'Pooler de conexiones con SSL', 'Proyecto: ieuoeqdukphibffzqiar'], stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowH(520, 790, 495, { label: 'axios · JSON · token JWT' })}
  ${arrowH(1220, 1490, 495, { label: 'pg (SQL) + Storage (SSL)' })}
  ${paso(305, 305, 1)}${paso(1005, 275, 2)}${paso(1705, 275, 3)}
  ${desc('Flujo: el navegador (React) hace peticiones HTTP con axios a la API de Express; la API valida el token JWT, ejecuta el SQL contra PostgreSQL en Supabase y devuelve JSON al frontend.')}
  </svg>`;
}

/* 2 · TIENDA */
function d2() {
  const y = 420, w = 300, h = 210;
  const xs = [90, 470, 850, 1230, 1610];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Proceso de la tienda en línea (ruta #/)', 'ETAPA 2 DE 6')}
  ${node(xs[0], y, w, h, { title: 'Visita', subs: ['El cliente abre la tienda', 'Splash de marca y tema', 'claro/oscuro guardado'] })}
  ${node(xs[1], y, w, h, { title: 'Catálogo', subs: ['GET /api/products', '10 productos desde', 'Supabase (con respaldo)'], stroke: C.pink })}
  ${node(xs[2], y, w, h, { title: 'Explorar', subs: ['Filtros por categoría', 'Búsqueda en vivo', 'Modal del producto'] })}
  ${node(xs[3], y, w, h, { title: 'Carrito', subs: ['Se guarda en localStorage', 'Clave "ak-cart"', 'Persiste al recargar'], stroke: C.pink })}
  ${node(xs[4], y, w, h, { title: 'Pedido', subs: ['Botón WhatsApp (wa.me)', 'con el detalle armado', 'QR + Instagram'], stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowH(xs[0] + w, xs[1], y + h / 2)}${arrowH(xs[1] + w, xs[2], y + h / 2)}${arrowH(xs[2] + w, xs[3], y + h / 2)}${arrowH(xs[3] + w, xs[4], y + h / 2)}
  ${paso(xs[0] + w / 2, y - 45, 1)}${paso(xs[1] + w / 2, y - 45, 2)}${paso(xs[2] + w / 2, y - 45, 3)}${paso(xs[3] + w / 2, y - 45, 4)}${paso(xs[4] + w / 2, y - 45, 5)}
  ${chip(90, 760, 'PWA instalable (manifest + service worker)')}
  ${chip(560, 760, 'Mapa de ubicación embebido (Google Maps)')}
  ${chip(1060, 760, 'Imágenes servidas desde Supabase Storage')}
  ${chip(1620, 760, 'Catálogo de respaldo si la API falla')}
  ${desc('La tienda consume la API al cargar; el carrito vive en el navegador (localStorage) y el cierre de venta se hace por WhatsApp con el detalle de las piezas seleccionadas.')}
  </svg>`;
}

/* 3 · LOGIN CLIENTES */
function d3() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Proceso de login público de clientes (ruta #/acceder)', 'ETAPA 3 DE 6')}
  ${node(660, 265, 680, 110, { title: 'Login público — email · Google · Apple', tfs: 28 })}
  ${node(120, 520, 480, 190, { title: 'Continuar con Google', subs: ['SDK oficial de Google Identity', 'id_token verificado con JWKS', 'POST /api/store-auth/google'], stroke: C.pink })}
  ${node(760, 520, 480, 190, { title: 'Continuar con Apple', subs: ['Sign in with Apple (popup)', 'id_token verificado con JWKS', 'POST /api/store-auth/apple'], stroke: C.text })}
  ${node(1400, 520, 480, 190, { title: 'Correo + contraseña', subs: ['Registro o login por email', 'POST /api/store-auth/register|login', 'Contraseña cifrada con bcrypt'] })}
  ${arrowH(1000, 360, 520, { label: '' })}${arrowH(1000, 1000, 520)}${arrowH(1000, 1640, 520)}
  ${paso(620, 320, 1)}${paso(360, 465, 2)}${paso(1000, 465, 3)}${paso(1640, 465, 4)}
  ${node(560, 790, 880, 130, { title: 'Backend: crea o valida el usuario → JWT de sesión (30 días)', tfs: 26, stroke: C.pink })}
  ${arrowV(1000, 710, 790)}
  ${node(560, 990, 880, 120, { title: 'Se guarda en Supabase: tabla users (rol "cliente")', stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowV(1000, 920, 990)}
  ${node(560, 1180, 880, 115, { title: 'localStorage: usuario + contraseña cifrada (AES-GCM) + token', tfs: 24 })}
  ${arrowV(1000, 1110, 1180)}
  ${desc('El primer acceso registra al cliente en la base de datos con su contraseña hasheada (bcrypt); en las siguientes visitas entra con un toque usando lo guardado en su dispositivo.')}
  </svg>`;
}

/* 4 · PANEL ADMIN */
function d4() {
  const y = 620, w = 380, h = 230;
  const xs = [90, 540, 990, 1440];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Proceso del panel de administración (ruta #/dashboard)', 'ETAPA 4 DE 6')}
  ${node(660, 270, 680, 110, { title: 'Login del personal — JWT de 8 horas', tfs: 27 })}
  ${node(660, 455, 680, 90, { title: 'El rol decide el acceso', subs: ['Admin → todo · Empleado → solo consulta'], tfs: 25, stroke: C.pink })}
  ${arrowV(1000, 380, 455)}
  ${node(xs[0], y, w, h, { title: 'Resumen', subs: ['Conteos de productos', 'y de usuarios', 'Tarjetas de acceso rápido'] })}
  ${node(xs[1], y, w, h, { title: 'Productos', subs: ['CRUD completo del catálogo', 'Subida de imágenes a Storage', 'Sincronizado con la tienda'], stroke: C.pink })}
  ${node(xs[2], y, w, h, { title: 'Inventario', subs: ['Materiales: soutache,', 'perlas, cristales, herrajes', 'SOLO PARA ADMIN'], stroke: C.gold, titleColor: C.turqDeep })}
  ${node(xs[3], y, w, h, { title: 'Usuarios', subs: ['CRUD de cuentas y roles', 'Ver y ELIMINAR clientes', 'No puede autoeliminarse'], stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowH(1000, xs[0] + w, y - 40)}${arrowH(1000, xs[1] + w / 2 + 5, y - 40)}${arrowH(1000, xs[2] + w / 2 - 5, y - 40)}${arrowH(1000, xs[3], y - 40, { left: true })}
  ${chip(90, 930, 'Protección en la API: verifyToken + requireRole(admin)')}
  ${chip(760, 930, 'El interceptor del frontend manda a #/login si el token expira')}
  ${chip(1470, 930, 'Empleados: modo solo lectura', { stroke: C.pink, color: C.pink })}
  ${desc('Cada acción sensible revalida el token y el rol en el backend antes de tocar la base de datos; el admin puede eliminar cualquier usuario registrado, incluidos los clientes de la tienda.')}
  </svg>`;
}

/* 5 · RECUPERACIÓN */
function d5() {
  const y1 = 400, y2 = 800, w = 500, h = 210;
  const xs = [110, 750, 1390];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Proceso de recuperación de contraseña', 'ETAPA 5 DE 6')}
  ${node(xs[0], y1, w, h, { title: '1 · ¿Olvidaste tu contraseña?', subs: ['Enlace en el login del panel', 'Pide el correo de la cuenta'] })}
  ${node(xs[1], y1, w, h, { title: '2 · Generar token', subs: ['POST /api/auth/forgot-password', 'Token aleatorio guardado como', 'SHA-256 · expira en 30 min'], stroke: C.pink })}
  ${node(xs[2], y1, w, h, { title: '3 · Enviar correo', subs: ['Enlace #/reset-password?token=…', 'SMTP real o modo desarrollo', '(se guarda en .mail-out)'], stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowH(xs[0] + w, xs[1], y1 + h / 2)}${arrowH(xs[1] + w, xs[2], y1 + h / 2)}
  ${arrowV(xs[2] + w / 2, y1 + h, y2, { label: 'el usuario abre el enlace desde su correo' })}
  ${node(xs[2], y2, w, h, { title: '4 · Formulario nuevo', subs: ['Página #/reset-password', 'Valida el token y su expiración'] })}
  ${node(xs[1], y2, w, h, { title: '5 · Guardar', subs: ['Nueva contraseña hasheada', 'con bcrypt (10 rondas)'], stroke: C.pink })}
  ${node(xs[0], y2, w, h, { title: '6 · Cerrar accesos', subs: ['password_changed_at invalida', 'todos los JWT anteriores'], stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowH(xs[2], xs[1] + w, y2 + h / 2, { left: true })}${arrowH(xs[1], xs[0] + w, y2 + h / 2, { left: true })}
  ${chip(110, 1105, 'El token es de UN SOLO USO')}
  ${chip(560, 1105, 'La respuesta nunca revela si el correo existe')}
  ${chip(1150, 1105, 'Al cambiar la clave, hay que iniciar sesión de nuevo en todos los dispositivos')}
  ${desc('Flujo seguro en seis pasos: el token viaja solo por el correo del usuario, se guarda hasheado en la base de datos, expira a los 30 minutos y su uso invalida las sesiones abiertas.')}
  </svg>`;
}

/* 6 · BASE DE DATOS */
function d6() {
  const fila = (y, cols) => cols.map((c, i) => `<text x="170" y="${y + i * 40}" font-family="${FONT}" font-size="23" fill="${C.text}">· ${esc(c)}</text>`).join('');
  const fila2 = (y, cols) => cols.map((c, i) => `<text x="1470" y="${y + i * 40}" font-family="${FONT}" font-size="23" fill="${C.text}">· ${esc(c)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Modelo de datos en Supabase (PostgreSQL)', 'ETAPA 6 DE 6')}
  <rect x="90" y="270" width="520" height="620" rx="20" fill="${C.surface}" stroke="${C.turq}" stroke-width="3.5" filter="url(#soft)"/>
  <rect x="90" y="270" width="520" height="70" rx="20" fill="url(#grad)"/>
  <text x="350" y="316" font-family="${FONT}" font-size="30" font-weight="800" fill="#fff" text-anchor="middle">users</text>
  ${fila(390, ['id · PRIMARY KEY', 'name · last_name', 'email · UNIQUE', 'role: admin | empleado | cliente', 'password_hash · bcrypt', 'provider: email | google | apple', 'provider_id (sub del proveedor)', 'reset_token_hash + expires', 'password_changed_at', 'created_at · updated_at'])}
  <rect x="1390" y="270" width="520" height="460" rx="20" fill="${C.surface}" stroke="${C.pink}" stroke-width="3.5" filter="url(#soft)"/>
  <rect x="1390" y="270" width="520" height="70" rx="20" fill="${C.pink}"/>
  <text x="1650" y="316" font-family="${FONT}" font-size="30" font-weight="800" fill="#fff" text-anchor="middle">products</text>
  ${fila2(390, ['id · PRIMARY KEY', 'name · cat (categoría)', 'price · old_price (oferta)', 'desc (descripción)', 'img · URL en Storage', 'color · tag (nuevo/oferta)', 'created_at · updated_at'])}
  ${node(760, 400, 480, 250, { title: 'BACKEND — única puerta', subs: ['Modelos SQL con pg (pool SSL)', 'Valida JWT y roles', 'Nunca expone password_hash'], stroke: C.gold, titleColor: C.turqDeep })}
  ${arrowH(610, 760, 520, { left: true })}
  ${arrowH(760, 610, 560, { label: 'SQL' })}
  ${arrowH(1240, 1390, 520, { left: true })}
  ${arrowH(1390, 1240, 560, { label: 'SQL' })}
  <rect x="90" y="960" width="1820" height="90" rx="16" fill="${C.cream}" stroke="${C.border}" stroke-width="2.5"/>
  <text x="1000" y="1013" font-family="${FONT}" font-size="24" font-weight="600" fill="${C.text}" text-anchor="middle">Supabase Storage · bucket "Imagenes":  productos/ · carrusel/ · marca/ · inventario/  (URLs públicas servidas al frontend)</text>
  ${chip(90, 1105, 'Clientes SOLO con rol "cliente" (sin acceso al panel)', { w: 620 })}
  ${chip(780, 1105, 'provider / provider_id: npm run migrate:customers', { w: 580 })}
  ${chip(90, 1180, 'password_hash NUNCA viaja al frontend (se elimina en cada respuesta)', { w: 820, stroke: C.pink, color: C.pink })}
  ${desc('Dos tablas principales: users (cuentas del personal y clientes con hashes y proveedor social) y products (catálogo); el backend es el único que habla con la base de datos.')}
  </svg>`;
}

/* RESUMEN FINAL */
function backSVG() {
  const rows = [
    ['1', 'Arquitectura', 'React (5173) → API Express (4000) → Supabase (PostgreSQL + Storage).'],
    ['2', 'Tienda', 'Catálogo desde la API, filtros, carrito en localStorage y pedido por WhatsApp.'],
    ['3', 'Login de clientes', 'Email (bcrypt) o Google/Apple verificados; el usuario queda en la BD y en el dispositivo.'],
    ['4', 'Panel admin', 'JWT por rol: productos, inventario y gestión total de usuarios (eliminar incluido).'],
    ['5', 'Recuperación', 'Token de un solo uso por correo (30 min) que invalida sesiones al usarse.'],
    ['6', 'Base de datos', 'users + products en Supabase; el backend es la única puerta con SQL seguro.'],
  ];
  const filas = rows
    .map(([n, t, d], i) => {
      const y = 350 + i * 105;
      return `${paso(150, y, n)}
      <text x="215" y="${y - 4}" font-family="${FONT}" font-size="28" font-weight="800" fill="${C.text}">${esc(t)}</text>
      <text x="215" y="${y + 30}" font-family="${FONT}" font-size="24" fill="${C.muted}">${esc(d)}</text>
      <line x1="150" y1="${y + 52}" x2="1850" y2="${y + 52}" stroke="${C.border}" stroke-width="2"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs()}
  ${fondo()}${header('Resumen del proceso completo', 'CIERRE')}
  ${filas}
  <rect x="150" y="1035" width="1700" height="120" rx="18" fill="url(#grad)"/>
  <text x="1000" y="1087" font-family="${FONT}" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">Flujo en una línea:  Cliente → React (index.html) → API Express (JWT) → Supabase (SQL + Storage) → JSON de vuelta</text>
  <text x="1000" y="1122" font-family="${FONT}" font-size="22" fill="#FFF7EE" text-anchor="middle">Seguridad transversal: bcrypt · JWT · roles · tokens verificados · secretos solo en el backend</text>
  ${footer(8)}
  </svg>`;
}

/* ================= Render y PDF ================= */
async function png(svg, name) {
  const out = path.join(OUT_DIR, name);
  await sharp(Buffer.from(svg), { density: 96 }).png().toFile(out);
  console.log('  ✔', name);
  return out;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('🎨 Renderizando diagramas (SVG → PNG)...');
  const pages = [
    await png(coverSVG(), 'p0-portada.png'),
    await png(d1(), 'p1-arquitectura.png'),
    await png(d2(), 'p2-tienda.png'),
    await png(d3(), 'p3-login.png'),
    await png(d4(), 'p4-panel.png'),
    await png(d5(), 'p5-recuperacion.png'),
    await png(d6(), 'p6-basedatos.png'),
    await png(backSVG(), 'p7-resumen.png'),
  ];

  console.log('📄 Armando PDF...');
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: {
      Title: 'DIAGRAMADEPROCESOS — AK Creaciones',
      Author: 'AK Creaciones',
      Subject: 'Práctica Nº1 — Diagrama de procesos (proyecto final)',
      Keywords: 'AK Creaciones, diagrama de procesos, React, Express, Supabase',
    },
  });
  doc.pipe(fs.createWriteStream(PDF_PATH));
  pages.forEach((p, i) => {
    if (i > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
    doc.image(p, 0, 0, { width: 841.89, height: 595.28 });
  });
  doc.end();
  doc.on('end', () => {
    const kb = (fs.statSync(PDF_PATH).size / 1024).toFixed(0);
    console.log(`\n✅ PDF listo: ${PDF_PATH} (${kb} KB, ${pages.length} páginas)`);
  });
})().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
