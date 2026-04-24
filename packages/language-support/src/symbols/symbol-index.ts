import type { KickAssemblerSymbol } from './symbol-types.ts';

export class SymbolIndex {
  private readonly byName = new Map<string, KickAssemblerSymbol[]>();
  private readonly allSymbols: KickAssemblerSymbol[] = [];

  indexSymbols(symbols: readonly KickAssemblerSymbol[]): void {
    for (const symbol of symbols) {
      this.allSymbols.push(symbol);

      const entries = this.byName.get(symbol.name) ?? [];
      entries.push(symbol);
      this.byName.set(symbol.name, entries);
    }
  }

  find(name: string): readonly KickAssemblerSymbol[] {
    return this.byName.get(name) ?? [];
  }

  list(): readonly KickAssemblerSymbol[] {
    return this.allSymbols;
  }
}
