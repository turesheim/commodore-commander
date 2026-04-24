import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function pathToDocumentUri(filePath: string): string {
  return pathToFileURL(path.resolve(filePath)).href;
}

export function normalizeDocumentUri(uriOrPath: string): string {
  if (uriOrPath.includes('://')) {
    return new URL(uriOrPath).href;
  }
  return pathToDocumentUri(uriOrPath);
}

export function documentUriToPath(uri: string): string {
  const normalizedUri = normalizeDocumentUri(uri);
  const parsed = new URL(normalizedUri);

  if (parsed.protocol !== 'file:') {
    throw new TypeError(
      `Only file:// document URIs are supported in this pass: ${uri}`
    );
  }

  return fileURLToPath(parsed);
}

export function resolveDocumentUri(
  fromDocumentUri: string,
  relativePath: string
): string {
  const fromPath = documentUriToPath(fromDocumentUri);
  return pathToDocumentUri(path.resolve(path.dirname(fromPath), relativePath));
}
