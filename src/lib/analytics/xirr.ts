export interface Cashflow {
  date: Date
  amount: number
}

/**
 * Computes XIRR (annualized) from irregular cash flows using Newton–Raphson.
 * Returns annual rate as a decimal (e.g. 0.12 = 12%).
 */
export function xirr(cashflows: Cashflow[], guess = 0.1): number {
  if (cashflows.length < 2) return 0
  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = sorted[0].date.getTime()
  if (t0 === 0) return 0
  const years = sorted.map((cf) => (cf.date.getTime() - t0) / (365.25 * 24 * 60 * 60 * 1000))

  let rate = guess
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0
    let dnpv = 0
    for (let i = 0; i < sorted.length; i++) {
      const p = Math.pow(1 + rate, years[i])
      npv += sorted[i].amount / p
      dnpv += (-years[i] * sorted[i].amount) / (p * (1 + rate))
    }
    if (Math.abs(npv) < 1e-6) return rate
    if (dnpv === 0 || !Number.isFinite(dnpv)) return 0
    const delta = npv / dnpv
    rate -= delta
    if (!Number.isFinite(rate) || rate <= -1) return 0
    if (Math.abs(delta) < 1e-7) break
  }
  return rate
}
