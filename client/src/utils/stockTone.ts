// Border/background classes coloured by remaining-stock ratio so the worst
// shortages stand out: red below 1/3 of capacity, amber below 1/2, else neutral.
export function stockCard(remaining: number, max: number): string {
  const ratio = max > 0 ? remaining / max : 0;
  if (ratio < 1 / 3) return 'border-[rgba(255,99,99,0.5)] bg-[rgba(255,80,80,0.12)]';
  if (ratio < 0.5) return 'border-[rgba(255,200,80,0.5)] bg-[rgba(255,200,80,0.11)]';
  return 'border-white/[0.08] bg-white/[0.04]';
}
