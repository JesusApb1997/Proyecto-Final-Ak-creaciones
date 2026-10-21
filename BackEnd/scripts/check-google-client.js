/**
 * Comprueba que el cliente OAuth de Google configurado realmente exista en
 * Google Cloud. Sin esto, un cliente borrado (o mal copiado) solo se detecta
 * en el navegador, con la pantalla de Google "The OAuth client was not found.
 * Error 401: invalid_client" y sin pistas sobre el origen del problema.
 *
 * Uso:
 *   node scripts/check-google-client.js                -> prueba el ID de BackEnd/.env
 *   node scripts/check-google-client.js <client_id>    -> prueba un ID candidato
 *
 * No imprime el secreto: solo su longitud. Sin dependencias extra (usa fetch).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPES = 'openid email profile';

const clientId = (process.argv[2] || process.env.GOOGLE_CLIENT_ID || '').trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const redirectUri = (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google').trim();

const ok = (m) => console.log(`  [OK]    ${m}`);
const bad = (m) => console.log(`  [FALLA] ${m}`);
const warn = (m) => console.log(`  [AVISO] ${m}`);

/* Google codifica el error como un protobuf en base64: separadores de control
   entre "codigo" y "mensaje". Se construyen con charCode para no escribir
   caracteres de control literales en el archivo. */
const CTRL = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + ']+');
const REPL = String.fromCharCode(0xfffd);
const clean = (s) => s.split(REPL).join('').replace(/\s+/g, ' ').trim();

/** Google devuelve el error en base64 dentro de ?authError=... */
async function checkAuthEndpoint(id) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', id);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', 'check');

  const res = await fetch(url.toString(), { redirect: 'manual' });
  const location = res.headers.get('location') || '';
  const raw = new URL(location, 'https://accounts.google.com').searchParams.get('authError');
  if (raw) {
    const decoded = Buffer.from(decodeURIComponent(raw), 'base64').toString('utf8');
    const parts = decoded.split(CTRL).map((p) => clean(p)).filter(Boolean);
    return { error: parts[0] || 'desconocido', text: parts[1] || '' };
  }
  /* Sin authError: o Google acepto el cliente y empezo el flujo de inicio de
     sesion, o respondio con una pagina de error (HTTP 4xx) en el cuerpo. */
  const body = await res.text().catch(() => '');
  for (const code of ['redirect_uri_mismatch', 'invalid_client', 'access_denied', 'unauthorized_client']) {
    if (body.includes(code)) return { error: code, text: '' };
  }
  if (res.status >= 400) return { error: `http_${res.status}`, text: '' };
  return { error: null, text: '' };
}

/** El endpoint de token responde invalid_grant si el par (id, secreto) es real */
async function checkTokenEndpoint(id) {
  const body = new URLSearchParams({
    client_id: id,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: 'comprobacion_tecnica_invalida',
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, error: json.error, description: json.error_description };
}

(async () => {
  console.log('\n=== Cliente OAuth de Google ===\n');
  if (!clientId) {
    bad('No hay GOOGLE_CLIENT_ID en BackEnd/.env (ni se paso un ID por argumento).');
    process.exit(1);
  }

  console.log(`  Client ID:    ${clientId}`);
  console.log(`  Redirect URI: ${redirectUri}`);
  console.log(`  Secreto:      ${clientSecret ? `${clientSecret.length} caracteres (oculto)` : 'NO CONFIGURADO'}\n`);

  let fatal = false;

  console.log('1) ¿Existe el cliente en Google Cloud?');
  const auth = await checkAuthEndpoint(clientId);
  if (!auth.error) {
    ok('El cliente existe: Google ha iniciado el flujo de inicio de sesion.');
    warn('El redirect URI solo lo valida Google al final del flujo (al volver de elegir cuenta).');
  } else if (auth.error === 'invalid_client') {
    bad('invalid_client - "The OAuth client was not found".');
    bad('El ID de cliente no existe: fue borrado, el proyecto se elimino o esta mal copiado.');
    fatal = true;
  } else if (auth.error === 'redirect_uri_mismatch') {
    bad('redirect_uri_mismatch - el cliente existe, pero el redirect URI no esta registrado.');
    warn(`Registra en Google Cloud: ${redirectUri}`);
  } else {
    warn(`Google respondio: ${auth.error} - ${auth.text}`);
  }

  console.log('\n2) ¿El secreto guardado corresponde a ese cliente?');
  if (!clientSecret) {
    warn('Sin GOOGLE_CLIENT_SECRET solo funciona One Tap; el flujo OAuth por redireccion fallara.');
  } else {
    const token = await checkTokenEndpoint(clientId);
    if (token.error === 'invalid_grant') {
      ok('El par (client ID + secreto) es valido (Google solo rechaza el codigo de prueba).');
    } else if (token.error === 'invalid_client') {
      bad('invalid_client - Google no reconoce el par (client ID + secreto).');
      bad('O el cliente no existe, o el secreto guardado es de otro cliente.');
      fatal = true;
    } else {
      warn(`Google respondio: ${token.error} ${token.description || ''}`);
    }
  }

  console.log('');
  if (fatal) {
    console.log('  COMO ARREGLARLO\n');
    console.log('  1. Abre https://console.cloud.google.com/apis/credentials');
    console.log('  2. Entra al proyecto 764070463061 (o crea uno nuevo) y revisa si sigue existiendo.');
    console.log('  3. Crea de nuevo: "ID de cliente de OAuth" -> tipo "Aplicacion web".');
    console.log('     - Origenes autorizados de JavaScript: http://localhost:5173');
    console.log(`     - URIs de redireccion autorizadas: ${redirectUri}`);
    console.log('  4. Copia el nuevo ID de cliente y el secreto de cliente.');
    console.log('  5. Ponlos en BackEnd/.env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    console.log('     y en FrontEnd/.env (VITE_GOOGLE_CLIENT_ID).');
    console.log('  6. Reinicia la API (npm run dev) y el frontend (npm run dev).');
    console.log('  7. Vuelve a ejecutar: npm run check:google\n');
    process.exit(1);
  }

  console.log('  TODO CORRECTO: el cliente de Google esta bien configurado.\n');
})().catch((err) => {
  console.error('\n  No se pudo comprobar (sin red?):', err.message, '\n');
  process.exit(2);
});
