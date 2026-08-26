export function applyContribution(
  previousMinor: bigint,
  contributionMinor: bigint,
  targetMinor: bigint,
): { contributed: bigint; complete: boolean } {
  if (contributionMinor <= 0n || targetMinor <= 0n) throw new Error('INVALID_GOAL');
  const contributed = previousMinor + contributionMinor;
  return { contributed, complete: contributed >= targetMinor };
}
