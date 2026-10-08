import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { session, authApi } from '../api/auth.js'
import './userNavbar.css'

/* ==========================================================================
   UserNavbar — Navbar de usuario reutilizable
   props:
     - user:  { name, lastName|last_name, email, role }  (datos actuales)
     - onUpdated(user): se llama cuando el usuario guarda cambios de datos
     - onLogout():       se llama al cerrar sesión
   Uso:  <UserNavbar user={u} onUpdated={setU} onLogout={salir} />
   ========================================================================== */

const initialsOf = (u) =>
  `${u?.name?.[0] ?? '?'}${(u?.last_name ?? u?.lastName)?.[0] ?? ''}`.toUpperCase()

export default function UserNavbar({ user, onUpdated, onLogout }) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(null) // null | 'data' | 'edit' | 'password'
  const wrapRef = useRef(null)

  /* Cierra el desplegable al hacer clic fuera */
  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const u = {
    name: user?.name ?? '',
    last_name: user?.last_name ?? user?.lastName ?? '',
    email: user?.email ?? '',
    role: user?.role ?? '',
  }

  const logout = () => {
    setOpen(false)
    session.clear()
    onLogout?.()
    location.hash = '#/' // redirige a la página principal
  }

  return (
    <div className={`unav${open ? ' open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="unav-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="dash-avatar">{initialsOf(u)}</span>
        <span className="unav-name">{u.name}</span>
        <i className={`bi bi-chevron-down unav-chev`}></i>
      </button>

      <div className={`unav-menu${open ? ' open' : ''}`} role="menu">
        <div className="unav-head">
          <span className="dash-avatar">{initialsOf(u)}</span>
          <div className="unav-head-info">
            <strong>
              {u.name} {u.last_name}
            </strong>
            <small>{u.email}</small>
            <small style={{ textTransform: 'capitalize' }}>{u.role}</small>
          </div>
        </div>

        <button type="button" className="unav-item" role="menuitem" style={{ '--i': 0 }}
          onClick={() => { setOpen(false); setModal('data') }}>
          <i className="bi bi-person"></i> Ver mis datos
        </button>

        <button type="button" className="unav-item" role="menuitem" style={{ '--i': 1 }}
          onClick={() => { setOpen(false); setModal('edit') }}>
          <i className="bi bi-pencil-square"></i> Modificar mis datos
        </button>

        <button type="button" className="unav-item" role="menuitem" style={{ '--i': 2 }}
          onClick={() => { setOpen(false); setModal('password') }}>
          <i className="bi bi-key"></i> Cambiar contraseña
        </button>

        <div className="unav-sep"></div>

        <button type="button" className="unav-item danger" role="menuitem" style={{ '--i': 3 }} onClick={logout}>
          <i className="bi bi-box-arrow-right"></i> Salir
        </button>
      </div>

      {/* ================= Modales =================
          Se renderizan con un portal en <body> para que el modal
          quede centrado en TODA la pantalla y el fondo semiopaco
          cubra todo el viewport (aunque un ancestro tenga
          backdrop-filter, como la barra del dashboard). */}
      {modal === 'data' && createPortal(
        <DataModal user={u} onClose={() => setModal(null)} />,
        document.body
      )}
      {modal === 'edit' && createPortal(
        <EditModal
          user={u}
          onClose={() => setModal(null)}
          onSaved={(updated) => { setModal(null); onUpdated?.(updated) }}
        />,
        document.body
      )}
      {modal === 'password' && createPortal(
        <PasswordModal onClose={() => setModal(null)} />,
        document.body
      )}
    </div>
  )
}

/* ================= Ver mis datos ================= */
function DataModal({ user, onClose }) {
  return (
    <div className="modal admin-modal unav-modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Mi cuenta</p>
        <h3>Mis datos</h3>

        <dl className="unav-current">
          <div style={{ '--i': 0 }}><dt>Nombre</dt><dd>{user.name} {user.last_name}</dd></div>
          <div style={{ '--i': 1 }}><dt>Correo</dt><dd>{user.email}</dd></div>
          <div style={{ '--i': 2 }}><dt>Rol</dt><dd style={{ textTransform: 'capitalize' }}>{user.role}</dd></div>
        </dl>

        <button className="btn btn-ghost btn-block" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

/* ================= Modificar mis datos ================= */
function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: user.name, last_name: user.last_name, email: user.email })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const data = await authApi.updateMe(form) // PUT /api/auth/me (valida el token)
      if (data?.success) {
        session.save({
          token: session.get()?.token, // conserva el token actual
          user: data.data,              // datos nuevos en localStorage
        })
        onSaved(data.data)
      } else {
        setError(data?.message ?? 'No se pudo actualizar')
        setSaving(false)
      }
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar')
      setSaving(false)
    }
  }

  return (
    <div className="modal admin-modal unav-modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Mi cuenta</p>
        <h3>Modificar mis datos</h3>

        <form className="product-form" onSubmit={submit}>
          <div className="ff">
            <label>Nombre</label>
            <input required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="ff">
            <label>Apellido</label>
            <input value={form.last_name ?? ''}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <div className="ff">
            <label>Correo electrónico</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {error && (
            <p className="login-error" role="alert">
              <i className="bi bi-exclamation-circle"></i> {error}
            </p>
          )}

          <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ================= Cambiar contraseña ================= */
function PasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.next !== form.repeat) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }
    setSaving(true)
    try {
      const data = await authApi.changePassword(form.current, form.next) // PUT /api/auth/password
      if (data?.success) {
        setOk(true)
        setTimeout(onClose, 1400)
      } else {
        setError(data?.message ?? 'No se pudo cambiar la contraseña')
      }
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal admin-modal unav-modal show" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <p className="kicker">Mi cuenta</p>
        <h3>Cambiar contraseña</h3>

        {ok ? (
          <>
            <p className="admin-note">
              <i className="bi bi-check-circle" style={{ color: 'var(--turq)' }}></i>{' '}
              Contraseña actualizada correctamente ✓
            </p>
            <button className="btn btn-grad btn-block" onClick={onClose}>Listo</button>
          </>
        ) : (
          <form className="product-form" onSubmit={submit}>
            <div className="ff">
              <label>Contraseña actual</label>
              <input type="password" required autoComplete="current-password" value={form.current}
                onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </div>
            <div className="ff">
              <label>Nueva contraseña (mín. 4 caracteres)</label>
              <input type="password" required minLength="4" autoComplete="new-password" value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })} />
            </div>
            <div className="ff">
              <label>Repetir nueva contraseña</label>
              <input type="password" required autoComplete="new-password" value={form.repeat}
                onChange={(e) => setForm({ ...form, repeat: e.target.value })} />
            </div>

            {error && (
              <p className="login-error" role="alert">
                <i className="bi bi-exclamation-circle"></i> {error}
              </p>
            )}

            <button type="submit" className="btn btn-grad btn-block" disabled={saving}>
              {saving ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
