import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation, SourceRange } from '../location/source-location.ts';
import type {
  DataSymbolMetadata,
  KickAssemblerDiagnosticSeverity,
  NumericPresentation,
  ValueType
} from '../symbols/symbol-types.ts';
import type { KickAssemblerExpressionNode } from './kick-assembler-expression.ts';

export type KickAssemblerSemanticScopeKind =
  | 'root'
  | 'block'
  | 'namespace'
  | 'macro'
  | 'function'
  | 'pseudocommand'
  | 'struct'
  | 'enum'
  | 'segment'
  | 'program-counter'
  | 'conditional'
  | 'loop';

export type KickAssemblerSemanticSymbolKind =
  | 'label'
  | 'local-label'
  | 'anonymous-label'
  | 'constant'
  | 'variable'
  | 'parameter'
  | 'namespace'
  | 'macro'
  | 'function'
  | 'pseudocommand'
  | 'struct'
  | 'enum'
  | 'enum-member'
  | 'segment'
  | 'segment-definition'
  | 'for-variable'
  | 'generated';

export type KickAssemblerSemanticImportKind =
  | 'import'
  | 'importif'
  | 'importonce';

export type KickAssemblerSemanticDirectiveKind =
  | 'symbol'
  | 'data'
  | 'control'
  | 'segment'
  | 'build'
  | 'debug'
  | 'generic';

export interface KickAssemblerSemanticModel {
  document: TextDocumentModel;
  rootScope: KickAssemblerSemanticScope;
  scopes: KickAssemblerSemanticScope[];
  symbols: KickAssemblerSemanticSymbol[];
  imports: KickAssemblerSemanticImport[];
  directives: KickAssemblerSemanticDirective[];
  segments: KickAssemblerSemanticSegment[];
  conditionals: KickAssemblerSemanticConditional[];
  diagnostics: KickAssemblerSemanticDiagnostic[];
  importOnce: boolean;
}

export interface KickAssemblerSemanticScope {
  id: string;
  kind: KickAssemblerSemanticScopeKind;
  name?: string;
  qualifiedName?: string;
  parentId?: string;
  location: SourceLocation;
  range: SourceRange;
  childScopeIds: string[];
  symbolIds: string[];
}

export interface KickAssemblerSemanticSymbol {
  id: string;
  name: string;
  qualifiedName: string;
  kind: KickAssemblerSemanticSymbolKind;
  scopeId: string;
  location: SourceLocation;
  detail?: string | undefined;
  value?: KickAssemblerExpressionNode | undefined;
  parameters?: KickAssemblerSemanticParameter[] | undefined;
  data?: DataSymbolMetadata | undefined;
  generated: boolean;
}

export interface KickAssemblerSemanticParameter {
  name: string;
  location: SourceLocation;
  defaultValue?: KickAssemblerExpressionNode | undefined;
}

export interface KickAssemblerSemanticImport {
  kind: KickAssemblerSemanticImportKind;
  specifier?: string | undefined;
  condition?: KickAssemblerExpressionNode | undefined;
  location: SourceLocation;
  specifierLocation?: SourceLocation | undefined;
}

export interface KickAssemblerSemanticDirective {
  name: string;
  kind: KickAssemblerSemanticDirectiveKind;
  location: SourceLocation;
  operands: string;
  operandExpressions: KickAssemblerExpressionNode[];
}

export interface KickAssemblerSemanticSegment {
  name: string;
  kind: 'definition' | 'selection' | 'program-counter';
  location: SourceLocation;
  scopeId?: string | undefined;
  address?: KickAssemblerExpressionNode | undefined;
  attributes: KickAssemblerSemanticAttribute[];
}

export interface KickAssemblerSemanticConditional {
  kind: 'if' | 'elseif' | 'else' | 'ifdef' | 'ifndef';
  location: SourceLocation;
  condition?: KickAssemblerExpressionNode | undefined;
  scopeId: string;
}

export interface KickAssemblerSemanticAttribute {
  name: string;
  value?: KickAssemblerExpressionNode | undefined;
  location: SourceLocation;
}

export interface KickAssemblerSemanticDiagnostic {
  code: string;
  message: string;
  severity: KickAssemblerDiagnosticSeverity;
  location?: SourceLocation | undefined;
}

export interface KickAssemblerSemanticDataDirective {
  valueType: ValueType;
  valueCount: number;
  byteLength: number;
  presentation: NumericPresentation;
}
