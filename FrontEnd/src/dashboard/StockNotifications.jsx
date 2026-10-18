import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { productsApi } from '../api/client.js'
import { cdn } from '../config.js'
import './stockNotifications.css'

const STORAGE_KEY = 'ak_stock_notifications_v1'

const loadStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { dismissed: {} }
    const parsed = JSON.parse(raw)
    return {
      dismissed: parsed.dismissed || {},
    }
  } catch {
    return { dismissed: {} }
  }
}

const saveStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* localStorage no disponible */
  }
}

const formatTime = (ts) => {
  if (!ts) return ''
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return 'Hace un momento'
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function StockNotifications({ onNavigateToProducts }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [alertToast, setAlertToast] = useState(null) // Banner de aviso de 10s al entrar
  const wrapRef = useRef(null)
  const alertTimerRef = useRef(null)
  const hasTriggeredEntryAlert = useRef(false)

  // Sincroniza productos y genera las alertas para stock <= 3
  const syncStock = async () => {
    try {
      const { data } = await productsApi.getAll()
      const list = Array.isArray(data?.data) ? data.data : []
      const store = loadStorage()
      const dismissed = { ...store.dismissed }

      const alerts = []

      list.forEach((p) => {
        const stock = Number(p.stock ?? 0)

        // Si el stock fue reabastecido (> 3), limpiamos cualquier descarte previo
        if (stock > 3) {
          if (dismissed[p.id]) delete dismissed[p.id]
          return
        }

        // Si stock <= 3: es stock crítico
        const prevDismissed = dismissed[p.id]

        // Si el usuario ya eliminó la notificación para este mismo stock exacto, no la volvemos a mostrar
        // Pero si el stock bajó aún más (ej: de 3 a 1 o a 0), vuelve a alertar
        if (prevDismissed && stock >= prevDismissed.stock) {
          return
        }

        alerts.push({
          id: p.id,
          name: p.name,
          cat: p.cat,
          stock,
          img: p.img ? cdn(p.img) : null,
          detectedAt: prevDismissed?.timestamp || Date.now(),
        })
      })

      saveStorage({ dismissed })
      setNotifications(alerts)

      // Alert de 10 segundos al entrar al dashboard asociado a la notificación si hay bajo stock
      if (!hasTriggeredEntryAlert.current && alerts.length > 0) {
        hasTriggeredEntryAlert.current = true
        setAlertToast({
          items: alerts,
          total: alerts.length,
        })
        clearTimeout(alertTimerRef.current)
        alertTimerRef.current = setTimeout(() => {
          setAlertToast(null)
        }, 10000)
      }
    } catch {
      /* Silencioso en caso de error de red puntual */
    }
  }

  useEffect(() => {
    syncStock()

    // Actualiza ante cambios de productos en el dashboard o al regresar a la pestaña
    const onProductsChanged = () => syncStock()
    const onFocus = () => syncStock()
    window.addEventListener('ak-products-changed', onProductsChanged)
    window.addEventListener('focus', onFocus)

    // Polling cada 35 segundos para detectar ventas o despachos en segundo plano
    const timer = setInterval(syncStock, 35000)

    return () => {
      window.removeEventListener('ak-products-changed', onProductsChanged)
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
      clearTimeout(alertTimerRef.current)
    }
  }, [])

  // Cierra el menú al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Cerrar el alert de 10 segundos manualmente con la X
  const closeAlertToast = () => {
    clearTimeout(alertTimerRef.current)
    setAlertToast(null)
  }

  // Abrir la campana desde el alert
  const openFromAlert = () => {
    clearTimeout(alertTimerRef.current)
    setAlertToast(null)
    setOpen(true)
  }

  // Eliminar una notificación individual al leerse
  const dismissOne = (item, e) => {
    e?.stopPropagation()
    const store = loadStorage()
    const dismissed = {
      ...store.dismissed,
      [item.id]: {
        stock: item.stock,
        timestamp: Date.now(),
      },
    }
    saveStorage({ dismissed })
    setNotifications((prev) => prev.filter((n) => n.id !== item.id))
  }

  // Eliminar todas las notificaciones actuales
  const dismissAll = (e) => {
    e?.stopPropagation()
    const store = loadStorage()
    const dismissed = { ...store.dismissed }
    notifications.forEach((item) => {
      dismissed[item.id] = {
        stock: item.stock,
        timestamp: Date.now(),
      }
    })
    saveStorage({ dismissed })
    setNotifications([])
  }

  const count = notifications.length
  const hasAlerts = count > 0

  return (
    <>
      <div className={`stock-notif-wrap${open ? ' open' : ''}`} ref={wrapRef}>
        <button
          type="button"
          className={`stock-notif-btn${hasAlerts ? ' has-alerts' : ''}`}
          aria-label={`Notificaciones de stock (${count} alertas)`}
          title={hasAlerts ? `${count} productos con stock mínimo (≤ 3)` : 'Notificaciones de stock'}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`bi ${hasAlerts ? 'bi-bell-fill' : 'bi-bell'}`}></i>
          {hasAlerts && <span className="stock-notif-badge">{count > 99 ? '99+' : count}</span>}
        </button>

        <div className="stock-notif-dropdown" role="region" aria-label="Notificaciones de stock">
          <div className="stock-notif-header">
            <div className="stock-notif-header-title">
              <i className="bi bi-bell-fill"></i>
              <span>Alertas de stock</span>
            </div>
            {hasAlerts && (
              <button
                type="button"
                className="stock-notif-clear-all"
                onClick={dismissAll}
                title="Eliminar todas las alertas actuales"
              >
                <i className="bi bi-trash3"></i> Eliminar todas
              </button>
            )}
          </div>

          <p className="stock-notif-sub">
            <i className="bi bi-info-circle"></i>
            <span>Productos con un mínimo de 3 unidades o menos</span>
          </p>

          {hasAlerts ? (
            <ul className="stock-notif-list">
              {notifications.map((n) => {
                const isOut = n.stock <= 0
                const isCrit = n.stock === 1
                const isLow = n.stock > 1 && n.stock <= 3

                return (
                  <li key={n.id} className={`stock-notif-item${isOut ? ' danger-item' : ''}`}>
                    {n.img ? (
                      <img src={n.img} alt={n.name} className="stock-notif-thumb" />
                    ) : (
                      <div className="stock-notif-thumb-placeholder">
                        <i className="bi bi-gem"></i>
                      </div>
                    )}

                    <div className="stock-notif-details">
                      <p className="stock-notif-name" title={n.name}>
                        {n.name}
                      </p>
                      <div className="stock-notif-meta">
                        {isOut && (
                          <span className="stock-chip out">
                            <i className="bi bi-x-circle-fill"></i> ¡Agotado! (0 uds)
                          </span>
                        )}
                        {isCrit && (
                          <span className="stock-chip critical">
                            <i className="bi bi-exclamation-triangle-fill"></i> ¡Solo 1 ud!
                          </span>
                        )}
                        {isLow && (
                          <span className="stock-chip low">
                            <i className="bi bi-exclamation-circle-fill"></i> Quedan {n.stock} uds
                          </span>
                        )}
                        <span className="stock-notif-time">{formatTime(n.detectedAt)}</span>
                      </div>
                    </div>

                    <div className="stock-notif-actions">
                      <a
                        href="#/dashboard/productos"
                        className="stock-notif-go-btn"
                        title="Ver y gestionar producto en catálogo"
                        onClick={() => {
                          setOpen(false)
                          onNavigateToProducts?.(n)
                        }}
                      >
                        <i className="bi bi-box-arrow-up-right"></i>
                      </a>
                      <button
                        type="button"
                        className="stock-notif-del-btn"
                        title="Eliminar notificación al leerse"
                        aria-label={`Eliminar notificación de ${n.name}`}
                        onClick={(e) => dismissOne(n, e)}
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="stock-notif-empty">
              <i className="bi bi-shield-check"></i>
              <p>Todo el stock en orden</p>
              <small>No hay ningún producto con 3 o menos unidades en este momento.</small>
            </div>
          )}
        </div>
      </div>

      {/* Alert flotante de 10 segundos al entrar al dashboard con botón X y barra de progreso */}
      {alertToast &&
        createPortal(
          <div className="stock-alert-toast" role="alert" aria-live="assertive">
            <div className="stock-alert-main">
              <div className="stock-alert-head">
                <div className="stock-alert-title-wrap">
                  <div className="stock-alert-icon">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                  </div>
                  <h4 className="stock-alert-title">
                    Aviso de bajo stock
                    <span className="stock-alert-tag">
                      {alertToast.total} producto{alertToast.total > 1 ? 's' : ''}
                    </span>
                  </h4>
                </div>
                <button
                  type="button"
                  className="stock-alert-close-btn"
                  onClick={closeAlertToast}
                  aria-label="Cerrar aviso"
                  title="Cerrar aviso con la X"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="stock-alert-body">
                <p>
                  Hay <strong>{alertToast.total} producto{alertToast.total > 1 ? 's' : ''}</strong> con existencias
                  críticas (3 unidades o menos):
                </p>
                <div className="stock-alert-products-preview">
                  {alertToast.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="stock-alert-prod-row">
                      <span className="stock-alert-prod-name" title={item.name}>
                        {item.name}
                      </span>
                      <span
                        className={`stock-chip ${
                          item.stock <= 0 ? 'out' : item.stock === 1 ? 'critical' : 'low'
                        }`}
                      >
                        {item.stock <= 0 ? '¡Agotado! (0)' : `Quedan ${item.stock} uds`}
                      </span>
                    </div>
                  ))}
                  {alertToast.total > 3 && (
                    <small style={{ color: 'var(--muted)', fontSize: '.72rem', paddingLeft: '.5rem' }}>
                      + {alertToast.total - 3} producto(s) más en las alertas
                    </small>
                  )}
                </div>
              </div>

              <div className="stock-alert-foot">
                <span className="stock-alert-timer-txt">
                  <i className="bi bi-clock-history"></i> Se cierra en 10s
                </span>
                <button
                  type="button"
                  className="stock-alert-action-btn"
                  onClick={openFromAlert}
                  title="Ver todas las notificaciones asociadas"
                >
                  <i className="bi bi-bell-fill"></i> Ver notificación
                </button>
              </div>
            </div>

            <div className="stock-alert-progress-track">
              <div className="stock-alert-progress-bar"></div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
