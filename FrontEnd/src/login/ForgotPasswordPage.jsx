import { useState } from 'react'
import { authApi } from '../api/auth.js'
import { cdn } from '../config.js'

/* ==========================================================================
   Recuperar contraseña — paso 1: pedir el enlace por correo
   Ruta: #/forgot-password
   ========================================================================== */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // El backend responde 200 aunque el correo no exista (no revela cuentas)
      await authApi.forgotPassword(String(email).trim())
      setSent(true)
    } catch (err) {
      setError(err?.message || 'No pudimos conectar con el servidor')
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

        {sent ? (
          <>
            <p className="kicker">Recuperar contraseña</p>
            <h1 className="login-title">
              Revisa tu <span className="accent">correo</span>
            </h1>
            <p className="login-sub">
              Si <strong>{email}</strong> está registrado, te enviamos un enlace para restablecer tu
              contraseña. El enlace expira en 30 minutos.
            </p>
            <p className="login-sub" style={{ marginTop: '-1.2rem' }}>
              ¿No lo encuentras? Revisa la carpeta de spam.
            </p>
            <a className="btn btn-grad btn-block" href="#/login" style={{ maxWidth: 420 }}>
              <i className="bi bi-box-arrow-in-right"></i> Volver al login
            </a>
          </>
        ) : (
          <>
            <p className="kicker">Recuperar contraseña</p>
            <h1 className="login-title">
              ¿Olvidaste tu <span className="accent">contraseña</span>?
            </h1>
            <p className="login-sub">
              Escribe tu correo y te enviaremos un enlace para crear una nueva.
            </p>

            <form onSubmit={submit} className="login-form">
              <label className="lf-field">
                <span>Correo electrónico</span>
                <div className="lf-input">
                  <i className="bi bi-envelope"></i>
                  <input
                    type="email"
                    placeholder="tucorreo@gmail.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    <span className="spinner" aria-hidden="true"></span> Enviando…
                  </>
                ) : (
                  <>
                    <i className="bi bi-send"></i> Enviar enlace de recuperación
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
        <img src={cdn('/products/zarcillo-fiesta.jpeg')} alt="" />
      </div>
    </div>
  )
}
