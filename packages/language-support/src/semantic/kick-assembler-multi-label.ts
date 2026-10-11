/** A multi-label token includes its homogeneous direction suffix, if present. */
export function multiLabelTokenEnd(text: string, start: number): number {
  const match = /^!(?:[A-Za-z_@][A-Za-z0-9_.@]*)?(?:\++|-+)?/u.exec(text.slice(start));
  return start + (match?.[0].length ?? 0);
}

export function parseMultiLabelReference(text: string): { name: string; direction: 1 | -1; distance: number } | undefined {
  const match = /^(![A-Za-z_@][A-Za-z0-9_.@]*|!)(\++|-+)$/u.exec(text);
  return match ? { name: match[1]!, direction: match[2]![0] === '+' ? 1 : -1, distance: match[2]!.length } : undefined;
}
