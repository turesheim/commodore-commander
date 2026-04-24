import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation, SourceRange } from '../location/source-location.ts';
import type {
  DataSymbolMetadata,
  NumericPresentation,
  ValueType
} from '../symbols/symbol-types.ts';
import {
  parseKickAssemblerExpression,
  type KickAssemblerExpressionNode
} from './kick-assembler-expression.ts';
import type {
  KickAssemblerSemanticAttribute,
  KickAssemblerSemanticConditional,
  KickAssemblerSemanticDataDirective,
  KickAssemblerSemanticDiagnostic,
  KickAssemblerSemanticDirective,
  KickAssemblerSemanticDirectiveKind,
  KickAssemblerSemanticImport,
  KickAssemblerSemanticModel,
  KickAssemblerSemanticParameter,
  KickAssemblerSemanticScope,
  KickAssemblerSemanticScopeKind,
  KickAssemblerSemanticSegment,
  KickAssemblerSemanticSymbol,
  KickAssemblerSemanticSymbolKind
} from './kick-assembler-semantic-model.ts';

interface ActiveDataBlock {
  symbol: KickAssemblerSemanticSymbol;
  valueType: ValueType;
  presentation: NumericPresentation;
  byteLength: number;
  valueCountsPerLine: number[];
}

interface ParsedLine {
  raw: string;
  code: string;
}

const LABEL_PATTERN = /^\s*(![A-Za-z_@][A-Za-z0-9_.@]*|!|@?[A-Za-z_][A-Za-z0-9_.]*):/u;
const IMPORT_PATTERN = /^\s*#(importonce|importif|import)\b(.*)$/u;
const DIRECTIVE_PATTERN = /^\s*\.(\w+)\b(.*)$/u;
const SYMBOL_DIRECTIVES = new Map<string, KickAssemblerSemanticSymbolKind>([
  ['const', 'constant'],
  ['var', 'variable'],
  ['label', 'label']
]);
const DATA_DIRECTIVES = new Set([
  'byte',
  'word',
  'dword',
  'text',
  'encoding',
  'fill',
  'fillword',
  'lohifill'
]);
const BLOCK_SYMBOL_DIRECTIVES = new Map<string, {
  scopeKind: KickAssemblerSemanticScopeKind;
  symbolKind: KickAssemblerSemanticSymbolKind;
}>([
  ['namespace', { scopeKind: 'namespace', symbolKind: 'namespace' }],
  ['macro', { scopeKind: 'macro', symbolKind: 'macro' }],
  ['function', { scopeKind: 'function', symbolKind: 'function' }],
  ['pseudocommand', { scopeKind: 'pseudocommand', symbolKind: 'pseudocommand' }],
  ['struct', { scopeKind: 'struct', symbolKind: 'struct' }],
  ['enum', { scopeKind: 'enum', symbolKind: 'enum' }]
]);
const CONDITIONAL_DIRECTIVES = new Set(['if', 'elseif', 'else', 'ifdef', 'ifndef']);
const LOOP_DIRECTIVES = new Set(['for', 'while']);
const CONTROL_DIRECTIVES = new Set([
  ...CONDITIONAL_DIRECTIVES,
  ...LOOP_DIRECTIVES,
  'break',
  'continue',
  'return',
  'eval',
  'error',
  'assert',
  'print'
]);
const DEBUG_DIRECTIVES = new Set(['break', 'watch']);
const BUILD_DIRECTIVES = new Set([
  'file',
  'disk',
  'segmentout',
  'modify',
  'memblock',
  'import',
  'importif',
  'importonce'
]);

export function parseKickAssemblerSemanticModel(
  document: TextDocumentModel
): KickAssemblerSemanticModel {
  return new KickAssemblerSemanticParser(document).parse();
}

class KickAssemblerSemanticParser {
  private readonly document: TextDocumentModel;
  private readonly scopes: KickAssemblerSemanticScope[] = [];
  private readonly symbols: KickAssemblerSemanticSymbol[] = [];
  private readonly imports: KickAssemblerSemanticImport[] = [];
  private readonly directives: KickAssemblerSemanticDirective[] = [];
  private readonly segments: KickAssemblerSemanticSegment[] = [];
  private readonly conditionals: KickAssemblerSemanticConditional[] = [];
  private readonly diagnostics: KickAssemblerSemanticDiagnostic[] = [];
  private readonly scopeStack: KickAssemblerSemanticScope[] = [];
  private blockCommentOpen = false;
  private importOnce = false;
  private pendingDataSymbol: KickAssemblerSemanticSymbol | undefined;
  private activeDataBlock: ActiveDataBlock | undefined;
  private lastGlobalLabel: KickAssemblerSemanticSymbol | undefined;

