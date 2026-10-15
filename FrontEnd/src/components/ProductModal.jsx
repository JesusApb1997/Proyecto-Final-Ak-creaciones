import { COLORS, COLOR_HEX, money } from '../config.js'

export default function ProductModal({ data, onClose, onColor, onSize, onQty, onAdd }) {
  const p = data.product
  const stock = Number(p.stock)
  const available = Number.isInteger(stock) && stock > 0

  return (
    <div className="modal product-modal show" role="dialog" aria-modal="true" aria-labelledby="pmTitle" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="btn-icon modal-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg"></i>
        </button>
        <div className="pm-media">
          <img src={p.img} alt={p.name} />
        </div>
        <div className="pm-info">
          <p className="kicker">{p.cat}</p>
          <h3 id="pmTitle">{p.name}</h3>
          <p className="pm-price">{money(p.oldPrice ?? p.price)}</p>
          <p className="pm-desc">{p.desc}</p>
          <p className="product-stock-label">{available ? `${stock} unidades disponibles` : 'Producto agotado'}</p>

          <div className="pm-opt">
            <h4>Gancho (acabado metálico)</h4>
            <div className="swatches">
              {(data.colors?.length ? data.colors : COLORS).map((c) => (
                <button
                  key={c}
                  className={`swatch${c === data.color ? ' active' : ''}`}
                  style={{ background: COLOR_HEX[c] }}
                  onClick={() => onColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="pm-opt">
            <h4>Tamaño</h4>
            <div className="sizes">
              {(p.sizes ?? ['Pequeño', 'Mediano', 'Largo']).map((s) => (
                <button key={s} className={`size${s === data.size ? ' active' : ''}`} onClick={() => onSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="pm-opt">
            <h4>Cantidad</h4>
            <div className="qty">
              <button onClick={() => onQty(data.qty - 1)} aria-label="Menos"><i className="bi bi-dash"></i></button>
              <span>{data.qty}</span>
              <button onClick={() => onQty(data.qty + 1)} aria-label="Más" disabled={!available || data.qty >= stock}><i className="bi bi-plus"></i></button>
            </div>
          </div>

          <button className="btn btn-grad btn-block" onClick={onAdd} disabled={!available}>
            <i className={`bi ${available ? 'bi-bag-plus' : 'bi-bag-x'}`}></i> {available ? 'Agregar al carrito' : 'Agotado'}
          </button>
        </div>
      </div>
    </div>
  )
}
