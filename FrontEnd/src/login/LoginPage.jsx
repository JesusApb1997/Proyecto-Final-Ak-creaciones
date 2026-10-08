import { useEffect, useRef, useState } from 'react'
import { authApi } from '../api/auth.js'
import { storeAuthApi, storeRemember } from '../api/storeAuth.js'
import { cdn } from '../config.js'
import { GoogleLogo, AppleLogo, googleCredential, appleSignInToken, isAppleCancel } from './socialAuth.jsx'
import './storeLogin.css'

const initials = (u) => `${u?.name?.[0] ?? '?'}${u?.last_name?.[0] ?? ''}`.toUpperCase()

/* ===== Usuario recordado (2ª visita entra con un clic) =====
   Tras un login exitoso se guarda en localStorage (clave 'ak-remembered'):
   { email, name, last_name, role, token } — el token es el mismo JWT de la
   sesión, que el backend emite con el rol dentro; al reingresar directo se
   revalida con authApi.me(). Las 3 piezas pedidas quedan en localStorage:
   usuario (email), contraseña y token de confirmación de rol. */
const REMEMBER_KEY = 'ak-remembered'

const loadRemembered = () => {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return null
    const r = JSON.parse(raw)
    return r?.email && r?.password ? r : null
  } catch {
    return null
  }
}

const rememberUser = (email, password, user, token) => {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({
      email,
      password,
      name: user?.name ?? '',
      last_name: user?.last_name ?? user?.lastName ?? '',
      role: user?.role ?? '',
      token,
    }))
  } catch {
    /* localStorage lleno o no disponible */
  }
}

const forgetRemembered = () => {
  try { localStorage.removeItem(REMEMBER_KEY) } catch { /* noop */ }
}

