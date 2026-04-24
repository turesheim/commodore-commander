export interface SidScoreSongMetadata {
  title?: string;
  author?: string;
  released?: string;
  subtune?: number;
}

export type SidScoreSubtuneSource = 'main' | 'inline' | 'import' | 'declared';

export interface SidScoreSubtuneInfo extends SidScoreSongMetadata {
  number: number;
  source: SidScoreSubtuneSource;
  path?: string;
}

export interface SidScoreSubtuneCatalog {
  defaultSubtune: number;
  subtunes: readonly SidScoreSubtuneInfo[];
}

const MAX_SUBTUNE_NUMBER = 255;

export function extractSidScoreSubtuneCatalog(
  sourceText: string
): SidScoreSubtuneCatalog {
  const codeMask = createCodeMask(sourceText);
  const tuneBlocks = findTuneBlocks(sourceText, codeMask);
  const firstTuneStart = tuneBlocks[0]?.start ?? sourceText.length;
  const topLevelSource = sourceText.slice(0, firstTuneStart);
  const subtunes = new Map<number, SidScoreSubtuneInfo>();

  subtunes.set(1, {
    number: 1,
    source: 'main',
    ...extractMetadata(topLevelSource)
  });

  for (const tuneBlock of tuneBlocks) {
    subtunes.set(tuneBlock.number, {
      number: tuneBlock.number,
      source: 'inline',
      ...extractMetadata(tuneBlock.body)
    });
  }

  for (const imported of findImportedSubtunes(sourceText)) {
    subtunes.set(imported.number, {
      number: imported.number,
      source: 'import',
      path: imported.path
    });
  }

  const declared = findDeclaredSubtuneHeader(sourceText);
  if (declared) {
    for (let number = 1; number <= declared.count; number += 1) {
      if (!subtunes.has(number)) {
        subtunes.set(number, {
          number,
          source: 'declared'
        });
      }
    }
  }

  const defaultSubtune =
    declared?.defaultSubtune && subtunes.has(declared.defaultSubtune)
      ? declared.defaultSubtune
      : 1;

  return {
    defaultSubtune,
    subtunes: [...subtunes.values()].sort((left, right) => left.number - right.number)
  };
}

export function extractSidScoreSongMetadata(
  sourceText: string,
  subtune = 1
): SidScoreSongMetadata | undefined {
  const catalog = extractSidScoreSubtuneCatalog(sourceText);
  const topLevel = catalog.subtunes.find((entry) => entry.number === 1);
  const selected = catalog.subtunes.find((entry) => entry.number === subtune);
  const metadata: SidScoreSongMetadata = {
    title: selected?.title ?? topLevel?.title,
    author: selected?.author ?? topLevel?.author,
    released: selected?.released ?? topLevel?.released
  };

  if (subtune > 1) {
    metadata.subtune = subtune;
  }

  return Object.values(metadata).some((value) => value !== undefined)
    ? metadata
    : undefined;
}

function createCodeMask(sourceText: string): string {
  const chars = sourceText.split('');
  let inString = false;
  let inComment = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (inComment) {
      if (char === '\n' || char === '\r') {
        inComment = false;
      } else {
        chars[index] = ' ';
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      chars[index] = char === '\n' || char === '\r' ? char : ' ';
      continue;
    }

    if (char === ';') {
      inComment = true;
      chars[index] = ' ';
      continue;
    }

    if (char === '"') {
      inString = true;
      chars[index] = ' ';
    }
  }

  return chars.join('');
}

function findTuneBlocks(
  sourceText: string,
  codeMask: string
): Array<{ number: number; start: number; body: string }> {
  const blocks: Array<{ number: number; start: number; body: string }> = [];
  const pattern = /\bTUNE\s+([0-9]+)\s*\{/giu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(codeMask))) {
    const number = normalizeSubtuneNumber(Number.parseInt(match[1], 10));
    const openBrace = codeMask.indexOf('{', pattern.lastIndex - 1);
    if (!number || openBrace < 0) {
      continue;
    }

    const closeBrace = findMatchingBrace(codeMask, openBrace);
    if (closeBrace < 0) {
      continue;
    }

    blocks.push({
      number,
      start: match.index,
      body: sourceText.slice(openBrace + 1, closeBrace)
    });
    pattern.lastIndex = closeBrace + 1;
  }

  return blocks;
}

function findMatchingBrace(codeMask: string, openBrace: number): number {
  let depth = 0;
  for (let index = openBrace; index < codeMask.length; index += 1) {
    const char = codeMask[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findImportedSubtunes(
  sourceText: string
): Array<{ number: number; path: string }> {
  const imports: Array<{ number: number; path: string }> = [];
  const pattern = /^\s*IMPORT\s+"((?:\\.|[^"\\])*)"\s+AS\s+([0-9]+)\b/gimu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(stripLineComments(sourceText)))) {
    const number = normalizeSubtuneNumber(Number.parseInt(match[2], 10));
    if (!number) {
      continue;
    }

    imports.push({
      number,
      path: decodeSidScoreString(match[1])
    });
  }

  return imports;
}

function findDeclaredSubtuneHeader(
  sourceText: string
): { count: number; defaultSubtune: number } | undefined {
  const match = /\b([0-9]+)\s+subtunes?\s*,\s*default\s+([0-9]+)\b/iu.exec(
    sourceText
  );
  const count = match ? normalizeSubtuneNumber(Number.parseInt(match[1], 10)) : undefined;
  const defaultSubtune = match
    ? normalizeSubtuneNumber(Number.parseInt(match[2], 10))
    : undefined;

  if (!count || !defaultSubtune) {
    return undefined;
  }

  return {
    count,
    defaultSubtune: Math.min(defaultSubtune, count)
  };
}

function extractMetadata(sourceText: string): SidScoreSongMetadata {
  return {
    ...metadataField(sourceText, 'TITLE', 'title'),
    ...metadataField(sourceText, 'AUTHOR', 'author'),
    ...metadataField(sourceText, 'RELEASED', 'released')
  };
}

function metadataField<K extends keyof SidScoreSongMetadata>(
  sourceText: string,
  keyword: string,
  property: K
): Pick<SidScoreSongMetadata, K> | undefined {
  const pattern = new RegExp(
    `^\\s*${keyword}\\s+"((?:\\\\.|[^"\\\\])*)"`,
    'imu'
  );
  const match = pattern.exec(stripLineComments(sourceText));
  if (!match?.[1]) {
    return undefined;
  }

  return {
    [property]: decodeSidScoreString(match[1])
  } as Pick<SidScoreSongMetadata, K>;
}

function stripLineComments(sourceText: string): string {
  const chars = sourceText.split('');
  let inString = false;
  let inComment = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (inComment) {
      if (char === '\n' || char === '\r') {
        inComment = false;
      } else {
        chars[index] = ' ';
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === ';') {
      inComment = true;
      chars[index] = ' ';
    }
  }

  return chars.join('');
}

function decodeSidScoreString(value: string): string {
  return value.replace(/\\(["\\])/gu, '$1').trim();
}

function normalizeSubtuneNumber(value: number): number | undefined {
  if (!Number.isInteger(value) || value < 1 || value > MAX_SUBTUNE_NUMBER) {
    return undefined;
  }
  return value;
}
