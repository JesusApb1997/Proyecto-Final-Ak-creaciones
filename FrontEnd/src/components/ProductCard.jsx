import { money, cdn, localFallback } from '../config.js'

export default function ProductCard({ product: p, onOpen, onQuickAdd }) {
  const stock = Number(p.stock)
  const available = Number.isInteger(stock) && stock > 0
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
          disabled={!available}
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd()
          }}
        >
          <i className={`bi ${available ? 'bi-bag-plus' : 'bi-bag-x'}`}></i> {available ? 'Agregar' : 'Agotado'}
        </button>
      </div>
      <div className="card-body">
        <p className="card-cat">{p.cat}</p>
        <h3 className="card-title">{p.name}</h3>
        <p className="card-desc">{p.desc}</p>
        <small className="product-stock-label">{available ? `${stock} disponibles` : 'Agotado'}</small>
        <div className="card-row">
          <span className="price">
            {p.oldPrice && <span className="price-old">{money(p.oldPrice)}</span>}
            {money(p.price)}
          </span>
          <button
            className="add-btn"
            disabled={!available}
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
