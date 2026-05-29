/**
 * Decimal-safe cost calculation using integer micro-dollar arithmetic.
 *
 * costPer1M values come from the model_catalog as strings (e.g. "3.000000").
 * We multiply everything into micro-dollars (1e-6 USD) as integers, do the
 * math, then format back to a 6-decimal string.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputCostPer1M: string,
  outputCostPer1M: string,
): string {
  const inputMicros = tokenCostMicros(inputTokens, inputCostPer1M)
  const outputMicros = tokenCostMicros(outputTokens, outputCostPer1M)
  const totalMicros = inputMicros + outputMicros
  return microsToDecimalString(totalMicros)
}

function tokenCostMicros(tokens: number, costPer1MStr: string): bigint {
  // costPer1M is dollars per 1M tokens → cost per token = costPer1M / 1_000_000.
  // We want micro-dollars: microCost = tokens * costPer1M_micros / 1_000_000.
  // costPer1M_micros = costPer1M * 1_000_000 (to avoid decimals).
  // So: microCost = tokens * costPer1M_micros / 1_000_000
  //               = tokens * (costPer1M * 1e6) / 1e6
  //               = tokens * costPer1M
  // But costPer1M is a decimal string. Parse to micro-dollars first.
  // Token counts may arrive as undefined/NaN/float when a provider omits usage
  // totals — coerce to a safe non-negative integer so BigInt() never throws.
  const safeTokens = Number.isFinite(tokens) ? Math.trunc(tokens) : 0
  const costMicros = decimalStringToMicros(costPer1MStr)
  return BigInt(safeTokens) * costMicros / 1_000_000n
}

function decimalStringToMicros(value: string): bigint {
  const trimmed = value.trim()
  const negative = trimmed.startsWith('-')
  const unsigned = negative ? trimmed.slice(1) : trimmed
  const [intPart = '0', fracPart = ''] = unsigned.split('.')
  const paddedFrac = fracPart.padEnd(6, '0').slice(0, 6)
  const magnitude = BigInt(intPart || '0') * 1_000_000n + BigInt(paddedFrac || '0')
  return negative ? -magnitude : magnitude
}

function microsToDecimalString(micros: bigint): string {
  const negative = micros < 0n
  const abs = negative ? -micros : micros
  const intPart = abs / 1_000_000n
  const fracPart = abs % 1_000_000n
  const sign = negative ? '-' : ''
  return `${sign}${intPart}.${fracPart.toString().padStart(6, '0')}`
}
