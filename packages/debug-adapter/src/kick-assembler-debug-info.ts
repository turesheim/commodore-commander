import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface KickAssemblerSourceEntry {
  index: number;
  path: string;
}

export interface KickAssemblerLineMapping {
  startAddress: number;
  endAddress: number;
  fileIndex: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface KickAssemblerDebugLabel {
  segment: string;
  address: number;
  name: string;
  fileIndex: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface KickAssemblerDebugInfo {
  sources: readonly KickAssemblerSourceEntry[];
  lineMappings: readonly KickAssemblerLineMapping[];
  labels: readonly KickAssemblerDebugLabel[];
  sourceRoots?: readonly string[];
}

export interface KickAssemblerDebugInfoOptions {
  sourceRoots?: readonly string[];
}

export async function loadKickAssemblerDebugInfo(
  debugInfoPath: string,
  options: KickAssemblerDebugInfoOptions = {}
): Promise<KickAssemblerDebugInfo> {
  const sourceRoots = uniquePaths([
    ...(options.sourceRoots ?? []),
    path.dirname(debugInfoPath),
    process.cwd()
  ]);
  return parseKickAssemblerDebugInfo(
    await readFile(debugInfoPath, 'utf8'),
    { sourceRoots }
  );
}

export function parseKickAssemblerDebugInfo(
  text: string,
  options: KickAssemblerDebugInfoOptions = {}
): KickAssemblerDebugInfo {
  const sourceRoots = uniquePaths(options.sourceRoots ?? []);
  return {
    sources: parseSources(extractTagBody(text, 'Sources')),
    lineMappings: parseLineMappings(text),
    labels: parseLabels(extractTagBody(text, 'Labels')),
    ...(sourceRoots.length > 0 ? { sourceRoots } : {})
  };
}

export function findLineMappingForSourceLine(
  debugInfo: KickAssemblerDebugInfo | undefined,
  sourcePath: string | undefined,
  line: number
): KickAssemblerLineMapping | undefined {
  if (!debugInfo || !sourcePath) {
    return undefined;
  }
  const source = sourceEntryForPath(debugInfo, sourcePath);
  if (!source) {
    return undefined;
  }

  const candidates = debugInfo.lineMappings
    .filter((mapping) =>
      mapping.fileIndex === source.index &&
      line >= mapping.startLine &&
      line <= mapping.endLine
    )
    .sort((left, right) =>
      Math.abs(left.startLine - line) - Math.abs(right.startLine - line) ||
      left.startAddress - right.startAddress
    );
  return candidates[0];
}

export function findLineMappingsForSourceRange(
  debugInfo: KickAssemblerDebugInfo | undefined,
  sourcePath: string | undefined,
  startLine: number,
  endLine = startLine
): KickAssemblerLineMapping[] {
  if (!debugInfo || !sourcePath) {
    return [];
  }
  const source = sourceEntryForPath(debugInfo, sourcePath);
  if (!source) {
    return [];
  }

  return debugInfo.lineMappings
    .filter((mapping) =>
      mapping.fileIndex === source.index &&
      mapping.startLine <= endLine &&
      mapping.endLine >= startLine
    )
    .sort((left, right) =>
      left.startLine - right.startLine ||
      left.startColumn - right.startColumn ||
      left.startAddress - right.startAddress
    );
}

export function findLineMappingForAddress(
  debugInfo: KickAssemblerDebugInfo | undefined,
  address: number
): KickAssemblerLineMapping | undefined {
  return debugInfo?.lineMappings.find(
    (mapping) =>
      address >= mapping.startAddress &&
      address <= mapping.endAddress
  );
}

export function findNearestLineMappingForAddress(
  debugInfo: KickAssemblerDebugInfo | undefined,
  address: number,
  maxDistance = 0x20
): KickAssemblerLineMapping | undefined {
  if (!debugInfo) {
    return undefined;
  }
  const exact = findLineMappingForAddress(debugInfo, address);
  if (exact) {
    return exact;
  }

  return debugInfo.lineMappings
    .map((mapping) => ({
      mapping,
      distance: address < mapping.startAddress
        ? mapping.startAddress - address
        : address - mapping.endAddress,
      // When two source rows are equally close, the preceding row is usually
      // a better call-stack landing point than the following instruction.
      afterAddress: mapping.startAddress > address
    }))
    .filter((candidate) => candidate.distance <= maxDistance)
    .sort((left, right) =>
      left.distance - right.distance ||
      Number(left.afterAddress) - Number(right.afterAddress) ||
      left.mapping.startAddress - right.mapping.startAddress
    )[0]?.mapping;
}

export function findSourceForMapping(
  debugInfo: KickAssemblerDebugInfo | undefined,
  mapping: KickAssemblerLineMapping | undefined
): KickAssemblerSourceEntry | undefined {
  if (!debugInfo || !mapping) {
    return undefined;
  }
  const source = debugInfo.sources.find((entry) => entry.index === mapping.fileIndex);
  return source
    ? {
        ...source,
        path: resolveDebugSourcePath(source.path, debugInfo.sourceRoots)
      }
    : undefined;
}

export function findLabelByName(
  debugInfo: KickAssemblerDebugInfo | undefined,
  name: string
): KickAssemblerDebugLabel | undefined {
  const normalized = name.trim().toLowerCase();
  return debugInfo?.labels.find((label) => label.name.toLowerCase() === normalized);
}

export function findLabelByAddress(
  debugInfo: KickAssemblerDebugInfo | undefined,
  address: number
): KickAssemblerDebugLabel | undefined {
  return debugInfo?.labels.find((label) => label.address === address);
}

export function findNearestLabelBeforeAddress(
  debugInfo: KickAssemblerDebugInfo | undefined,
  address: number,
  maxDistance = 0x1000
): KickAssemblerDebugLabel | undefined {
  if (!debugInfo) {
    return undefined;
  }
  const normalized = address & 0xffff;
  return debugInfo.labels
    .map((label) => ({
      label,
      distance: normalized - label.address
    }))
    .filter((candidate) =>
      candidate.distance >= 0 &&
      candidate.distance <= maxDistance
    )
    .sort((left, right) =>
      left.distance - right.distance ||
      left.label.name.localeCompare(right.label.name)
    )[0]?.label;
}

function parseSources(body: string): KickAssemblerSourceEntry[] {
  return body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const comma = line.indexOf(',');
      if (comma < 0) {
        return undefined;
      }
      const index = Number.parseInt(line.slice(0, comma), 10);
      const sourcePath = line.slice(comma + 1).trim();
      if (!Number.isFinite(index) || !sourcePath) {
        return undefined;
      }
      return {
        index,
        path: sourcePath
      };
    })
    .filter((entry): entry is KickAssemblerSourceEntry => Boolean(entry));
}

