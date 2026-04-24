import { readFile } from 'node:fs/promises';

import { TextDocumentModel } from '../document/text-document-model.ts';
import {
  normalizeDocumentUri,
  pathToDocumentUri,
  documentUriToPath
} from './document-uri.ts';

export interface DocumentLoader {
  load(uri: string): Promise<TextDocumentModel>;
  loadFromPath(filePath: string): Promise<TextDocumentModel>;
}

export class FileSystemDocumentLoader implements DocumentLoader {
  async load(uri: string): Promise<TextDocumentModel> {
    const normalizedUri = normalizeDocumentUri(uri);
    const filePath = documentUriToPath(normalizedUri);
    const text = await readFile(filePath, 'utf8');

    return new TextDocumentModel({
      uri: normalizedUri,
      text
    });
  }

  async loadFromPath(filePath: string): Promise<TextDocumentModel> {
    return this.load(pathToDocumentUri(filePath));
  }
}
