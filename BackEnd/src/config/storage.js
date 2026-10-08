/**
 * Cliente de Supabase Storage (REST API directa — sin dependencias extra)
 *
 * Sube imágenes al bucket público "imagenes" y devuelve la URL pública CDN.
 * Requiere SUPABASE_SERVICE_ROLE en el .env (secreto del backend, NUNCA en el front):
 *   Panel Supabase → Project Settings → API → service_role (secret)
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = process.env.SUPABASE_BUCKET || 'imagenes';

const storageEnabled = Boolean(SUPABASE_URL && SERVICE_ROLE);
if (storageEnabled) {
  console.log(`☁️  Supabase Storage listo (${SUPABASE_URL}, bucket "${BUCKET}")`);
} else {
  console.log('☁️  Supabase Storage SIN configurar: las imágenes se guardarán localmente en BackEnd/uploads/');
}

/**
 * Sube un buffer al bucket y devuelve la URL pública.
 * path dentro del bucket, ej: "productos/zarcillo-vino-1712.jpg"
 */
async function uploadBuffer(buffer, objectPath, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase Storage ${res.status}: ${text.slice(0, 200)}`);
  }
  return publicUrl(objectPath);
}

/** URL pública de un objeto del bucket */
function publicUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

module.exports = { storageEnabled, uploadBuffer, publicUrl, BUCKET };
