import type { SourceLocation } from '../location/source-location.ts';

export type KickAssemblerExpressionNode =
  | KickAssemblerLiteralExpression
  | KickAssemblerIdentifierExpression
  | KickAssemblerUnaryExpression
  | KickAssemblerBinaryExpression
  | KickAssemblerConditionalExpression
  | KickAssemblerCallExpression
  | KickAssemblerMemberExpression
  | KickAssemblerIndexExpression
  | KickAssemblerArrayExpression
  | KickAssemblerMalformedExpression;

export interface KickAssemblerExpressionParseResult {
  expression: KickAssemblerExpressionNode | undefined;
  diagnostics: KickAssemblerExpressionDiagnostic[];
}

export interface KickAssemblerExpressionDiagnostic {
  message: string;
  location: SourceLocation;
}

export interface KickAssemblerExpressionBase {
  kind: string;
  text: string;
  location: SourceLocation;
}

export interface KickAssemblerLiteralExpression extends KickAssemblerExpressionBase {
  kind: 'literal';
  literalKind: 'number' | 'string' | 'character' | 'boolean';
  value?: number | string | boolean | undefined;
}

export interface KickAssemblerIdentifierExpression extends KickAssemblerExpressionBase {
  kind: 'identifier';
  name: string;
}

export interface KickAssemblerUnaryExpression extends KickAssemblerExpressionBase {
  kind: 'unary';
  operator: string;
  operand: KickAssemblerExpressionNode;
}

export interface KickAssemblerBinaryExpression extends KickAssemblerExpressionBase {
  kind: 'binary';
  operator: string;
  left: KickAssemblerExpressionNode;
  right: KickAssemblerExpressionNode;
}

export interface KickAssemblerConditionalExpression extends KickAssemblerExpressionBase {
  kind: 'conditional';
  condition: KickAssemblerExpressionNode;
  whenTrue: KickAssemblerExpressionNode;
  whenFalse: KickAssemblerExpressionNode;
}

export interface KickAssemblerCallExpression extends KickAssemblerExpressionBase {
  kind: 'call';
  callee: KickAssemblerExpressionNode;
  args: KickAssemblerExpressionNode[];
}

export interface KickAssemblerMemberExpression extends KickAssemblerExpressionBase {
  kind: 'member';
  object: KickAssemblerExpressionNode;
  member: string;
}

export interface KickAssemblerIndexExpression extends KickAssemblerExpressionBase {
  kind: 'index';
  object: KickAssemblerExpressionNode;
  index: KickAssemblerExpressionNode;
}

export interface KickAssemblerArrayExpression extends KickAssemblerExpressionBase {
  kind: 'array';
  elements: KickAssemblerExpressionNode[];
}

export interface KickAssemblerMalformedExpression extends KickAssemblerExpressionBase {
  kind: 'malformed';
  message: string;
}

interface ExpressionToken {
  kind: 'identifier' | 'number' | 'string' | 'character' | 'operator' | 'punctuation' | 'eof';
  text: string;
  start: number;
  end: number;
}

const BINARY_PRECEDENCE = new Map<string, number>([
  ['||', 1],
  ['&&', 2],
  ['|', 3],
  ['^', 4],
  ['&', 5],
  ['==', 6],
  ['!=', 6],
  ['<', 7],
  ['<=', 7],
  ['>', 7],
  ['>=', 7],
  ['<<', 8],
  ['>>', 8],
  ['+', 9],
  ['-', 9],
  ['*', 10],
  ['/', 10],
  ['%', 10]
]);
const UNARY_OPERATORS = new Set(['+', '-', '!', '~', '<', '>']);
const TWO_CHARACTER_OPERATORS = new Set([
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '<<',
  '>>',
  '++',
  '--'
]);
const SINGLE_CHARACTER_OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '!',
  '~',
  '<',
  '>',
  '=',
  '?',
  ':'
]);
const PUNCTUATION = new Set(['(', ')', '[', ']', '{', '}', ',', '.']);