function parseLineMappings(text: string): KickAssemblerLineMapping[] {
  const mappings: KickAssemblerLineMapping[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!/^\$[0-9a-f]{1,4},\$[0-9a-f]{1,4},/iu.test(line)) {
      continue;
    }
    const columns = line.split(',').map((column) => column.trim());
    if (columns.length < 7) {
      continue;
    }
    mappings.push({
      startAddress: parseAddress(columns[0]),
      endAddress: parseAddress(columns[1]),
      fileIndex: parseDecimal(columns[2]),
      startLine: parseDecimal(columns[3]),
      startColumn: parseDecimal(columns[4]),
      endLine: parseDecimal(columns[5]),
      endColumn: parseDecimal(columns[6])
    });
  }
  return mappings;
}

function parseLabels(body: string): KickAssemblerDebugLabel[] {
  const labels: KickAssemblerDebugLabel[] = [];
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const columns = line.split(',').map((column) => column.trim());
    if (columns.length < 8 || !columns[1].startsWith('$')) {
      continue;
    }
    labels.push({
      segment: columns[0],
      address: parseAddress(columns[1]),
      name: columns[2],
      fileIndex: parseDecimal(columns[3]),
      startLine: parseDecimal(columns[4]),
      startColumn: parseDecimal(columns[5]),
      endLine: parseDecimal(columns[6]),
      endColumn: parseDecimal(columns[7])
    });
  }
  return labels;
}

function sourceEntryForPath(
  debugInfo: KickAssemblerDebugInfo,
  sourcePath: string
): KickAssemblerSourceEntry | undefined {
  const normalizedSourcePath = normalizePath(sourcePath);
  return debugInfo.sources.find((entry) =>
    sourcePathCandidates(entry.path, debugInfo.sourceRoots).some((candidate) =>
      normalizePath(candidate) === normalizedSourcePath
    )
  );
}

function extractTagBody(text: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'iu');
  return pattern.exec(text)?.[1] ?? '';
}

function parseAddress(value: string): number {
  return Number.parseInt(value.replace(/^\$/u, ''), 16);
}

function parseDecimal(value: string): number {
  return Number.parseInt(value, 10);
}

function sourcePathCandidates(
  sourcePath: string,
  sourceRoots: readonly string[] | undefined
): string[] {
  const candidates = [sourcePath];
  if (!hasUriScheme(sourcePath) && !path.isAbsolute(sourcePath)) {
    candidates.push(path.resolve(sourcePath));
    for (const sourceRoot of sourceRoots ?? []) {
      candidates.push(path.resolve(sourceRoot, sourcePath));
    }
  }
  return uniquePaths(candidates);
}

function resolveDebugSourcePath(
  sourcePath: string,
  sourceRoots: readonly string[] | undefined
): string {
  if (!sourcePath || hasUriScheme(sourcePath) || path.isAbsolute(sourcePath)) {
    return sourcePath;
  }
  return path.resolve(sourceRoots?.[0] ?? process.cwd(), sourcePath);
}

function normalizePath(sourcePath: string): string {
  if (!sourcePath || hasUriScheme(sourcePath)) {
    return sourcePath;
  }
  const normalized = path.normalize(sourcePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function hasUriScheme(sourcePath: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(sourcePath) &&
    !/^[A-Za-z]:[\\/]/u.test(sourcePath);
}

function uniquePaths(paths: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of paths) {
    if (!candidate) {
      continue;
    }
    const normalized = normalizePath(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(candidate);
  }
  return result;
}
