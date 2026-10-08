import { useEffect, useRef, useState } from 'react'
import { authApi } from '../api/auth.js'
import { cdn } from '../config.js'

/* ==========================================================================
   Restablecer contraseña — paso 2: nueva contraseña con el token del correo
   Ruta: #/reset-password?token=...
   ========================================================================== */
export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const passRef = useRef(null)

  /* El token llega en la URL del correo: #/reset-password?token=abc123 */
  useEffect(() => {
    const t = new URLSearchParams(location.hash.split('?')[1] || '').get('token') || ''
    setToken(t)
  }, [])

  useEffect(() => {
    if (token) passRef.current?.focus()
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== repeat) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const data = await authApi.resetPassword(token, password)
      if (data?.success) setDone(true)
      else setError(data?.message || 'No se pudo restablecer la contraseña')
    } catch (err) {
      setError(err?.message || 'No se pudo restablecer la contraseña')
    } finally {
      setLoading(false)
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

        {/* Sin token en la URL: pedir que use el enlace del correo */}
        {!token ? (
          <>
            <p className="kicker">Restablecer contraseña</p>
            <h1 className="login-title">
              Enlace <span className="accent">no válido</span>
            </h1>
            <p className="login-sub">
              Este enlace está incompleto. Abre el enlace completo que te enviamos por correo, o
              solicita uno nuevo.
            </p>
            <a className="btn btn-grad btn-block" href="#/forgot-password" style={{ maxWidth: 420 }}>
              <i className="bi bi-envelope"></i> Solicitar nuevo enlace
            </a>
          </>
        ) : done ? (
          <>
            <p className="kicker">Restablecer contraseña</p>
            <h1 className="login-title">
              ¡Listo, <span className="accent">ya puedes entrar</span>!
            </h1>
            <p className="login-sub">
              Tu contraseña se actualizó correctamente. Inicia sesión con la nueva.
            </p>
            <a className="btn btn-grad btn-block" href="#/login" style={{ maxWidth: 420 }}>
              <i className="bi bi-box-arrow-in-right"></i> Ir al login
            </a>
          </>
        ) : (
          <>
            <p className="kicker">Restablecer contraseña</p>
            <h1 className="login-title">
              Crea tu <span className="accent">nueva contraseña</span>
            </h1>
            <p className="login-sub">Mínimo 4 caracteres. El enlace expira en 30 minutos.</p>

            <form onSubmit={submit} className="login-form">
              <label className="lf-field">
                <span>Nueva contraseña</span>
                <div className="lf-input">
                  <i className="bi bi-lock"></i>
                  <input
                    ref={passRef}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength="4"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </label>

              <label className="lf-field">
                <span>Repetir nueva contraseña</span>
                <div className="lf-input">
                  <i className="bi bi-lock-fill"></i>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength="4"
                    required
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                  />
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
                    <span className="spinner" aria-hidden="true"></span> Guardando…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle"></i> Restablecer contraseña
                  </>
                )}
              </button>

              <a className="login-back" href="#/login">
                <i className="bi bi-arrow-left"></i> Volver al login
              </a>
            </form>
          </>
        )}
      </div>

      <div className="login-aside" aria-hidden="true">
        <img src={cdn('/products/zarcillo-ambar.jpeg')} alt="" />
      </div>
    </div>
  )
}
