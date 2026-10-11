import { comparePositions, type DocumentPosition } from '../location/source-location.ts';
import type {
  KickAssemblerSemanticModel,
  KickAssemblerSemanticScope,
  KickAssemblerSemanticSymbol
} from './kick-assembler-semantic-model.ts';

/** Structural lexical binding; expansion and import-site context remain caller work. */
export class KickAssemblerScopeResolver {
  private readonly model: KickAssemblerSemanticModel;
  private readonly scopesById: ReadonlyMap<string, KickAssemblerSemanticScope>;
  private readonly scopeKeys = new Map<string, string>();
  private readonly memberScopeDeclarations: ReadonlySet<string>;

  constructor(model: KickAssemblerSemanticModel) {
    this.model = model;
    this.scopesById = new Map(model.scopes.map(scope => [scope.id, scope]));
    this.memberScopeDeclarations = new Set(model.scopes
      .filter(scope => scope.kind === 'block' && scope.name)
      .map(scope => memberScopeKey(scope.parentId ?? '', scope.name!, scope.location.range.start.line)));
  }

  hasMemberScope(symbol: KickAssemblerSemanticSymbol): boolean {
    return this.memberScopeDeclarations.has(memberScopeKey(
      symbol.scopeId, symbol.name, symbol.location.range.start.line
    ));
  }

  declarationKey(symbol: KickAssemblerSemanticSymbol): string {
    if (symbol.name.startsWith('@')) return symbol.name.slice(1);
    const scope = this.scopesById.get(symbol.scopeId)!;
    // Constants/variables are lexical symbols, not fields of Namespace or
    // LabelValue. Reopened namespaces share their associated lexical scope.
    const lexical = symbol.kind === 'constant' || symbol.kind === 'variable' ||
      symbol.kind === 'parameter' || symbol.kind === 'for-variable';
    return joinName(lexical && scope.kind !== 'root' ? this.privateScopeKey(scope) : this.scopeKey(scope), symbol.name);
  }

  resolve(
    position: DocumentPosition,
    name: string,
    hasDeclaration: (key: string) => boolean
  ): string | undefined {
    if (name.startsWith('@')) {
      const rootName = name.slice(1);
      return hasDeclaration(rootName) ? rootName : undefined;
    }
    let scope: KickAssemblerSemanticScope | undefined = this.scopeAt(position);
    while (scope) {
      const prefixes = scope.kind === 'root' ? ['']
        : [this.privateScopeKey(scope), this.scopeKey(scope)];
      for (const prefix of prefixes) {
        const key = joinName(prefix, name);
        if (hasDeclaration(key)) return key;
      }
      // A nearer entity shadows the entire qualified path. Do not jump to an
      // unrelated outer namespace when its member is missing in this scope.
      const separator = name.indexOf('.');
      if (separator >= 0 && prefixes.some(prefix => hasDeclaration(joinName(prefix, name.slice(0, separator))))) {
        return undefined;
      }
      scope = scope.parentId ? this.scopesById.get(scope.parentId) : undefined;
    }
    return undefined;
  }

  private scopeAt(position: DocumentPosition): KickAssemblerSemanticScope {
    for (let index = this.model.scopes.length - 1; index >= 0; index -= 1) {
      const scope = this.model.scopes[index]!;
      if (comparePositions(position, scope.range.start) >= 0 &&
          comparePositions(position, scope.range.end) < 0) return scope;
    }
    return this.model.rootScope;
  }

  private scopeKey(scope: KickAssemblerSemanticScope): string {
    const cached = this.scopeKeys.get(scope.id);
    if (cached !== undefined) return cached;
    let key: string;
    if (scope.kind === 'root') {
      key = '';
    } else if (scope.kind === 'namespace' || scope.kind === 'block' && scope.name) {
      const parent = scope.parentId ? this.scopesById.get(scope.parentId) : undefined;
      key = scope.name?.startsWith('@') ? scope.name.slice(1)
        : joinName(parent ? this.scopeKey(parent) : '', scope.name ?? '');
    } else {
      // Anonymous blocks, parameters and other lexical bodies are private to
      // this parsed document. NUL separators cannot collide with source names.
      key = this.privateScopeKey(scope);
    }
    this.scopeKeys.set(scope.id, key);
    return key;
  }

  private privateScopeKey(scope: KickAssemblerSemanticScope): string {
    if (scope.kind === 'namespace') return `\0namespace\0${this.scopeKey(scope)}\0`;
    return `\0${this.model.document.uri}\0${scope.id}`;
  }
}

function joinName(prefix: string, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

function memberScopeKey(parentId: string, name: string, line: number): string {
  return `${parentId}\0${name}\0${line}`;
}