  constructor(document: TextDocumentModel) {
    this.document = document;
  }

  parse(): KickAssemblerSemanticModel {
    const root = this.createScope('root', undefined, this.documentRangeLocation());
    this.scopeStack.push(root);

    for (let lineIndex = 0; lineIndex < this.document.lineCount; lineIndex += 1) {
      const parsedLine = this.stripComments(this.document.lineAt(lineIndex));
      this.parseLine(parsedLine, lineIndex);
    }

    this.finalizeDataBlock();

    return {
      document: this.document,
      rootScope: root,
      scopes: this.scopes,
      symbols: this.symbols,
      imports: this.imports,
      directives: this.directives,
      segments: this.segments,
      conditionals: this.conditionals,
      diagnostics: this.diagnostics,
      importOnce: this.importOnce
    };
  }

  private parseLine(line: ParsedLine, lineIndex: number): void {
    let code = line.code;
    if (code.trim().length === 0) {
      this.finalizeDataBlock();
      this.pendingDataSymbol = undefined;
      return;
    }

    code = this.closeLeadingScopes(code);
    if (code.trim().length === 0) {
      this.finalizeDataBlock();
      this.pendingDataSymbol = undefined;
      return;
    }

    if (this.parseImport(code, line.raw, lineIndex)) {
      this.finalizeDataBlock();
      this.pendingDataSymbol = undefined;
      return;
    }

    if (this.parseBareElse(code, line.raw, lineIndex)) {
      this.finalizeDataBlock();
      this.pendingDataSymbol = undefined;
      return;
    }

    const label = this.parseLabel(code, line.raw, lineIndex);
    if (label) {
      if (this.activeDataBlock && this.activeDataBlock.symbol.id !== label.symbol.id) {
        this.finalizeDataBlock();
      }
      this.pendingDataSymbol = label.symbol;
      code = code.slice(label.endOffset);
    }

    if (code.trim().length === 0) {
      return;
    }

    const parsedDirective = this.parseDirective(code, line.raw, lineIndex);
    if (parsedDirective) {
      if (!parsedDirective.isDataDirective) {
        this.finalizeDataBlock();
        if (!label) {
          this.pendingDataSymbol = undefined;
        }
      }
      return;
    }

    if (this.parseEnumMember(code, line.raw, lineIndex)) {
      this.finalizeDataBlock();
      this.pendingDataSymbol = undefined;
      return;
    }

    if (braceDelta(code) > 0) {
      this.pushScope('block', undefined, this.location(lineIndex, 0, line.raw.length));
    }

    this.finalizeDataBlock();
    if (!label) {
      this.pendingDataSymbol = undefined;
    }
  }

  private closeLeadingScopes(code: string): string {
    let cursor = 0;
    while (cursor < code.length) {
      const character = code[cursor];
      if (character !== '}' && !/\s/u.test(character ?? '')) {
        break;
      }
      if (character === '}') {
        this.popScope();
      }
      cursor += 1;
    }
    return code.slice(cursor);
  }

