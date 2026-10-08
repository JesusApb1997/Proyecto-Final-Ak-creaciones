import { money, cdn, localFallback } from '../config.js'

export default function ProductCard({ product: p, onOpen, onQuickAdd }) {
  /* Fallback a la copia local de public/ si la imagen no está (aún) en el bucket */
  const onImgError = (e) => {
    const local = localFallback(p.img)
    if (local && e.currentTarget.dataset.fallback !== '1') {
      e.currentTarget.dataset.fallback = '1'
      e.currentTarget.src = local
    }
  }
  const badge =
    p.tag === 'oferta' ? (
      <span className="badge badge-offer">Oferta</span>
    ) : p.tag === 'nuevo' ? (
      <span className="badge badge-new">Nuevo</span>
    ) : null

  return (
    <article
      className="card"
      tabIndex={0}
      role="button"
      aria-label={`Ver detalles de ${p.name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
    >
      <div className="card-media">
        <img src={p.img} alt={p.name} loading="lazy" onError={onImgError} />
        <div className="card-badges">{badge}</div>
        <button
          className="card-quick"
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd()
          }}
        >
          <i className="bi bi-bag-plus"></i> Agregar
        </button>
      </div>
      <div className="card-body">
        <p className="card-cat">{p.cat}</p>
        <h3 className="card-title">{p.name}</h3>
        <p className="card-desc">{p.desc}</p>
        <div className="card-row">
          <span className="price">
            {p.oldPrice && <span className="price-old">{money(p.oldPrice)}</span>}
            {money(p.price)}
          </span>
          <button
            className="add-btn"
            aria-label={`Agregar ${p.name} al carrito`}
            onClick={(e) => {
              e.stopPropagation()
              onQuickAdd()
            }}
          >
            <i className="bi bi-bag-plus"></i>
          </button>
        </div>
      </div>
    </article>
  )
}
