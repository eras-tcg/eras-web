/** A level as a roman numeral, as printed on the cards (0 when none). */
export function roman(n: number): string {
  const parts: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [value, letters] of parts) while (n >= value) { out += letters; n -= value; }
  return out || '0';
}
