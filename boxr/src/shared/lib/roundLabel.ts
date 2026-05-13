export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Финал';
  if (fromEnd === 1) return '1/2';
  if (fromEnd === 2) return '1/4';
  if (fromEnd === 3) return '1/8';
  return `Раунд ${round}`;
}
