import { URI, type LangiumDocument } from 'langium';

import {
  createTextDocumentModel,
  type TextDocumentModel,
  type TextDocumentModelOptions
} from '../document/text-document-model.ts';
import {
  getKickAssemblerOutlineServices
} from '../langium/kick-assembler-outline-services.ts';
import type { OutlineFile } from '../langium/generated/ast.ts';

export interface KickAssemblerOutlineParseResult {
  document: LangiumDocument<OutlineFile>;
  model: OutlineFile;
}

export function parseKickAssemblerOutlineDocument(
  document: TextDocumentModel
): KickAssemblerOutlineParseResult {
  const services = getKickAssemblerOutlineServices();
  const normalizedText = document.text.endsWith('\n')
    ? document.text
    : `${document.text}\n`;
  const langiumDocument =
    services.shared.workspace.LangiumDocumentFactory.fromString<OutlineFile>(
      normalizedText,
      URI.parse(document.uri)
    );

  return {
    document: langiumDocument,
    model: langiumDocument.parseResult.value
  };
}

export function parseKickAssemblerOutlineText(
  options: TextDocumentModelOptions
): KickAssemblerOutlineParseResult {
  return parseKickAssemblerOutlineDocument(createTextDocumentModel(options));
}
