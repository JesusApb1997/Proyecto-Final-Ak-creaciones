import { useEffect, useRef, useState } from 'react'
import { cdn } from '../config.js'

const SLIDES = [
  {
    img: cdn('/img/carousel-01.jpeg'),
    alt: 'Modelo con bisutería artesanal AK Creaciones',
    kicker: 'Nueva colección',
    title: ['AK ', <em key="em">Creaciones</em>],
    text: 'Bisutería artesanal: zarcillos soutache bordados a mano, pieza por pieza, con cristales y mostacillas.',
    cta: 'Ver catálogo',
    filter: null,
  },
  {
    img: cdn('/img/carousel-02.jpeg'),
    alt: 'Modelo luciendo piezas artesanales',
    kicker: 'Zarcillos',
    title: ['Elegancia que se siente'],
    text: 'Diseños delicados que acompañan tu estilo todos los días.',
    cta: 'Ver zarcillos',
    filter: 'zarcillos',
  },
  {
    img: cdn('/img/carousel-03.webp'),
    alt: 'Modelo luciendo un zarcillo de soutache multicolor con cuentas',
    kicker: 'Collares',
    title: ['Capas de brillo'],
    text: 'Combina cadenas finas y colgantes únicos para un look inolvidable.',
    cta: 'Ver collares',
    filter: 'collares',
    focus: '50% 42%',
    align: 'right',
  },
  {
    img: cdn('/img/carousel-04.jpeg'),
    alt: 'Detalle de pulseras y anillos artesanales',
    kicker: 'Pulseras y anillos',
    title: ['Detalles que cuentan'],
    text: 'Piezas versátiles para regalar (o regalarte).',
    cta: 'Ver pulseras',
    filter: 'pulseras',
  },
  {
    img: cdn('/img/carousel-05.jpeg'),
    alt: 'Modelo con accesorios de la colección',
    kicker: 'Sets',
    title: ['Looks completos'],
    text: 'Sets coordinados de zarcillos, collares y pulseras para ocasión especial.',
    cta: 'Ver sets',
    filter: 'sets',
  },
  {
    img: cdn('/img/carousel-06.jpeg'),
    alt: 'Modelo con bisutería en tonos dorados',
    kicker: 'Nuevos ingresos',
    title: ['Lo último del taller'],
    text: 'Piezas recién salidas del taller, bordadas a mano una por una.',
    cta: 'Ver novedades',
    filter: null,
  },
  {
    img: cdn('/img/carousel-07.webp'),
    alt: 'Modelo con zarcillos soutache en un puesto de artesanías',
    kicker: 'Edición limitada',
    title: ['Piezas únicas'],
    text: 'Cada creación es diferente: hecha a mano, pensada para ti.',
    cta: 'Descubrir',
    filter: null,
    focus: '50% 38%',
    align: 'right',
  },
  {
    img: cdn('/img/carousel-08.jpeg'),
    alt: 'Modelo con collar artesanal',
    kicker: 'Hecho a mano',
    title: ['Técnica soutache'],
    text: 'Cristales, mostacillas y cintas bordadas punto por punto sobre tu piel.',
    cta: 'Conocer más',
    filter: null,
  },
  {
    img: cdn('/img/carousel-09.jpeg'),
    alt: 'Modelo con bisutería artesanal de temporada',
    kicker: 'Envíos a todo el mundo',
    title: ['Pídelo hoy'],
    text: 'Escribe por WhatsApp y recibe tu pieza favorita en la puerta de tu casa.',
    cta: 'Escríbenos',
    filter: null,
  },
]

export default function Carousel({ onJump }) {
  const [current, setCurrent] = useState(0)
  const autoTimer = useRef(null)

  const goTo = (i) => setCurrent((i + SLIDES.length) % SLIDES.length)
  const next = () => goTo(current + 1)
  const prev = () => goTo(current - 1)

  const startAuto = () => {
    stopAuto()
    autoTimer.current = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 5000)
  }
  const stopAuto = () => clearInterval(autoTimer.current)

  useEffect(() => {
    startAuto()
    return stopAuto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Swipe táctil */
  const touchX = useRef(null)
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 45) (dx < 0 ? next() : prev())
    touchX.current = null
    startAuto()
  }

  return (
    <section className="hero" aria-label="Destacados">
      <div className="carousel" id="heroCarousel" onMouseEnter={stopAuto} onMouseLeave={startAuto} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="carousel-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {SLIDES.map((s, i) => (
            <article className={`slide${s.align === 'right' ? ' slide-right' : ''}`} key={i}>
              <img src={s.img} alt={s.alt} style={{ objectPosition: s.focus || 'center' }} />
              <div className="slide-content">
                <p className="kicker">{s.kicker}</p>
                {i === 0 ? <h1>{s.title}</h1> : <h2>{s.title}</h2>}
                <p>{s.text}</p>
                {s.filter ? (
                  <a href="#catalogo" className="btn btn-light" onClick={(e) => { e.preventDefault(); onJump(s.filter) }}>
                    {s.cta} <i className="bi bi-arrow-right"></i>
                  </a>
                ) : (
                  <a href="#catalogo" className="btn btn-light">
                    {s.cta} <i className="bi bi-arrow-right"></i>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        <button className="car-btn prev" onClick={() => { prev(); startAuto() }} aria-label="Diapositiva anterior">
          <i className="bi bi-chevron-left"></i>
        </button>
        <button className="car-btn next" onClick={() => { next(); startAuto() }} aria-label="Diapositiva siguiente">
          <i className="bi bi-chevron-right"></i>
        </button>

        <div className="dots" role="tablist" aria-label="Seleccionar diapositiva">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`dot${i === current ? ' active' : ''}`}
              onClick={() => { goTo(i); startAuto() }}
              aria-label={`Diapositiva ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