  private parseImport(code: string, rawLine: string, lineIndex: number): boolean {
    const match = IMPORT_PATTERN.exec(code);
    if (!match) {
      return false;
    }

    const directive = match[1];
    const operands = match[2] ?? '';
    if (directive === 'importonce') {
      this.importOnce = true;
      this.imports.push({
        kind: 'importonce',
        location: this.location(lineIndex, rawLine.indexOf('#'), rawLine.length)
      });
      return true;
    }

    const quoted = /"([^"]+)"/u.exec(operands);
    const specifier = quoted?.[1];
    if (!specifier) {
      this.diagnostics.push({
        code: 'import-missing-specifier',
        message: `#${directive} requires a quoted source path.`,
        severity: 'warning',
        location: this.location(lineIndex, rawLine.indexOf('#'), rawLine.length)
      });
      return true;
    }

    const specifierOffset = rawLine.indexOf(specifier);
    const specifierLocation = this.location(
      lineIndex,
      specifierOffset >= 0 ? specifierOffset : 0,
      (specifierOffset >= 0 ? specifierOffset : 0) + specifier.length
    );
    const importEntry: KickAssemblerSemanticImport = {
      kind: directive === 'importif' ? 'importif' : 'import',
      specifier,
      location: this.location(lineIndex, rawLine.indexOf('#'), rawLine.length),
      specifierLocation
    };

    if (directive === 'importif') {
      const conditionText = operands.slice(0, quoted.index).trim();
      if (conditionText.length > 0) {
        const conditionOffset = rawLine.indexOf(conditionText);
        importEntry.condition = this.parseExpression(
          conditionText,
          lineIndex,
          conditionOffset >= 0 ? conditionOffset : 0
        );
      }
    }

    this.imports.push(importEntry);
    return true;
  }

  private parseBareElse(code: string, rawLine: string, lineIndex: number): boolean {
    const match = /^\s*else\b(.*)$/u.exec(code);
    if (!match) {
      return false;
    }

    const operands = (match[1] ?? '').trim();
    const location = this.location(lineIndex, rawLine.indexOf('else'), rawLine.length);
    const conditionText = operands.startsWith('if')
      ? trimWrappingParentheses(operands.slice(2).replace(/\{/gu, '').trim())
      : undefined;
    const scope = this.pushScope('conditional', conditionText ? 'elseif' : 'else', location);
    this.conditionals.push({
      kind: conditionText ? 'elseif' : 'else',
      location,
      condition: conditionText
        ? this.parseExpression(
            conditionText,
            lineIndex,
            rawLine.indexOf(conditionText)
          )
        : undefined,
      scopeId: scope.id
    });
    if (!hasOpeningBrace(rawLine)) {
      this.popScope();
    }
    return true;
  }

  private parseLabel(
    code: string,
    rawLine: string,
    lineIndex: number
  ): { symbol: KickAssemblerSemanticSymbol; endOffset: number } | undefined {
    const match = LABEL_PATTERN.exec(code);
    if (!match) {
      return undefined;
    }

    const name = match[1];
    if (!name) {
      return undefined;
    }
    const start = rawLine.indexOf(name);
    const safeStart = start >= 0 ? start : 0;
    const kind = labelKind(name);
    const symbol = this.addSymbol({
      name,
      kind,
      location: this.location(lineIndex, safeStart, safeStart + name.length),
      generated: this.isGeneratedSymbolScope()
    });

    if (kind === 'label') {
      this.lastGlobalLabel = symbol;
    }

    return {
      symbol,
      endOffset: (match.index ?? 0) + match[0].length
    };
  }

  private parseDirective(
    code: string,
    rawLine: string,
    lineIndex: number
  ): { isDataDirective: boolean } | undefined {
    const match = DIRECTIVE_PATTERN.exec(code);
    if (!match) {
      return undefined;
    }

    const directiveName = match[1]?.toLowerCase();
    if (!directiveName) {
      return undefined;
    }
    const operands = (match[2] ?? '').trim();
    const directiveStart = rawLine.indexOf(`.${directiveName}`);
    const location = this.location(
      lineIndex,
      directiveStart >= 0 ? directiveStart : 0,
      rawLine.length
    );

    this.directives.push({
      name: directiveName,
      kind: directiveKind(directiveName),
      location,
      operands,
      operandExpressions: this.parseOperandExpressions(operands, rawLine, lineIndex)
    });

    if (SYMBOL_DIRECTIVES.has(directiveName)) {
      this.parseSymbolDirective(directiveName, operands, rawLine, lineIndex);
      return { isDataDirective: false };
    }

    if (DATA_DIRECTIVES.has(directiveName)) {
      this.parseDataDirective(directiveName, operands, rawLine, lineIndex, location);
      return { isDataDirective: true };
    }

    if (BLOCK_SYMBOL_DIRECTIVES.has(directiveName)) {
      this.parseBlockSymbolDirective(directiveName, operands, rawLine, lineIndex, location);
      return { isDataDirective: false };
    }

    if (directiveName === 'segmentdef') {
      this.parseSegmentDefinition(operands, rawLine, lineIndex, location);
      return { isDataDirective: false };
    }

    if (directiveName === 'segment') {
      this.parseSegmentSelection(operands, rawLine, lineIndex, location);
      return { isDataDirective: false };
    }

    if (directiveName === 'pc') {
      this.parseProgramCounter(operands, rawLine, lineIndex, location);
      return { isDataDirective: false };
    }

    if (CONDITIONAL_DIRECTIVES.has(directiveName)) {
      this.parseConditional(directiveName, operands, rawLine, lineIndex, location);
      return { isDataDirective: false };
    }

    if (LOOP_DIRECTIVES.has(directiveName)) {
      this.parseLoop(directiveName, operands, rawLine, lineIndex, location);
      return { isDataDirective: false };
    }

    return { isDataDirective: false };
  }

  private parseSymbolDirective(
    directiveName: string,
    operands: string,
    rawLine: string,
    lineIndex: number
  ): void {
    const match = /^([@A-Za-z_][@A-Za-z0-9_.]*)\b\s*(?:=\s*(.*))?$/u.exec(operands);
    const name = match?.[1];
    if (!name) {
      this.diagnostics.push({
        code: 'symbol-directive-missing-name',
        message: `.${directiveName} requires a symbol name.`,
        severity: 'warning',
        location: this.location(lineIndex, 0, rawLine.length)
      });
      return;
    }

    const nameOffset = rawLine.indexOf(name);
    const valueText = match?.[2]?.trim();
    this.addSymbol({
      name,
      kind: SYMBOL_DIRECTIVES.get(directiveName) ?? 'variable',
      location: this.location(
        lineIndex,
        nameOffset >= 0 ? nameOffset : 0,
        (nameOffset >= 0 ? nameOffset : 0) + name.length
      ),
      value: valueText
        ? this.parseExpression(
            valueText,
            lineIndex,
            rawLine.lastIndexOf(valueText)
          )
        : undefined,
      detail: `.${directiveName}`,
      generated: this.isGeneratedSymbolScope()
    });
  }

  private parseDataDirective(
    directiveName: string,
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const parsedData = parseDataDirective(directiveName, operands);
    if (!parsedData) {
      return;
    }

    if (!this.pendingDataSymbol && !this.activeDataBlock) {
      this.diagnostics.push({
        code: 'orphan-data-declaration',
        message:
          'Data declaration found without a preceding label. It is not attached to a symbol.',
        severity: 'info',
        location
      });
      return;
    }

    const symbol = this.activeDataBlock?.symbol ?? this.pendingDataSymbol;
    if (!symbol) {
      return;
    }

    if (!this.activeDataBlock) {
      this.activeDataBlock = {
        symbol,
        valueType: parsedData.valueType,
        presentation: parsedData.presentation,
        byteLength: 0,
        valueCountsPerLine: []
      };
    } else if (this.activeDataBlock.valueType !== parsedData.valueType) {
      this.diagnostics.push({
        code: 'mixed-data-directives',
        message:
          'Mixed .byte/.word/.dword sequences on one label are modelled as one data block.',
        severity: 'info',
        location: this.location(lineIndex, 0, rawLine.length)
      });
    }

    this.activeDataBlock.byteLength += parsedData.byteLength;
    this.activeDataBlock.valueCountsPerLine.push(parsedData.valueCount);
    if (this.activeDataBlock.presentation === 'decimal') {
      this.activeDataBlock.presentation = parsedData.presentation;
    }
  }

  private parseBlockSymbolDirective(
    directiveName: string,
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const blockInfo = BLOCK_SYMBOL_DIRECTIVES.get(directiveName);
    if (!blockInfo) {
      return;
    }

    const signature = parseNameAndParameters(operands);
    if (!signature.name) {
      this.diagnostics.push({
        code: 'block-directive-missing-name',
        message: `.${directiveName} requires a name.`,
        severity: 'warning',
        location
      });
      return;
    }

    const nameOffset = rawLine.indexOf(signature.name);
    const symbol = this.addSymbol({
      name: signature.name,
      kind: blockInfo.symbolKind,
      location: this.location(
        lineIndex,
        nameOffset >= 0 ? nameOffset : 0,
        (nameOffset >= 0 ? nameOffset : 0) + signature.name.length
      ),
      detail: `.${directiveName}`,
      generated: this.isGeneratedSymbolScope()
    });
    const scope = this.pushScope(blockInfo.scopeKind, signature.name, location);
    scope.qualifiedName = symbol.qualifiedName;

    const parameters = this.parseParameters(signature.parameters, rawLine, lineIndex);
    if (parameters.length > 0) {
      symbol.parameters = parameters;
      for (const parameter of parameters) {
        this.addSymbol({
          name: parameter.name,
          kind: 'parameter',
          location: parameter.location,
          value: parameter.defaultValue,
          generated: false
        });
      }
    }

    if (!hasOpeningBrace(rawLine)) {
      this.popScope();
    }
  }

  private parseSegmentDefinition(
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const name = firstToken(operands);
    if (!name) {
      return;
    }
    const nameOffset = rawLine.indexOf(name);
    this.addSymbol({
      name,
      kind: 'segment-definition',
      location: this.location(
        lineIndex,
        nameOffset >= 0 ? nameOffset : 0,
        (nameOffset >= 0 ? nameOffset : 0) + name.length
      ),
      detail: '.segmentdef',
      generated: false
    });
    this.segments.push({
      name,
      kind: 'definition',
      location,
      attributes: this.parseAttributes(operands, rawLine, lineIndex)
    });
  }

  private parseSegmentSelection(
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const name = stripQuotes(firstToken(operands) ?? 'segment');
    const scope = this.pushScope('segment', name, location);
    this.segments.push({
      name,
      kind: 'selection',
      location,
      scopeId: scope.id,
      attributes: this.parseAttributes(operands, rawLine, lineIndex)
    });
    if (!hasOpeningBrace(rawLine)) {
      this.popScope();
    }
  }

  private parseProgramCounter(
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const label = quotedStrings(operands)[0] ?? '.pc';
    const addressText = operands.startsWith('=')
      ? operands.slice(1).replace(/"([^"\\]|\\.)*"/gu, '').trim()
      : operands.replace(/"([^"\\]|\\.)*"/gu, '').trim();
    const scope = this.pushScope('program-counter', label, location);
    this.segments.push({
      name: label,
      kind: 'program-counter',
      location,
      scopeId: scope.id,
      address: addressText
        ? this.parseExpression(
            addressText,
            lineIndex,
            rawLine.indexOf(addressText)
          )
        : undefined,
      attributes: []
    });
    if (!hasOpeningBrace(rawLine)) {
      this.popScope();
    }
  }

  private parseConditional(
    directiveName: string,
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const kind = directiveName as KickAssemblerSemanticConditional['kind'];
    const condition = directiveName === 'else' || operands.length === 0
      ? undefined
      : this.parseExpression(
          trimWrappingParentheses(operands),
          lineIndex,
          rawLine.indexOf(trimWrappingParentheses(operands))
        );
    const scope = this.pushScope('conditional', directiveName, location);
    this.conditionals.push({
      kind,
      location,
      condition,
      scopeId: scope.id
    });
    if (!hasOpeningBrace(rawLine)) {
      this.popScope();
    }
  }

  private parseLoop(
    directiveName: string,
    operands: string,
    rawLine: string,
    lineIndex: number,
    location: SourceLocation
  ): void {
    const scope = this.pushScope('loop', directiveName, location);
    const variable = parseLoopVariable(operands);
    if (variable) {
      const nameOffset = rawLine.indexOf(variable.name);
      this.addSymbol({
        name: variable.name,
        kind: 'for-variable',
        location: this.location(
          lineIndex,
          nameOffset >= 0 ? nameOffset : 0,
          (nameOffset >= 0 ? nameOffset : 0) + variable.name.length
        ),
        value: variable.value
          ? this.parseExpression(
              variable.value,
              lineIndex,
              rawLine.indexOf(variable.value)
            )
          : undefined,
        generated: true
      });
    }
    if (!hasOpeningBrace(rawLine)) {
      this.popScope();
    } else {
      scope.name = directiveName;
    }
  }

  private parseEnumMember(code: string, rawLine: string, lineIndex: number): boolean {
    if (this.currentScope().kind !== 'enum') {
      return false;
    }

    const match = /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*(?:=\s*(.*))?$/u.exec(code);
    const name = match?.[1];
    if (!name) {
      return false;
    }

    const nameOffset = rawLine.indexOf(name);
    const valueText = match?.[2]?.trim();
    this.addSymbol({
      name,
      kind: 'enum-member',
      location: this.location(
        lineIndex,
        nameOffset >= 0 ? nameOffset : 0,
        (nameOffset >= 0 ? nameOffset : 0) + name.length
      ),
      value: valueText
        ? this.parseExpression(valueText, lineIndex, rawLine.indexOf(valueText))
        : undefined,
      generated: true
    });
    return true;
  }

  private parseOperandExpressions(
    operands: string,
    rawLine: string,
    lineIndex: number
  ): KickAssemblerExpressionNode[] {
    const expressions: KickAssemblerExpressionNode[] = [];
    for (const argument of splitArguments(operands)) {
      const expressionText = expressionTextFromOperand(argument);
      if (!expressionText) {
        continue;
      }
      const column = rawLine.indexOf(expressionText);
      const expression = this.parseExpression(
        expressionText,
        lineIndex,
        column >= 0 ? column : 0
      );
      if (expression) {
        expressions.push(expression);
      }
    }
    return expressions;
  }

  private parseParameters(
    parameterText: string | undefined,
    rawLine: string,
    lineIndex: number
  ): KickAssemblerSemanticParameter[] {
    if (!parameterText) {
      return [];
    }

    const parameters: KickAssemblerSemanticParameter[] = [];
    for (const parameter of splitArguments(parameterText)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*(?:=\s*(.*))?$/u.exec(parameter);
      const name = match?.[1];
      if (!name) {
        continue;
      }
      const nameOffset = rawLine.indexOf(name);
      const defaultText = match?.[2]?.trim();
      const entry: KickAssemblerSemanticParameter = {
        name,
        location: this.location(
          lineIndex,
          nameOffset >= 0 ? nameOffset : 0,
          (nameOffset >= 0 ? nameOffset : 0) + name.length
        )
      };
      if (defaultText) {
        entry.defaultValue = this.parseExpression(
          defaultText,
          lineIndex,
          rawLine.indexOf(defaultText)
        );
      }
      parameters.push(entry);
    }
    return parameters;
  }

  private parseAttributes(
    operands: string,
    rawLine: string,
    lineIndex: number
  ): KickAssemblerSemanticAttribute[] {
    const attributesText = /\[([\s\S]*)\]/u.exec(operands)?.[1];
    if (!attributesText) {
      return [];
    }

    const attributes: KickAssemblerSemanticAttribute[] = [];
    for (const attributeText of splitArguments(attributesText)) {
      const [namePart, valuePart] = splitAssignment(attributeText);
      const name = namePart.trim();
      if (!name) {
        continue;
      }
      const nameOffset = rawLine.indexOf(name);
      const attribute: KickAssemblerSemanticAttribute = {
        name,
        location: this.location(
          lineIndex,
          nameOffset >= 0 ? nameOffset : 0,
          (nameOffset >= 0 ? nameOffset : 0) + name.length
        )
      };
      const valueText = valuePart?.trim();
      if (valueText) {
        attribute.value = this.parseExpression(
          valueText,
          lineIndex,
          rawLine.indexOf(valueText)
        );
      }
      attributes.push(attribute);
    }
    return attributes;
  }

  private parseExpression(
    text: string,
    lineIndex: number,
    column: number
  ): KickAssemblerExpressionNode | undefined {
    const result = parseKickAssemblerExpression(
      text,
      this.document.uri,
      lineIndex,
      Math.max(0, column)
    );
    for (const diagnostic of result.diagnostics) {
      this.diagnostics.push({
        code: 'expression-parse',
        message: diagnostic.message,
        severity: 'warning',
        location: diagnostic.location
      });
    }
    return result.expression;
  }

  private addSymbol(options: {
    name: string;
    kind: KickAssemblerSemanticSymbolKind;
    location: SourceLocation;
    detail?: string | undefined;
    value?: KickAssemblerExpressionNode | undefined;
    generated: boolean;
  }): KickAssemblerSemanticSymbol {
    const currentScope = this.currentScope();
    const id = `symbol:${this.symbols.length}`;
    const symbol: KickAssemblerSemanticSymbol = {
      id,
      name: options.name,
      qualifiedName: this.qualifiedName(options.name, options.kind),
      kind: options.kind,
      scopeId: currentScope.id,
      location: options.location,
      generated: options.generated
    };
    if (options.detail) {
      symbol.detail = options.detail;
    }
    if (options.value) {
      symbol.value = options.value;
    }
    this.symbols.push(symbol);
    currentScope.symbolIds.push(symbol.id);
    return symbol;
  }

  private createScope(
    kind: KickAssemblerSemanticScopeKind,
    name: string | undefined,
    location: SourceLocation
  ): KickAssemblerSemanticScope {
    const parent = this.scopeStack[this.scopeStack.length - 1];
    const id = `scope:${this.scopes.length}`;
    const scope: KickAssemblerSemanticScope = {
      id,
      kind,
      location,
      range: location.range,
      childScopeIds: [],
      symbolIds: []
    };
    if (name) {
      scope.name = name;
      scope.qualifiedName = this.qualifiedScopeName(name);
    }
    if (parent) {
      scope.parentId = parent.id;
      parent.childScopeIds.push(id);
    }
    this.scopes.push(scope);
    return scope;
  }

  private pushScope(
    kind: KickAssemblerSemanticScopeKind,
    name: string | undefined,
    location: SourceLocation
  ): KickAssemblerSemanticScope {
    const scope = this.createScope(kind, name, location);
    this.scopeStack.push(scope);
    return scope;
  }

  private popScope(): void {
    if (this.scopeStack.length <= 1) {
      return;
    }
    this.scopeStack.pop();
  }

  private currentScope(): KickAssemblerSemanticScope {
    const scope = this.scopeStack[this.scopeStack.length - 1];
    if (!scope) {
      throw new Error('Kick Assembler semantic parser has no active scope.');
    }
    return scope;
  }

  private qualifiedName(
    name: string,
    kind: KickAssemblerSemanticSymbolKind
  ): string {
    if (kind === 'local-label' || kind === 'anonymous-label') {
      const localParent = this.lastGlobalLabel?.qualifiedName;
      return localParent ? `${localParent}.${name}` : this.joinQualifier(name);
    }
    return this.joinQualifier(name);
  }

  private qualifiedScopeName(name: string): string {
    return this.joinQualifier(name);
  }

  private joinQualifier(name: string): string {
    const qualifiers = this.scopeStack
      .filter((scope) => scope.kind === 'namespace' && scope.name)
      .map((scope) => scope.name as string);
    return [...qualifiers, name].join('.');
  }

  private isGeneratedSymbolScope(): boolean {
    return this.scopeStack.some((scope) =>
      scope.kind === 'macro' ||
      scope.kind === 'pseudocommand' ||
      scope.kind === 'loop'
    );
  }

  private finalizeDataBlock(): void {
    if (!this.activeDataBlock) {
      return;
    }

    const metadata: DataSymbolMetadata = {
      valueType: this.activeDataBlock.valueType,
      byteLength: this.activeDataBlock.byteLength,
      valueCountsPerLine: [...this.activeDataBlock.valueCountsPerLine],
      presentation: this.activeDataBlock.presentation
    };

    this.activeDataBlock.symbol.data = metadata;
    this.activeDataBlock = undefined;
  }

  private documentRangeLocation(): SourceLocation {
    const lastLine = Math.max(0, this.document.lineCount - 1);
    const lastLineText = this.document.lineAt(lastLine);
    return {
      uri: this.document.uri,
      range: {
        start: {
          line: 0,
          character: 0
        },
        end: {
          line: lastLine,
          character: lastLineText.length
        }
      }
    };
  }

  private location(line: number, startCharacter: number, endCharacter: number): SourceLocation {
    return {
      uri: this.document.uri,
      range: {
        start: {
          line,
          character: Math.max(0, startCharacter)
        },
        end: {
          line,
          character: Math.max(Math.max(0, startCharacter), endCharacter)
        }
      }
    };
  }

  private stripComments(raw: string): ParsedLine {
    let code = '';
    let quotedBy: '"' | "'" | undefined;
    let parenDepth = 0;

    for (let index = 0; index < raw.length; index += 1) {
      const current = raw[index];
      const next = raw[index + 1];

      if (!current) {
        break;
      }

      if (this.blockCommentOpen) {
        code += ' ';
        if (current === '*' && next === '/') {
          this.blockCommentOpen = false;
          code += ' ';
          index += 1;
        }
        continue;
      }

      if ((current === '"' || current === "'") && raw[index - 1] !== '\\') {
        quotedBy = quotedBy === current ? undefined : current;
        code += current;
        continue;
      }

      if (quotedBy) {
        code += current;
        continue;
      }

      if (current === '/' && next === '*') {
        this.blockCommentOpen = true;
        code += '  ';
        index += 1;
        continue;
      }

      if (current === '/' && next === '/') {
        break;
      }

      if (current === ';' && parenDepth === 0) {
        break;
      }

      if (current === '(' || current === '[' || current === '{') {
        parenDepth += 1;
      } else if (current === ')' || current === ']' || current === '}') {
        parenDepth = Math.max(0, parenDepth - 1);
      }

      code += current;
    }

    return { raw, code };
  }
}

