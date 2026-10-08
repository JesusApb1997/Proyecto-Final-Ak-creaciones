/**
 * Utilidad de nombres de usuario únicos
 * Reglas: 3 a 24 caracteres, minúsculas, sin tildes, solo letras/números,
 * punto, guion y guion bajo. Se guarda SIEMPRE en minúsculas.
 */

const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

/* Convierte cualquier texto en un username válido (o devuelve '' si no queda nada utilizable) */
function sanitizeUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24);
}

/* Devuelve un mensaje de error si el username es inválido, o null si es correcto */
function usernameValidationError(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return 'El nombre de usuario es obligatorio';
  if (u.length < 3) return 'El nombre de usuario debe tener al menos 3 caracteres';
  if (u.length > 24) return 'El nombre de usuario puede tener hasta 24 caracteres';
  if (!USERNAME_RE.test(u)) {
    return 'El nombre de usuario solo acepta letras, números, punto, guion y guion bajo (sin espacios ni tildes)';
  }
  return null;
}

module.exports = { USERNAME_RE, sanitizeUsername, usernameValidationError };
