import { comparePositions, type DocumentPosition } from '../location/source-location.ts';
import { parseMultiLabelReference } from './kick-assembler-multi-label.ts';
import type {
  KickAssemblerSemanticModel,
  KickAssemblerSemanticScope,
  KickAssemblerSemanticSymbol
} from './kick-assembler-semantic-model.ts';

/** Lexical binding for a document or a caller-supplied expanded program. */
export class KickAssemblerScopeResolver {
  private readonly model: KickAssemblerSemanticModel;
  private readonly expandedSource: boolean;
  private readonly scopesById: ReadonlyMap<string, KickAssemblerSemanticScope>;
  private readonly scopeKeys = new Map<string, string>();
  private readonly memberScopeDeclarations: ReadonlySet<string>;
  private readonly multiLabelsByName = new Map<string, KickAssemblerSemanticSymbol[]>();

  constructor(model: KickAssemblerSemanticModel, expandedSource = false) {
    this.model = model;
    this.expandedSource = expandedSource;
    this.scopesById = new Map(model.scopes.map(scope => [scope.id, scope]));
    this.memberScopeDeclarations = new Set(model.scopes
      .filter(scope => scope.kind === 'block' && scope.name)
      .map(scope => memberScopeKey(scope.parentId ?? '', scope.name!, scope.location.range.start.line)));
    for (const symbol of model.symbols) {
      if (symbol.kind !== 'local-label' && symbol.kind !== 'anonymous-label') continue;
      const declarations = this.multiLabelsByName.get(symbol.name) ?? [];
      declarations.push(symbol);
      this.multiLabelsByName.set(symbol.name, declarations);
    }
  }

  hasMemberScope(symbol: KickAssemblerSemanticSymbol): boolean {
    return this.memberScopeDeclarations.has(memberScopeKey(
      symbol.scopeId, symbol.name, symbol.location.range.start.line
    ));
  }

  declarationKey(symbol: KickAssemblerSemanticSymbol): string {
    if (symbol.kind === 'local-label' || symbol.kind === 'anonymous-label') {
      return `\0multi\0${this.model.document.uri}\0${symbol.id}`;
    }
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
    if (name.startsWith('!')) return this.resolveMultiLabel(position, name);
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

  private resolveMultiLabel(position: DocumentPosition, name: string): string | undefined {
    const reference = parseMultiLabelReference(name);
    if (!reference) return undefined;
    const visibleScopes = new Map<string, number>();
    let scope: KickAssemblerSemanticScope | undefined = this.scopeAt(position);
    while (scope) {
      visibleScopes.set(this.privateScopeKey(scope), visibleScopes.size);
      scope = scope.parentId ? this.scopesById.get(scope.parentId) : undefined;
    }
    const candidates = (this.multiLabelsByName.get(reference.name) ?? []).filter(symbol =>
      visibleScopes.has(this.privateScopeKey(this.scopesById.get(symbol.scopeId)!)) &&
      comparePositions(symbol.location.range.start, position) * reference.direction > 0)
      // Search the nearest lexical scope before outer scopes; imported root
      // labels can occur after a nearer-scope declaration in source order.
      .sort((a, b) => visibleScopes.get(this.privateScopeKey(this.scopesById.get(a.scopeId)!))! -
        visibleScopes.get(this.privateScopeKey(this.scopesById.get(b.scopeId)!))! ||
        comparePositions(a.location.range.start, b.location.range.start) * reference.direction);
    const target = candidates[reference.distance - 1];
    if (!target) return undefined;
    // Document-local fallback cannot know labels inserted by imports. Expanded
    // programs already contain those labels in the correct order.
    if (!this.expandedSource && this.model.imports.some(entry => entry.kind !== 'importonce' &&
      comparePositions(entry.location.range.start, position) * reference.direction > 0 &&
      comparePositions(entry.location.range.start, target.location.range.start) * reference.direction < 0)) return undefined;
    return this.declarationKey(target);
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
    } else if (scope.kind === 'namespace' || scope.kind === 'file-namespace' || scope.kind === 'block' && scope.name) {
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
    if (scope.kind === 'root') return `\0${this.model.document.uri}\0${this.model.rootScope.id}`;
    if (scope.kind === 'namespace' || scope.kind === 'file-namespace') return `\0namespace\0${this.scopeKey(scope)}\0`;
    return `\0${this.model.document.uri}\0${scope.id}`;
  }
}

function joinName(prefix: string, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

function memberScopeKey(parentId: string, name: string, line: number): string {
  return `${parentId}\0${name}\0${line}`;
}