function labelKind(name: string): KickAssemblerSemanticSymbolKind {
  if (name === '!') {
    return 'anonymous-label';
  }
  if (name.startsWith('!')) {
    return 'local-label';
  }
  return 'label';
}

function directiveKind(directiveName: string): KickAssemblerSemanticDirectiveKind {
  if (SYMBOL_DIRECTIVES.has(directiveName)) {
    return 'symbol';
  }
  if (DATA_DIRECTIVES.has(directiveName)) {
    return 'data';
  }
  if (DEBUG_DIRECTIVES.has(directiveName)) {
    return 'debug';
  }
  if (CONTROL_DIRECTIVES.has(directiveName)) {
    return 'control';
  }
  if (directiveName === 'segment' || directiveName === 'segmentdef' || directiveName === 'pc') {
    return 'segment';
  }
  if (BUILD_DIRECTIVES.has(directiveName)) {
    return 'build';
  }
  return 'generic';
}

function parseDataDirective(
  directiveName: string,
  operands: string
): KickAssemblerSemanticDataDirective | undefined {
  const valueType = toValueType(directiveName);
  if (!valueType) {
    return undefined;
  }
  const values = splitArguments(operands);
  if (values.length === 0) {
    return undefined;
  }
  const firstValue = values[0];
  if (!firstValue) {
    return undefined;
  }

  return {
    valueType,
    valueCount: values.length,
    byteLength: values.length * byteWidth(valueType),
    presentation: presentationForValue(firstValue)
  };
}

