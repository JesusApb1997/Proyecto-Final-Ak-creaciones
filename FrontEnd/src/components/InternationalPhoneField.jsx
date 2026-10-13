import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

export default function InternationalPhoneField({ id, value, onChange, disabled, required }) {
  return (
    <PhoneInput
      id={id}
      className="international-phone"
      defaultCountry="VE"
      international
      countryCallingCodeEditable={false}
      value={value || undefined}
      onChange={(phone) => onChange(phone || '')}
      disabled={disabled}
      required={required}
      inputProps={{ id, autoComplete: 'tel' }}
      countrySelectProps={{ 'aria-label': 'Código de país' }}
      placeholder="Número de teléfono"
    />
  )
}