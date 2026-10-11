/* ==========================================================================
   src/login/ForgotPasswordPage.jsx — Recuperar contraseña del cliente (#/forgot-password)
   El cliente escribe su correo; el backend envía por correo el enlace de reset
   (token SHA-256 guardado en BD, expira en 30 min). Respuesta idéntica siempre
   para no confirmar si el email existe.
   ========================================================================== */
import { useState } from 'react'
import { cdn } from '../config.js'
import { storeAuthApi } from '../api/storeAuth.js'

export default function ForgotPasswordPage({ onBack }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Escribe tu correo electrónico')
      return
    }
    setLoading(true)
    try {
      const data = await storeAuthApi.forgotPassword(email)
      if (data?.success) {
        setInfo(`Si ${email} está registrado, acabas de recibir un enlace para crear una nueva contraseña. Revisa tu casilla (y spam).`)
      } else {
        setError(data?.message || 'No se pudo enviar el enlace')
      }
    } catch (err) {
      setError(err?.message || 'No pudimos conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="store-login-page">
      <div className="store-login-card">
        <div className="store-login-logo">
          <img src={cdn('/assets/brand/logo-ak.png')} alt="Logo AK Creaciones" />
          <span className="brand-name">
            AK <em>Creaciones</em>
          </span>
        </div>

        <p className="store-kicker">Recuperar contraseña</p>
        <h1 className="store-login-title">
          <span className="accent">Restablece</span> tu contraseña
        </h1>
        <p className="store-login-sub">
          Escribe el correo que usaste al registrarte y te enviamos un enlace para crear una nueva.
        </p>

        <form className="store-form" onSubmit={submit}>
          <label className="store-field">
            <span>Correo electrónico</span>
            <div className="store-input">
              <i className="bi bi-envelope"></i>
              <input
                type="email"
                placeholder="tucorreo@gmail.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
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
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="store-spinner"></span> Enviando…
              </>
            ) : (
              <>
                <i className="bi bi-envelope"></i> Enviar enlace
              </>
            )}
          </button>
        </form>

        <a
          className="store-back"
          href="#/acceder"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault()
              onBack()
            } else {
              window.location.hash = '#/acceder'
            }
          }}
        >
          <i className="bi bi-arrow-left"></i> Volver al inicio de sesión
        </a>
      </div>
    </div>
  )
}