export function parseKickAssemblerExpression(
  text: string,
  uri = 'memory:///expression',
  line = 0,
  column = 0
): KickAssemblerExpressionParseResult {
  const parser = new ExpressionParser(text, uri, line, column);
  return parser.parse();
}

class ExpressionParser {
  private readonly tokens: ExpressionToken[];
  private readonly diagnostics: KickAssemblerExpressionDiagnostic[] = [];
  private readonly text: string;
  private readonly uri: string;
  private readonly line: number;
  private readonly column: number;
  private index = 0;

  constructor(
    text: string,
    uri: string,
    line: number,
    column: number
  ) {
    this.text = text;
    this.uri = uri;
    this.line = line;
    this.column = column;
    this.tokens = tokenizeExpression(text);
  }

  parse(): KickAssemblerExpressionParseResult {
    const expression = this.parseExpression();
    const trailing = this.peek();
    if (expression && trailing.kind !== 'eof') {
      this.diagnostics.push({
        message: `Unexpected token "${trailing.text}" in expression.`,
        location: this.location(trailing.start, trailing.end)
      });
    }

    return {
      expression,
      diagnostics: this.diagnostics
    };
  }

  private parseExpression(minPrecedence = 0): KickAssemblerExpressionNode | undefined {
    let left = this.parsePrefix();
    if (!left) {
      return undefined;
    }

    while (true) {
      left = this.parsePostfix(left);

      const token = this.peek();
      if (token.text === '?') {
        if (minPrecedence > 0) {
          return left;
        }

        this.consume();
        const whenTrue = this.parseExpression();
        if (!whenTrue) {
          return this.malformed(token, 'Expected expression after "?".');
        }

        const colon = this.peek();
        if (colon.text !== ':') {
          this.diagnostics.push({
            message: 'Expected ":" in conditional expression.',
            location: this.location(colon.start, colon.end)
          });
          return left;
        }
        this.consume();

        const whenFalse = this.parseExpression();
        if (!whenFalse) {
          return this.malformed(colon, 'Expected expression after ":".');
        }

        left = {
          kind: 'conditional',
          text: this.slice(left.location, whenFalse.location),
          location: this.join(left.location, whenFalse.location),
          condition: left,
          whenTrue,
          whenFalse
        };
        continue;
      }

      const precedence = BINARY_PRECEDENCE.get(token.text);
      if (precedence === undefined || precedence < minPrecedence) {
        return left;
      }

      this.consume();
      const right = this.parseExpression(precedence + 1);
      if (!right) {
        return this.malformed(token, `Expected expression after "${token.text}".`);
      }

      left = {
        kind: 'binary',
        text: this.slice(left.location, right.location),
        location: this.join(left.location, right.location),
        operator: token.text,
        left,
        right
      };
    }
  }

  private parsePrefix(): KickAssemblerExpressionNode | undefined {
    const token = this.peek();

    if (token.kind === 'operator' && UNARY_OPERATORS.has(token.text)) {
      this.consume();
      const operand = this.parseExpression(11);
      if (!operand) {
        return this.malformed(token, `Expected expression after unary "${token.text}".`);
      }

      return {
        kind: 'unary',
        text: this.slice(this.location(token.start, token.end), operand.location),
        location: this.join(this.location(token.start, token.end), operand.location),
        operator: token.text,
        operand
      };
    }

    if (token.text === '(') {
      this.consume();
      const expression = this.parseExpression();
      const close = this.peek();
      if (close.text === ')') {
        this.consume();
      } else {
        this.diagnostics.push({
          message: 'Expected ")" to close expression.',
          location: this.location(close.start, close.end)
        });
      }
      return expression;
    }

    if (token.text === '[') {
      return this.parseArray();
    }

    if (token.kind === 'number') {
      this.consume();
      return {
        kind: 'literal',
        literalKind: 'number',
        text: token.text,
        value: parseNumericLiteral(token.text),
        location: this.location(token.start, token.end)
      };
    }

    if (token.kind === 'string' || token.kind === 'character') {
      this.consume();
      return {
        kind: 'literal',
        literalKind: token.kind,
        text: token.text,
        value: unquote(token.text),
        location: this.location(token.start, token.end)
      };
    }

    if (token.kind === 'identifier') {
      this.consume();
      const lower = token.text.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        return {
          kind: 'literal',
          literalKind: 'boolean',
          text: token.text,
          value: lower === 'true',
          location: this.location(token.start, token.end)
        };
      }

      return {
        kind: 'identifier',
        text: token.text,
        name: token.text,
        location: this.location(token.start, token.end)
      };
    }

