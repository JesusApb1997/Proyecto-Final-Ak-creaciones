/* ==========================================================================
   src/login/ResetPasswordPage.jsx — Restablecer contraseña del cliente (#/reset-password)
   Abre desde el enlace del correo: /#/reset-password?token=...  El backend
   valida el token (hash SHA-256), expiración 30 min y no usado. Si venció o el
   token es inválido, responde con el error y este componente lo muestra.
   ========================================================================== */
import { useState, useEffect } from 'react'
import { cdn } from '../config.js'
import { storeAuthApi } from '../api/storeAuth.js'

export default function ResetPasswordPage({ onBack }) {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  /* Extrae el token de la URL y lo reescribe para no dejarlo en el historial */
  useEffect(() => {
    try {
      const search = new URLSearchParams(location.search)
      const t = search.get('token')
      if (t) {
        setToken(t)
        history.replaceState(null, '', `${location.pathname}${location.search}`) // limpia solo query
      } else {
        setError('No se encontró el enlace de recuperación. Usa el botón de abajo para pedir uno nuevo.')
      }
    } catch { /* noop */ }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!password.trim()) {
      setError('Escribe una nueva contraseña')
      return
    }
    if (password !== confirm) {
      setError('La contraseña y la confirmación no coinciden')
      return
    }
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres')
      return
    }
    setLoading(true)
    try {
      const data = await storeAuthApi.resetPassword({ token, password })
      if (data?.success) {
        setInfo('Contraseña actualizada. Ya puedes iniciar sesión con la nueva.')
        /* Navegar al login oficial para que el usuario vea el resultado */
        window.location.hash = '#/acceder'
      } else {
        setError(data?.message || 'No se pudo restablecer la contraseña')
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

        <p className="store-kicker">Nueva contraseña</p>
        <h1 className="store-login-title">
          <span className="accent">Crea</span> una nueva contraseña
        </h1>
        <p className="store-login-sub">
          Elige una contraseña nueva para volver a entrar con tu correo.
        </p>

        <form className="store-form" onSubmit={submit}>
          <label className="store-field">
            <span>Nueva contraseña</span>
            <div className="store-input">
              <i className="bi bi-lock"></i>
              <input
                type={password.length ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={4}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="store-pass-toggle"
                onClick={() => setPassword('')}
                aria-label="Ocultar contraseña"
              >
                <i className="bi bi-eye-slash"></i>
              </button>
            </div>
          </label>

          <label className="store-field">
            <span>Confirmar contraseña</span>
            <div className="store-input">
              <i className="bi bi-lock"></i>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={4}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              <i className="bi bi-check-circle"></i> {info}
            </p>
          )}

          <button
            type="submit"
            className="store-social-btn store-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="store-spinner"></span> Guardando…
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle"></i> Guardar contraseña
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
