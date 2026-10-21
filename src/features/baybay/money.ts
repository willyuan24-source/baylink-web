/**
 * Dollar amounts on the BayBay plan card (UI9-BB, N06): a thousands separator in every locale ($1,900) and the cents kept
 * wherever the amount has them ($42.50); `cents` always prints two decimals (a sourced $0.00 subtotal). Display only: the
 * amounts come from the api unchanged.
 */
export function bayBayUsd(amount: number, cents = false): string {
  const fraction = cents || !Number.isInteger(amount) ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return `$${amount.toLocaleString('en-US', fraction)}`;
}