    if (token.kind === 'eof') {
      return undefined;
    }

    return this.malformed(token, `Unexpected token "${token.text}" in expression.`);
  }

  private parsePostfix(
    expression: KickAssemblerExpressionNode
  ): KickAssemblerExpressionNode {
    let current = expression;

    while (true) {
      const token = this.peek();

      if (token.text === '(') {
        this.consume();
        const args: KickAssemblerExpressionNode[] = [];
        while (this.peek().kind !== 'eof' && this.peek().text !== ')') {
          const arg = this.parseExpression();
          if (arg) {
            args.push(arg);
          }
          if (this.peek().text !== ',') {
            break;
          }
          this.consume();
        }

        const close = this.peek();
        if (close.text === ')') {
          this.consume();
        } else {
          this.diagnostics.push({
            message: 'Expected ")" to close call expression.',
            location: this.location(close.start, close.end)
          });
        }

        current = {
          kind: 'call',
          text: this.slice(current.location, this.location(close.start, close.end)),
          location: this.join(current.location, this.location(close.start, close.end)),
          callee: current,
          args
        };
        continue;
      }

      if (token.text === '[') {
        this.consume();
        const indexExpression = this.parseExpression();
        const close = this.peek();
        if (close.text === ']') {
          this.consume();
        } else {
          this.diagnostics.push({
            message: 'Expected "]" to close index expression.',
            location: this.location(close.start, close.end)
          });
        }

        if (!indexExpression) {
          return current;
        }

        current = {
          kind: 'index',
          text: this.slice(current.location, this.location(close.start, close.end)),
          location: this.join(current.location, this.location(close.start, close.end)),
          object: current,
          index: indexExpression
        };
        continue;
      }

      if (token.text === '.') {
        this.consume();
        const member = this.peek();
        if (member.kind !== 'identifier') {
          this.diagnostics.push({
            message: 'Expected member name after ".".',
            location: this.location(member.start, member.end)
          });
          return current;
        }
        this.consume();

        current = {
          kind: 'member',
          text: this.slice(current.location, this.location(member.start, member.end)),
          location: this.join(current.location, this.location(member.start, member.end)),
          object: current,
          member: member.text
        };
        continue;
      }

      return current;
    }
  }

  private parseArray(): KickAssemblerExpressionNode {
    const open = this.consume();
    const elements: KickAssemblerExpressionNode[] = [];

    while (this.peek().kind !== 'eof' && this.peek().text !== ']') {
      const element = this.parseExpression();
      if (element) {
        elements.push(element);
      }
      if (this.peek().text !== ',') {
        break;
      }
      this.consume();
    }

    const close = this.peek();
    if (close.text === ']') {
      this.consume();
    } else {
      this.diagnostics.push({
        message: 'Expected "]" to close array expression.',
        location: this.location(close.start, close.end)
      });
    }

    return {
      kind: 'array',
      text: this.text.slice(open.start, close.end),
      location: this.location(open.start, close.end),
      elements
    };
  }

  private malformed(
    token: ExpressionToken,
    message: string
  ): KickAssemblerMalformedExpression {
    const location = this.location(token.start, token.end);
    this.diagnostics.push({ message, location });
    if (token.kind !== 'eof') {
      this.consume();
    }

    return {
      kind: 'malformed',
      text: token.text,
      message,
      location
    };
  }

  private peek(): ExpressionToken {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1] as ExpressionToken;
  }

  private consume(): ExpressionToken {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private location(start: number, end: number): SourceLocation {
    return {
      uri: this.uri,
      range: {
        start: {
          line: this.line,
          character: this.column + start
        },
        end: {
          line: this.line,
          character: this.column + end
        }
      }
    };
  }

  private join(left: SourceLocation, right: SourceLocation): SourceLocation {
    return {
      uri: left.uri,
      range: {
        start: left.range.start,
        end: right.range.end
      }
    };
  }

  private slice(left: SourceLocation, right: SourceLocation): string {
    const start = Math.max(0, left.range.start.character - this.column);
    const end = Math.max(start, right.range.end.character - this.column);
    return this.text.slice(start, end);
  }
}