function toValueType(directiveName: string): ValueType | undefined {
  if (directiveName === 'byte') {
    return 'byte';
  }
  if (directiveName === 'word') {
    return 'word';
  }
  if (directiveName === 'dword') {
    return 'dword';
  }
  return undefined;
}

function byteWidth(valueType: ValueType): number {
  switch (valueType) {
    case 'byte':
      return 1;
    case 'word':
      return 2;
    case 'dword':
      return 4;
  }
}

function presentationForValue(value: string): NumericPresentation {
  if (value.trim().startsWith('$')) {
    return 'hexadecimal';
  }
  if (value.trim().startsWith('%')) {
    return 'binary';
  }
  return 'decimal';
}

function parseNameAndParameters(operands: string): {
  name: string | undefined;
  parameters: string | undefined;
} {
  const match = /^\s*([A-Za-z_@][A-Za-z0-9_.@]*)\s*(?:\(([^)]*)\))?/u.exec(operands);
  return {
    name: match?.[1],
    parameters: match?.[2]
  };
}

function parseLoopVariable(operands: string): { name: string; value?: string } | undefined {
  const trimmed = trimWrappingParentheses(operands);
  const match = /(?:^|;|\bvar\s+)([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*([^;,)]+)/u.exec(trimmed);
  const name = match?.[1];
  if (!name) {
    return undefined;
  }
  const result: { name: string; value?: string } = { name };
  if (match?.[2]) {
    result.value = match[2].trim();
  }
  return result;
}

function firstToken(text: string): string | undefined {
  const match = /^\s*("[^"]+"|[^\s\[]+)/u.exec(text);
  return match?.[1];
}

function stripQuotes(text: string): string {
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

function quotedStrings(text: string): string[] {
  return [...text.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/gu)].map((match) => match[1] ?? '');
}

function trimWrappingParentheses(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function hasOpeningBrace(text: string): boolean {
  return braceDelta(text) > 0;
}

function braceDelta(text: string): number {
  let delta = 0;
  let quotedBy: '"' | "'" | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    if ((current === '"' || current === "'") && text[index - 1] !== '\\') {
      quotedBy = quotedBy === current ? undefined : current;
      continue;
    }
    if (quotedBy) {
      continue;
    }
    if (current === '{') {
      delta += 1;
    } else if (current === '}') {
      delta -= 1;
    }
  }
  return delta;
}

function splitArguments(argumentText: string): string[] {
  const values: string[] = [];
  let current = '';
  let quotedBy: '"' | "'" | undefined;
  let nestingDepth = 0;

  for (let index = 0; index < argumentText.length; index += 1) {
    const character = argumentText[index];
    if (!character) {
      break;
    }

    if (
      (character === '"' || character === "'") &&
      argumentText[index - 1] !== '\\'
    ) {
      quotedBy = quotedBy === character ? undefined : character;
      current += character;
      continue;
    }

    if (!quotedBy) {
      if (character === '(' || character === '[' || character === '{') {
        nestingDepth += 1;
      } else if (character === ')' || character === ']' || character === '}') {
        nestingDepth = Math.max(0, nestingDepth - 1);
      } else if (character === ',' && nestingDepth === 0) {
        const value = current.trim();
        if (value.length > 0) {
          values.push(value);
        }
        current = '';
        continue;
      }
    }

    current += character;
  }

  const value = current.trim();
  if (value.length > 0) {
    values.push(value);
  }
  return values;
}

function expressionTextFromOperand(operand: string): string | undefined {
  const [left, right] = splitAssignment(operand);
  const candidate = right ?? left;
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (right === undefined && /["{}]/u.test(trimmed)) {
    return undefined;
  }
  if (right === undefined && /\s/u.test(trimmed) && !/[+\-*/%&|^<>=?:()[\]]/u.test(trimmed)) {
    return undefined;
  }
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/u.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function splitAssignment(text: string): [string, string | undefined] {
  let quotedBy: '"' | "'" | undefined;
  let nestingDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!character) {
      break;
    }
    if ((character === '"' || character === "'") && text[index - 1] !== '\\') {
      quotedBy = quotedBy === character ? undefined : character;
      continue;
    }
    if (quotedBy) {
      continue;
    }
    if (character === '(' || character === '[' || character === '{') {
      nestingDepth += 1;
      continue;
    }
    if (character === ')' || character === ']' || character === '}') {
      nestingDepth = Math.max(0, nestingDepth - 1);
      continue;
    }
    if (character === '=' && nestingDepth === 0) {
      return [text.slice(0, index), text.slice(index + 1)];
    }
  }

  return [text, undefined];
}
