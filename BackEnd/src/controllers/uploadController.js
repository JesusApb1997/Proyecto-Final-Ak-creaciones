/**
 * Controlador de subida de imágenes
 * POST /api/uploads  (multipart/form-data, campo "image")  — solo admin
 *
 * 1. Si hay SUPABASE_SERVICE_ROLE en .env: sube el archivo al bucket público
 *    "imagenes" de Supabase Storage y responde con su URL pública (CDN).
 *    Así el front en Vercel no carga ninguna imagen pesada: todo vive en Supabase.
 * 2. Si no hay claves (desarrollo): guarda localmente en BackEnd/uploads/ como antes.
 *
 * La ruta /api/uploads ya está protegida con verifyToken + requireRole('admin')
 * en server.js, así que aquí no hace falta repetir la verificación.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { storageEnabled, uploadBuffer } = require('../config/storage');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];

/* Extensión y carpeta según el MIME type real del archivo */
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};
const FOLDER_BY_MIME = {
  'image/jpeg': 'productos',
  'image/png': 'productos',
  'image/webp': 'productos',
  'image/gif': 'productos',
  'image/avif': 'productos',
  'image/svg+xml': 'inventario',
};

/* Nombre seguro e irrepetible: producto-<timestamp>-<aleatorio>.<ext> */
function safeName(originalname, mimetype) {
  const safeBase = String(originalname || 'imagen')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/\.[^.]+$/, '')         // quita extensión original
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'imagen';
  return `${safeBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${EXT_BY_MIME[mimetype]}`;
}

const uploadController = {
  // POST /api/uploads — recibe un archivo (campo "image") y devuelve su URL
  async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió ninguna imagen. Envía el archivo en el campo "image" (multipart/form-data).',
        });
      }

      const { mimetype, originalname } = req.file;

      if (!ALLOWED_MIME.includes(mimetype)) {
        try { fs.unlinkSync(req.file.path); } catch { /* nada */ }
        return res.status(400).json({
          success: false,
          message: `Formato no permitido (${mimetype}). Usa JPG, PNG, WEBP, GIF, AVIF o SVG.`,
        });
      }

      const filename = safeName(originalname, mimetype);

      /* ---------- Camino 1: Supabase Storage ---------- */
      if (storageEnabled) {
        try {
          const buffer = fs.readFileSync(req.file.path);
          const objectPath = `${FOLDER_BY_MIME[mimetype] || 'productos'}/${filename}`;
          const url = await uploadBuffer(buffer, objectPath, mimetype);
          // ya está en la nube: borrar el temporal local
          try { fs.unlinkSync(req.file.path); } catch { /* nada */ }
          return res.status(201).json({ success: true, url, filename, storage: 'supabase' });
        } catch (err) {
          console.error('✗ Error subiendo a Supabase Storage, caigo a local:', err.message);
          // continúa con el fallback local abajo
        }
      }

      /* ---------- Camino 2 (fallback): disco local ---------- */
      const destPath = path.join(UPLOAD_DIR, filename);
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.renameSync(req.file.path, destPath);

      /* URL absoluta para que el frontend pueda mostrarla tal cual */
      const origin = `${req.protocol}://${req.get('host')}`;
      const url = `${origin}/uploads/${filename}`;

      res.status(201).json({ success: true, url, filename, storage: 'local' });
    } catch (err) {
      // Si algo falla, no dejar archivos temporales huérfanos
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch { /* nada */ } }
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = uploadController;
