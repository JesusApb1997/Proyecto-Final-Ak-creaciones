export const resetCart = () => {
  try {
    localStorage.removeItem('ak-cart')
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event('ak-cart-reset'))
}