function tokenizeExpression(text: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let index = 0;

  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];

    if (!current) {
      break;
    }

    if (/\s/u.test(current)) {
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      const start = index;
      index += 1;
      while (index < text.length) {
        const character = text[index];
        if (character === '\\') {
          index += 2;
          continue;
        }
        index += 1;
        if (character === current) {
          break;
        }
      }
      tokens.push({
        kind: current === '"' ? 'string' : 'character',
        text: text.slice(start, index),
        start,
        end: index
      });
      continue;
    }

    if (current === '$') {
      const start = index;
      index += 1;
      while (/[0-9A-Fa-f]/u.test(text[index] ?? '')) {
        index += 1;
      }
      tokens.push({ kind: 'number', text: text.slice(start, index), start, end: index });
      continue;
    }

    if (current === '%') {
      const start = index;
      index += 1;
      while (/[01]/u.test(text[index] ?? '')) {
        index += 1;
      }
      tokens.push({ kind: 'number', text: text.slice(start, index), start, end: index });
      continue;
    }

    if (/[0-9]/u.test(current)) {
      const start = index;
      index += 1;
      while (/[0-9A-Fa-f_xX.]/u.test(text[index] ?? '')) {
        index += 1;
      }
      tokens.push({ kind: 'number', text: text.slice(start, index), start, end: index });
      continue;
    }

    if (isIdentifierStart(current)) {
      const start = index;
      index += 1;
      while (isIdentifierPart(text[index])) {
        index += 1;
      }
      tokens.push({
        kind: 'identifier',
        text: text.slice(start, index),
        start,
        end: index
      });
      continue;
    }

    const pair = `${current}${next ?? ''}`;
    if (TWO_CHARACTER_OPERATORS.has(pair)) {
      tokens.push({ kind: 'operator', text: pair, start: index, end: index + 2 });
      index += 2;
      continue;
    }

    if (SINGLE_CHARACTER_OPERATORS.has(current)) {
      tokens.push({ kind: 'operator', text: current, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (PUNCTUATION.has(current)) {
      tokens.push({
        kind: 'punctuation',
        text: current,
        start: index,
        end: index + 1
      });
      index += 1;
      continue;
    }

    tokens.push({
      kind: 'operator',
      text: current,
      start: index,
      end: index + 1
    });
    index += 1;
  }

  tokens.push({
    kind: 'eof',
    text: '',
    start: text.length,
    end: text.length
  });
  return tokens;
}

function parseNumericLiteral(text: string): number | undefined {
  const cleaned = text.replace(/_/gu, '');
  if (/^\$[0-9A-Fa-f]+$/u.test(cleaned)) {
    return Number.parseInt(cleaned.slice(1), 16);
  }
  if (/^%[01]+$/u.test(cleaned)) {
    return Number.parseInt(cleaned.slice(1), 2);
  }
  if (/^0x[0-9A-Fa-f]+$/u.test(cleaned)) {
    return Number.parseInt(cleaned.slice(2), 16);
  }
  if (/^[0-9]+(?:\.[0-9]+)?$/u.test(cleaned)) {
    return Number(cleaned);
  }
  return undefined;
}

function unquote(text: string): string {
  if (text.length >= 2) {
    return text.slice(1, -1);
  }
  return text;
}

function isIdentifierStart(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z_@!]/u.test(character));
}

function isIdentifierPart(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z0-9_@!]/u.test(character));
}
