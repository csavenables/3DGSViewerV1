export function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const p = -2 * t + 2;
  return 1 - (p * p * p) / 2;
}
