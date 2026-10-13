import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { UBICACION } from '../config.js'
import 'leaflet/dist/leaflet.css'
import './deliveryLocationPicker.css'

function MapCenter({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.8 })
  }, [map, position])

  return null
}

function LocationMarker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng])
    },
  })

  return position ? (
    <CircleMarker
      center={position}
      radius={9}
      pathOptions={{ color: '#12718F', fillColor: '#1FA2C7', fillOpacity: 0.85, weight: 3 }}
    />
  ) : null
}

export default function DeliveryLocationPicker({ onSelect, onCancel }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [position, setPosition] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const [searchRequest, setSearchRequestId] = useState(0)
  const searchImmediately = useRef(false)
  const searchRequestId = useRef(0)

  const searchPlaces = (event) => {
    event.preventDefault()
    if (!query.trim()) return
    searchImmediately.current = true
    searchRequestId.current += 1
    setSearchRequestId(searchRequestId.current)
  }

  useEffect(() => {
    const searchText = query.trim()
    setSearchError('')
    setResults([])
    setPosition(null)
    setSearching(false)

    if (searchText.length < 3) return undefined

    const controller = new AbortController()
    const delay = searchImmediately.current ? 0 : 700
    searchImmediately.current = false

    const timeoutId = setTimeout(async () => {
      setSearching(true)

      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          limit: '5',
          'accept-language': 'es',
          q: searchText,
        })
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('El buscador de lugares no está disponible en este momento.')
        }

        const places = await response.json()
        if (!Array.isArray(places)) {
          throw new Error('No se pudo interpretar la respuesta del buscador.')
        }

        const matches = places
          .map((place) => ({
            name: place.display_name,
            position: [Number(place.lat), Number(place.lon)],
          }))
          .filter((place) => place.name && place.position.every(Number.isFinite))

        if (matches.length === 0) {
          setSearchError('No encontramos ese lugar. Prueba con otra ciudad o agrega más detalles.')
          return
        }

        setResults(matches)
        setPosition(matches[0].position)
        setMapCenter(matches[0].position)
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchError(error instanceof Error ? error.message : 'No se pudo buscar el lugar.')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [query, searchRequest])

  const selectPlace = (place) => {
    setPosition(place.position)
    setMapCenter(place.position)
    setSearchError('')
  }

  const confirmLocation = () => {
    if (!position) return
    const [latitude, longitude] = position
    onSelect(`https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`)
  }

  return (
    <div className="delivery-location-picker">
      <form className="delivery-place-search" onSubmit={searchPlaces}>
        <label className="delivery-map-hint" htmlFor="delivery-place-query">
          Busca una ciudad, urbanización o dirección
        </label>
        <div className="delivery-place-search-control">
          <input
            id="delivery-place-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej.: La Castellana, Caracas"
            autoComplete="off"
          />
          <button className="btn btn-grad" type="submit" disabled={searching || !query.trim()}>
            <i className={`bi ${searching ? 'bi-arrow-repeat' : 'bi-search'}`} aria-hidden="true"></i>
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {searchError && <p className="delivery-map-message" role="alert">{searchError}</p>}
        {results.length > 0 && (
          <div className="delivery-place-results" aria-label="Resultados de búsqueda">
            {results.map((place, index) => (
              <button
                key={`${place.name}-${index}`}
                type="button"
                className="delivery-place-result"
                aria-pressed={position?.[0] === place.position[0] && position?.[1] === place.position[1]}
                onClick={() => selectPlace(place)}
              >
                <i className="bi bi-geo-alt" aria-hidden="true"></i>
                <span>{place.name}</span>
              </button>
            ))}
          </div>
        )}
      </form>
      <p className="delivery-map-hint">El mapa se centrará en el lugar elegido. Toca el punto exacto para ajustar la entrega.</p>
      <MapContainer
        center={[UBICACION.lat, UBICACION.lng]}
        zoom={13}
        scrollWheelZoom
        className="delivery-map"
      >
        <MapCenter position={mapCenter} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} onChange={setPosition} />
      </MapContainer>
      <div className="delivery-map-actions">
        <span className="delivery-map-coordinates" aria-live="polite">
          {position
            ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`
            : 'Selecciona un punto en el mapa'}
        </span>
        <div>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-grad" onClick={confirmLocation} disabled={!position}>
            Usar ubicación
          </button>
        </div>
      </div>
    </div>
  )
}
