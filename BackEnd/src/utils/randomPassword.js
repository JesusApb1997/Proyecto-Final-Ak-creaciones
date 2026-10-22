/**
 * Generador de contraseñas aleatorias (crypto-seguras)
 *
 * Se usa cuando la administración restablece la contraseña de un usuario:
 * el backend genera una contraseña nueva, la guarda HASHEADA (bcrypt) y
 * envía la versión en claro por correo al usuario.
 *
 * Propiedades:
 *  · Usa crypto.randomInt (rechazo de sesgo, nada de Math.random).
 *  · Garantiza al menos una mayúscula, una minúscula, un dígito y un símbolo.
 *  · Excluye caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar por
 *    teléfono sin confusiones, y los símbolos peligrosos en HTML (&, <, >,
 *    ", ', `, \).
 */
const crypto = require('crypto');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O
const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // sin l
const DIGITS = '23456789'; // sin 0 ni 1
const SYMBOLS = '!@#%*+-_=?'; // sin & < > " ' ` \ $

const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/** Caracter aleatorio de un conjunto (uniforme, sin sesgo). */
function pick(charset) {
  return charset[crypto.randomInt(0, charset.length)];
}

/** Mezcla Fisher-Yates con entropía criptográfica. */
function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Genera una contraseña aleatoria.
 * @param {number} length  Longitud (mínimo 8, máximo 64)
 * @returns {string} Contraseña en claro (nunca se guarda en la BD: se hashea)
 */
function generateRandomPassword(length = 12) {
  const total = Math.min(64, Math.max(8, Number(length) || 12));

  // Una de cada categoría primero: cumple la regla de composición
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < total) chars.push(pick(ALL));

  return shuffle(chars);
}

module.exports = { generateRandomPassword };
