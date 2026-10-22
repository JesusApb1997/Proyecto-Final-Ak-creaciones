/**
 * Utilidades de HTML
 * Escape de texto para insertarlo dentro de plantillas de correo.
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

module.exports = { escapeHtml };
