export function goalTargetInput(amountMinor: bigint, currency: string): string {
  const fractionDigits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const factor = 10n ** BigInt(fractionDigits);
  const whole = amountMinor / factor;
  if (fractionDigits === 0) return whole.toString();
  const fraction = (amountMinor % factor).toString().padStart(fractionDigits, '0');
  return `${whole}.${fraction}`;
}
