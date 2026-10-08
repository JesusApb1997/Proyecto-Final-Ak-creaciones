/* ==========================================================================
   src/login/StoreLoginPage.jsx — Login público de clientes (#/acceder)
   Registro e inicio de sesión con email · Google · Apple.
   Al entrar, el usuario queda guardado en la BD de Supabase (vía backend) y
   en localStorage quedan: usuario, contraseña (cifrada) y token de sesión.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { storeAuthApi, storeSession, storeRemember } from '../api/storeAuth.js'
import { cdn } from '../config.js'
import { GoogleLogo, AppleLogo, googleCredential, appleSignInToken, isAppleCancel } from './socialAuth.jsx'
import './storeLogin.css'

export default function StoreLoginPage({ onSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false) // flujo email
  const [social, setSocial] = useState('') // 'google' | 'apple' | ''
  const [showPass, setShowPass] = useState(false)

  /* Credenciales recordadas: acceso con un toque en la próxima visita */
  const [remembered, setRemembered] = useState(null)
  useEffect(() => {
    storeRemember.load().then(setRemembered)
  }, [])

  const finish = (data, { socialLogin = false, email, password } = {}) => {
    // Guarda usuario + contraseña cifrada + token para la próxima visita
    if (socialLogin) storeRemember.saveSocial(data.user, data.token)
    else storeRemember.save(email ?? form.email?.trim(), password ?? form.password, data.user, data.token)
    onSuccess?.(data)
  }

  /* ================= Acceso rápido (usuario recordado) ================= */
  const quickLogin = async () => {
    if (!remembered) return
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (remembered.password) {
        /* Cuenta por correo: revalida email+password contra la BD y refresca el token */
        const data = await storeAuthApi.login(remembered.email, remembered.password)
        finish(data, { email: remembered.email, password: remembered.password })
      } else {
        /* Cuenta social: valida el token guardado contra la API */
        if (!storeSession.get()?.token && remembered.token) {
          storeSession.save({ token: remembered.token, user: remembered.user })
        }
        const me = await storeAuthApi.me()
        const user = me?.data ?? remembered.user
        const token = storeSession.get()?.token ?? remembered.token
        storeSession.save({ token, user })
        finish({ token, user }, { socialLogin: true })
      }
    } catch (err) {
      storeRemember.clear()
      setRemembered(null)
      setError('Tu sesión guardada expiró. Vuelve a iniciar sesión.')
      console.warn('[storeAuth]', err?.message)
    } finally {
      setLoading(false)
    }
  }

  /* ================= Email: login / registro ================= */
  const submitEmail = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const email = form.email.trim()
      const data =
        mode === 'register'
          ? await storeAuthApi.register({
              name: form.name.trim(),
              username: form.username.trim(),
              email,
              password: form.password,
            })
          : await storeAuthApi.login(email, form.password)
      finish(data)
    } catch (err) {
      setError(
        !err?.response
          ? 'No pudimos conectar con el servidor — verifica que la API esté corriendo'
          : err?.message || 'No se pudo completar la operación'
      )
    } finally {
      setLoading(false)
    }
  }

  /* ================= Google (One Tap oficial + respaldo OAuth) ================= */
  const loginWithGoogle = async () => {
    setError('')
    setInfo('')
    setSocial('google')
    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      const credential = await googleCredential(clientId)
      const result = await storeAuthApi.google({ credential })
      finish(result, { socialLogin: true })
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesión con Google')
    } finally {
      setSocial('')
    }
  }

  /* ================= Apple (popup oficial de Sign in with Apple) ================= */
  const loginWithApple = async () => {
    setError('')
    setInfo('')
    setSocial('apple')
    try {
      const clientId = import.meta.env.VITE_APPLE_CLIENT_ID
      if (!clientId) {
        throw new Error('Apple Sign-In no está configurado todavía (VITE_APPLE_CLIENT_ID)')
      }
      /* Con usePopup, Apple entrega { idToken, user? } (el nombre solo la 1ª vez) */
      const { idToken, user } = await appleSignInToken(clientId)
      const result = await storeAuthApi.apple({ id_token: idToken, user })
      finish(result, { socialLogin: true })
    } catch (err) {
      /* El usuario cerró la ventana de Apple: no es un error real */
      if (!isAppleCancel(err)) {
        setError(err?.message || 'No se pudo iniciar sesión con Apple')
      }
    } finally {
      setSocial('')
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="store-login-page">
      <div className="store-login-card">
        <div className="store-login-logo">
          <img src={cdn('/assets/brand/logo-ak.png')} alt="Logo AK Creaciones" />
          <span className="brand-name">
            AK <em>Creaciones</em>
          </span>
        </div>

        <p className="store-kicker">Tienda AK Creaciones</p>
        <h1 className="store-login-title">
          {isLogin ? (
            <>Bienvenida de <span className="accent">nuevo</span></>
          ) : (
            <>Crea tu <span className="accent">cuenta</span></>
          )}
        </h1>
        <p className="store-login-sub">
          {isLogin
            ? 'Accede con tu usuario, correo, Google o Apple'
            : 'Crea tu cuenta con usuario y contraseña propios, o entra con Google/Apple'}
        </p>

        {/* ===== Acceso rápido con el usuario recordado ===== */}
        {remembered && (
          <button type="button" className="store-quick" onClick={quickLogin} disabled={loading || !!social}>
            <span className="bolt"><i className="bi bi-lightning-charge-fill"></i></span>
            <span className="who">
              Continuar como {remembered.user?.name || remembered.email}
              <small>{remembered.email}</small>
            </span>
            {loading ? <span className="store-spinner"></span> : <i className="bi bi-arrow-right"></i>}
          </button>
        )}

        {/* ===== Botones sociales ===== */}
        <div className="store-social">
          <button
            type="button"
            className="store-social-btn google"
            onClick={loginWithGoogle}
            disabled={loading || !!social}
          >
            <GoogleLogo />
            {social === 'google' ? <span className="store-spinner"></span> : 'Continuar con Google'}
          </button>

          <button
            type="button"
            className="store-social-btn apple"
            onClick={loginWithApple}
            disabled={loading || !!social}
          >
            <AppleLogo />
            {social === 'apple' ? <span className="store-spinner"></span> : 'Continuar con Apple'}
          </button>
        </div>

        <div className="store-divider">o con tu correo</div>

        {/* ===== Formulario email ===== */}
        <form className="store-form" onSubmit={submitEmail}>
          {!isLogin && (
            <>
              <label className="store-field">
                <span>Nombre</span>
                <div className="store-input">
                  <i className="bi bi-person"></i>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </label>

              <label className="store-field">
                <span>Nombre de usuario (único, sin espacios)</span>
                <div className="store-input">
                  <span className="store-at">@</span>
                  <input
                    type="text"
                    placeholder="p.ej. maria.gomez"
                    autoComplete="username"
                    minLength={3}
                    maxLength={24}
                    pattern="[a-zA-Z0-9._-]{3,24}"
                    title="3 a 24 caracteres: letras, números, punto, guion o guion bajo (sin espacios ni tildes)"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </label>
            </>
          )}

          <label className="store-field">
            <span>{isLogin ? 'Correo o nombre de usuario' : 'Correo electrónico'}</span>
            <div className="store-input">
              <i className={`bi ${isLogin ? 'bi-person-badge' : 'bi-envelope'}`}></i>
              <input
                type={isLogin ? 'text' : 'email'}
                placeholder={isLogin ? 'tucorreo@gmail.com o tu-usuario' : 'tucorreo@gmail.com'}
                autoComplete="username"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </label>

          <label className="store-field">
            <span>Contraseña {!isLogin && '(mín. 4 caracteres)'}</span>
            <div className="store-input">
              <i className="bi bi-lock"></i>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={!isLogin ? 4 : undefined}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="store-pass-toggle"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </label>

          {error && (
            <p className="store-error" role="alert">
              <i className="bi bi-exclamation-circle"></i> {error}
            </p>
          )}
          {info && (
            <p className="store-info">
              <i className="bi bi-info-circle"></i> {info}
            </p>
          )}

          <button
            type="submit"
            className="store-social-btn store-submit"
            disabled={loading || !!social}
          >
            {loading ? (
              <>
                <span className="store-spinner"></span> {isLogin ? 'Entrando…' : 'Creando cuenta…'}
              </>
            ) : isLogin ? (
              <>
                <i className="bi bi-box-arrow-in-right"></i> Iniciar sesión
              </>
            ) : (
              <>
                <i className="bi bi-person-plus"></i> Crear mi cuenta
              </>
            )}
          </button>
        </form>

        <p className="store-switch">
          {isLogin ? (
            <>¿Primera vez aquí?
              <button type="button" onClick={() => { setMode('register'); setError(''); setInfo('') }}>
                Crear una cuenta
              </button>
            </>
          ) : (
            <>¿Ya tienes cuenta?
              <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }}>
                Inicia sesión
              </button>
            </>
          )}
        </p>

        <a className="store-back" href="#/">
          <i className="bi bi-arrow-left"></i> Volver a la tienda
        </a>
      </div>
    </div>
  )
}
