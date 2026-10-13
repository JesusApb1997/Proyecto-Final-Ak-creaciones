import { lazy, Suspense } from 'react'

const InternationalPhoneField = lazy(() => import('./InternationalPhoneField.jsx'))

export function isValidInternationalPhone(value) {
  const normalized = String(value || '').replace(/[^\d+]/g, '')
  return /^\+[1-9]\d{7,14}$/.test(normalized)
}

export default function InternationalPhoneInput({ id, value, onChange, disabled = false, required = false }) {
  return (
    <Suspense fallback={<div className="international-phone-loading" aria-hidden="true" />}>
      <InternationalPhoneField
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      />
    </Suspense>
  )
}