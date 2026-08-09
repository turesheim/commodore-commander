import type {
  KickAssemblerLookupOccurrence,
  KickAssemblerLookupResult
} from './kick-assembler-lookup-service.ts';

const CDATA_PATTERN = /<!\[CDATA\[([\s\S]*?)\]\]>/gu;
const SVG_PATTERN = /<svg\b[\s\S]*?<\/svg>/u;
const TABLE_PATTERN = /<table\b[^>]*>([\s\S]*?)<\/table>/u;
const PRE_PATTERN = /<pre\b[^>]*>([\s\S]*?)<\/pre>/u;
const LINK_PATTERN = /<a\b[^>]*>([\s\S]*?)<\/a>/u;
const TAG_PATTERN = /<[^>]+>/u;

export interface KickAssemblerHoverContent {
  value: string;
  supportHtml: boolean;
}

export function createLookupHoverContent(
  lookup: KickAssemblerLookupResult
): KickAssemblerHoverContent | undefined {
  const primaryDeclaration = lookup.declarations[0];
  if (!primaryDeclaration) {
    return undefined;
  }

  if (lookup.queryOrigin === 'reference') {
    return createReferenceHoverContent(primaryDeclaration);
  }

  if (!primaryDeclaration.detail) {
    return undefined;
  }

  return {
    value: [
      `**\`${primaryDeclaration.name}\`**`,
      escapeMarkdownText(
        `${humanizeKind(primaryDeclaration.kind)} - ${primaryDeclaration.detail}`
      )
    ].join('\n\n'),
    supportHtml: false
  };
}

export function formatReferenceDescriptionAsHtml(
  description: string | undefined
): string | undefined {
  if (!description) {
    return undefined;
  }

  let value = unwrapCdata(description);
  value = decodeHtmlEntities(value).trim();

  if (value.length === 0) {
    return undefined;
  }

  if (containsHtmlMarkup(value)) {
    return value;
  }

  if (looksPreformatted(value)) {
    return `<pre>${escapeHtml(value)}</pre>`;
  }

  return value
    .split(/\n{2,}/u)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join('\n');
}

function createReferenceHoverContent(
  declaration: KickAssemblerLookupOccurrence
): KickAssemblerHoverContent {
  if (isKickAssemblerDirectiveKind(declaration.kind)) {
    return createDirectiveHoverContent(declaration);
  }

  const sections = [
    `<h3><code>${escapeHtml(declaration.name)}</code></h3>`
  ];

  if (declaration.detail) {
    sections.push(`<p>${escapeHtml(declaration.detail)}</p>`);
  }

  const description = formatReferenceDescriptionAsHtml(
    declaration.description
  );
  if (description) {
    sections.push(description);
  }

  return {
    value: sections.join('\n\n'),
    supportHtml: true
  };
}

function createDirectiveHoverContent(
  declaration: KickAssemblerLookupOccurrence
): KickAssemblerHoverContent {
  const signature = [declaration.name, declaration.syntax]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(' ');
  const sections = [
    `<h3><code>${escapeHtml(signature)}</code></h3>`
  ];
  const explanation = formatReferenceDescriptionAsHtml(
    declaration.description
  );
  if (explanation) {
    sections.push(explanation);
  }

  return {
    value: sections.join('\n\n'),
    supportHtml: true
  };
}

function unwrapCdata(value: string): string {
  return value.replace(CDATA_PATTERN, '$1');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function containsHtmlMarkup(value: string): boolean {
  return (
    PRE_PATTERN.test(value) ||
    TABLE_PATTERN.test(value) ||
    SVG_PATTERN.test(value) ||
    LINK_PATTERN.test(value) ||
    TAG_PATTERN.test(value)
  );
}

function looksPreformatted(value: string): boolean {
  return /\n/u.test(value) || /^\s+/u.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!])/gu, '\\$1');
}

function isKickAssemblerDirectiveKind(
  kind: KickAssemblerLookupOccurrence['kind']
): boolean {
  return kind === 'kickassembler-directive' ||
    kind === 'kickassembler-preprocessor-directive';
}

function humanizeKind(kind: KickAssemblerLookupOccurrence['kind']): string {
  switch (kind) {
    case 'constant':
      return 'constant';
    case 'variable':
      return 'variable';
    case 'label':
      return 'label';
    case 'local-label':
      return 'local label';
    case 'anonymous-label':
      return 'anonymous label';
    case 'parameter':
      return 'parameter';
    case 'namespace':
      return 'namespace';
    case 'macro':
      return 'macro';
    case 'function':
      return 'function';
    case 'pseudocommand':
      return 'pseudocommand';
    case 'struct':
      return 'struct';
    case 'enum':
      return 'enum';
    case 'enum-member':
      return 'enum member';
    case 'segment':
      return 'segment';
    case 'segment-definition':
      return 'segment definition';
    case 'for-variable':
      return 'loop variable';
    case 'generated':
      return 'generated symbol';
    case '6502-mnemonic':
      return '6502 mnemonic';
    case 'c64-io-address':
      return 'C64 I/O address';
    case 'c64-io-id':
      return 'C64 I/O symbol';
    case 'kickassembler-directive':
      return 'Kick Assembler directive';
    case 'kickassembler-preprocessor-directive':
      return 'Kick Assembler preprocessor directive';
    case 'machine-io-address':
      return 'machine I/O address';
    case 'machine-io-id':
      return 'machine I/O symbol';
    case 'machine-memory-address':
      return 'machine memory address';
    case 'machine-rom-symbol':
      return 'machine ROM symbol';
    case 'machine-zero-page':
      return 'machine zero-page convention';
  }
}