export default function LoginPage({ onSuccess, onCustomerAuth }) {
  /* Paso 1: elegir usuario · Paso 2: contraseña del usuario elegido */
  const [step, setStep] = useState('choose')
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [manual, setManual] = useState(false) // escribir un correo que no está en la lista
  const [selected, setSelected] = useState(null) // { name, last_name, email, role }
  const [ddOpen, setDdOpen] = useState(false) // menú desplegable de usuarios
  const ddRef = useRef(null)

  const [manualEmail, setManualEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const passRef = useRef(null)

  /* ===== Opción principal: registro básico de usuario común (rol 'user') =====
     'join'  -> crear cuenta (Google · Apple · correo)
     'staff' -> acceso del personal al panel (flujo original de esta vista) */
  const [view, setView] = useState('join')
  const [joinForm, setJoinForm] = useState({ name: '', email: '', password: '' })
  const [joinError, setJoinError] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [social, setSocial] = useState('') // 'google' | 'apple' | ''
  const [showJoinPass, setShowJoinPass] = useState(false)

  /* Usuario recordado + opción "usar otro usuario" en esta visita */
  const [remembered, setRemembered] = useState(loadRemembered)
  const [ignoreRemembered, setIgnoreRemembered] = useState(false)

  /* Carga las cuentas con acceso al panel (solo las que tienen contraseña) */
  useEffect(() => {
    authApi
      .accounts()
      .then((data) => setAccounts(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setManual(true)) // si la API no responde, login clásico por correo
      .finally(() => setLoadingAccounts(false))
  }, [])

  /* Al pasar al paso 2, enfoca el campo de contraseña */
  useEffect(() => {
    if (step === 'password') passRef.current?.focus()
  }, [step])

  /* Cierra el menú de usuarios al hacer clic fuera de él */
  useEffect(() => {
    if (!ddOpen) return
    const onDoc = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [ddOpen])

  const pickUser = (u) => {
    /* ===== Acceso directo del usuario recordado =====
       Si elige el usuario guardado y coincide el correo, entra sin escribir
       la contraseña (el token de rol guardado viaja a la API en cada llamada
       y el backend revalida; si expiró, el interceptor manda al paso normal). */
    const mem = remembered
    if (mem && !ignoreRemembered && String(u.email).toLowerCase() === String(mem.email).toLowerCase()) {
      setError('')
      setLoading(true)
      authApi
        .login(mem.email, mem.password) /* revalida contra la BD y refresca el token */
        .then((data) => {
          /* Refresca el token guardado por si lo rotaron */
          if (data?.token) rememberUser(mem.email, mem.password, data.user, data.token)
          onSuccess?.(data.user)
        })
        .catch(() => {
          /* Credenciales guardadas ya no válidas: caer al paso de contraseña */
          forgetRemembered()
          setRemembered(null)
          setSelected(u)
          setPassword('')
          setStep('password')
        })
        .finally(() => setLoading(false))
      return
    }
    setSelected(u)
    setPassword('')
    setError('')
    setDdOpen(false)
    setStep('password')
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const email = selected ? selected.email : manualEmail
      const data = await authApi.login(String(email).trim(), password)
      /* Recuerda usuario+contraseña+token para el acceso directo la próxima vez */
      if (data?.token && data?.user) rememberUser(String(email).trim(), password, data.user, data.token)
      onSuccess?.(data.user)
    } catch (err) {
      setError(err?.message || 'No pudimos conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const backToChoose = () => {
    setStep('choose')
    setSelected(null)
    setPassword('')
    setError('')
  }

  /* ============ Registro básico de usuario común (rol 'user') ============
     El rol lo decide el backend (/api/store-auth/register): una cuenta común
     nunca recibe permisos de panel. Al terminar, la sesión queda como cliente
     de la tienda (storeSession) y App.jsx lleva a la tienda con onCustomerAuth. */
  const enterStore = (data, { socialLogin = false, email, password } = {}) => {
    if (socialLogin) storeRemember.saveSocial(data.user, data.token)
    else storeRemember.save(email ?? joinForm.email.trim(), password ?? joinForm.password, data.user, data.token)
    onCustomerAuth?.()
  }

  const submitJoin = async (e) => {
    e.preventDefault()
    setJoinError('')
    setJoinBusy(true)
    try {
      const email = joinForm.email.trim()
      const data = await storeAuthApi.register({
        name: joinForm.name.trim(),
        email,
        password: joinForm.password,
      })
      enterStore(data, { email, password: joinForm.password })
    } catch (err) {
      setJoinError(
        !err?.response
          ? 'No pudimos conectar con el servidor — verifica que la API esté corriendo'
          : err?.message || 'No se pudo crear la cuenta'
      )
    } finally {
      setJoinBusy(false)
    }
  }

  const joinWithGoogle = async () => {
    setJoinError('')
    setSocial('google')
    try {
      const credential = await googleCredential(import.meta.env.VITE_GOOGLE_CLIENT_ID)
      const data = await storeAuthApi.google({ credential })
      enterStore(data, { socialLogin: true })
    } catch (err) {
      setJoinError(err?.message || 'No se pudo continuar con Google')
    } finally {
      setSocial('')
    }
  }

  const joinWithApple = async () => {
    setJoinError('')
    setSocial('apple')
    try {
      const clientId = import.meta.env.VITE_APPLE_CLIENT_ID
      if (!clientId) {
        throw new Error('Apple Sign-In no está configurado todavía (VITE_APPLE_CLIENT_ID)')
      }
      const { idToken, user } = await appleSignInToken(clientId)
      const data = await storeAuthApi.apple({ id_token: idToken, user })
      enterStore(data, { socialLogin: true })
    } catch (err) {
      if (!isAppleCancel(err)) setJoinError(err?.message || 'No se pudo continuar con Apple')
    } finally {
      setSocial('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={cdn('/assets/brand/logo-ak.png')} alt="Logo AK Creaciones" />
          <span className="brand-name">
            AK <em>Creaciones</em>
          </span>
        </div>

        {/* ========= OPCIÓN PRINCIPAL: registro de usuario común ========= */}
        {view === 'join' && (
          <>
            <p className="kicker">Únete a AK Creaciones</p>
            <h1 className="login-title">
              Crea tu <span className="accent">cuenta</span>
            </h1>
            <p className="login-sub">Registro básico de usuario — con Google, Apple o tu correo</p>

            {/* ===== Botones sociales ===== */}
            <div className="store-social">
              <button
                type="button"
                className="store-social-btn google"
                onClick={joinWithGoogle}
                disabled={joinBusy || !!social}
              >
                <GoogleLogo />
                {social === 'google' ? <span className="store-spinner"></span> : 'Continuar con Google'}
              </button>
              <button
                type="button"
                className="store-social-btn apple"
                onClick={joinWithApple}
                disabled={joinBusy || !!social}
              >
                <AppleLogo />
                {social === 'apple' ? <span className="store-spinner"></span> : 'Continuar con Apple'}
              </button>
            </div>

            <div className="store-divider">o regístrate con tu correo</div>

            {/* ===== Formulario básico: nombre · correo · contraseña ===== */}
            <form className="store-form" onSubmit={submitJoin}>
              <label className="store-field">
                <span>Nombre</span>
                <div className="store-input">
                  <i className="bi bi-person"></i>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    autoComplete="name"
                    required
                    value={joinForm.name}
                    onChange={(e) => setJoinForm({ ...joinForm, name: e.target.value })}
                  />
                </div>
              </label>

              <label className="store-field">
                <span>Correo electrónico</span>
                <div className="store-input">
                  <i className="bi bi-envelope"></i>
                  <input
                    type="email"
                    placeholder="tucorreo@gmail.com"
                    autoComplete="email"
                    required
                    value={joinForm.email}
                    onChange={(e) => setJoinForm({ ...joinForm, email: e.target.value })}
                  />
                </div>
              </label>

              <label className="store-field">
                <span>Contraseña (mín. 4 caracteres)</span>
                <div className="store-input">
                  <i className="bi bi-lock"></i>
                  <input
                    type={showJoinPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={4}
                    required
                    value={joinForm.password}
                    onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="store-pass-toggle"
                    onClick={() => setShowJoinPass(!showJoinPass)}
                    aria-label={showJoinPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <i className={`bi ${showJoinPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </label>

              {joinError && (
                <p className="store-error" role="alert">
                  <i className="bi bi-exclamation-circle"></i> {joinError}
                </p>
              )}

              <button
                type="submit"
                className="store-social-btn store-submit"
                disabled={joinBusy || !!social}
              >
                {joinBusy ? (
                  <><span className="store-spinner"></span> Creando tu cuenta…</>
                ) : (
                  <><i className="bi bi-person-plus"></i> Crear mi cuenta</>
                )}
              </button>
            </form>

            <p className="store-switch">
              ¿Eres del personal?
              <button type="button" onClick={() => { setView('staff'); setJoinError('') }}>
                Entra al panel
              </button>
            </p>
          </>
        )}

        {/* ========= Acceso del personal (secundario) ========= */}
        {view === 'staff' && (
          <>
        {/* ================= PASO 1: elegir usuario ================= */}
        {step === 'choose' && (
          <>
            <p className="kicker">Panel de administración</p>
            <h1 className="login-title">
              ¿Quién <span className="accent">eres</span>?
            </h1>
            <p className="login-sub">Elige tu usuario para acceder al panel</p>

            {loadingAccounts && (
              <p className="login-loading">
                <span className="spinner"></span> Cargando usuarios…
              </p>
            )}

            {!loadingAccounts && !manual && (
              <div className={`acct-dd${ddOpen ? ' open' : ''}`} ref={ddRef}>
                <button
                  type="button"
                  className="acct-dd-btn"
                  aria-haspopup="listbox"
                  aria-expanded={ddOpen}
                  onClick={() => setDdOpen((v) => !v)}
                >
                  <span className="dash-avatar" aria-hidden="true">
                    <i className="bi bi-person-lines-fill"></i>
                  </span>
                  <span className="acct-hint">
                    <strong>Selecciona tu usuario</strong>
                    <small>
                      {accounts.length
                        ? `${accounts.length} cuentas con acceso al panel`
                        : 'No hay usuarios con acceso registrados'}
                    </small>
                  </span>
                  <i className="bi bi-chevron-down chev"></i>
                </button>

                <div className="acct-dd-panel" role="listbox" aria-label="Usuarios del panel">
                  <p className="acct-dd-label">Elige tu cuenta</p>
                  {accounts.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      aria-selected={selected?.id === u.id}
                      className="acct-opt"
                      onClick={() => pickUser(u)}
                    >
                      <span className="dash-avatar dash-avatar-sm">{initials(u)}</span>
                      <span className="account-info">
                        <strong>
                          {u.name} {u.last_name ?? ''}
                        </strong>
                        <small>{u.email}</small>
                      </span>
                      <span className="acct-pills">
                        <span className={`dash-pill${u.role === 'admin' ? ' admin' : ''}`}>
                          {u.role === 'admin' ? 'Admin' : 'Empleado'}
                        </span>
                        {remembered && !ignoreRemembered && String(u.email).toLowerCase() === String(remembered.email).toLowerCase() && (
                          <span className="dash-pill remembered-pill" title="Entrar sin escribir la contraseña">
                            <i className="bi bi-lightning-charge-fill"></i> <span className="rp-txt">Acceso directo</span>
                          </span>
                        )}
                      </span>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  ))}

                  {accounts.length === 0 && (
                    <p className="login-loading" style={{ padding: '.4rem .7rem' }}>
                      Verifica la base de datos o usa otro correo.
                    </p>
                  )}

                  {remembered && !ignoreRemembered && (
                    <button
                      type="button"
                      className="acct-dd-manual"
                      onClick={() => {
                        forgetRemembered()
                        setRemembered(null)
                      }}
                    >
                      <i className="bi bi-person-slash"></i> Iniciar con otro usuario (borrar acceso directo)
                    </button>
                  )}
                  <button type="button" className="acct-dd-manual" onClick={() => setManual(true)}>
                    <i className="bi bi-pencil"></i> Usar otro correo
                  </button>
                </div>
              </div>
            )}

            {manual && (
              <form onSubmit={(e) => { e.preventDefault(); pickUser({ email: manualEmail, name: manualEmail.split('@')[0] }) }} className="login-form">
                <label className="lf-field">
                  <span>Correo electrónico</span>
                  <div className="lf-input">
                    <i className="bi bi-envelope"></i>
                    <input
                      type="email"
                      placeholder="tucorreo@gmail.com"
                      autoComplete="email"
                      required
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                    />
                  </div>
                </label>
                <button type="submit" className="btn btn-grad btn-block">
                  Continuar <i className="bi bi-arrow-right"></i>
                </button>
                <button type="button" className="login-back" onClick={() => setManual(false)}>
                  <i className="bi bi-arrow-left"></i> Volver a la lista de usuarios
                </button>
              </form>
            )}
          </>
        )}

        {/* ================= PASO 2: contraseña ================= */}
        {step === 'password' && (
          <>
            <p className="kicker">Panel de administración</p>
            <h1 className="login-title">
              ¡Hola, <span className="accent">{selected?.name}!</span>
            </h1>
            <p className="login-sub">
              {selected?.email}
              {selected?.role === 'admin' ? ' · Administradora' : ' · Empleado'}
            </p>

            <form onSubmit={submitPassword} className="login-form">
              <label className="lf-field">
                <span>Contraseña de {selected?.name}</span>
                <div className="lf-input">
                  <i className="bi bi-lock"></i>
                  <input
                    ref={passRef}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="lf-eye"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </label>

              {error && (
                <p className="login-error" role="alert">
                  <i className="bi bi-exclamation-circle"></i> {error}
                </p>
              )}

              <button type="submit" className="btn btn-grad btn-block" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span> Verificando…
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right"></i> Iniciar sesión
                  </>
                )}
              </button>

              <a className="login-back" href="#/forgot-password" style={{ marginTop: 0 }}>
                <i className="bi bi-question-circle"></i> ¿Olvidaste tu contraseña?
              </a>

              <button type="button" className="login-back" onClick={backToChoose}>
                <i className="bi bi-arrow-left"></i> No eres tú? Elige otro usuario
              </button>
            </form>
          </>
        )}

            <p className="store-switch">
              ¿Aún no tienes cuenta?
              <button type="button" onClick={() => { setView('join'); backToChoose() }}>
                Regístrate como usuario
              </button>
            </p>
          </>
        )}

        <a className="login-back" href="#/">
          <i className="bi bi-arrow-left"></i> Volver a la tienda
        </a>
      </div>

      <div className="login-aside" aria-hidden="true">
        <img src={cdn('/products/zarcillo-fiesta.jpeg')} alt="" />
      </div>
    </div>
  )
}
