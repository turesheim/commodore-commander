import type { FrontendApplicationContribution } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';

import {
  buildKickAssemblerOutline,
  createTextDocumentModel,
  type KickAssemblerOutlineSymbol
} from '@commodore-commander/language-support/runtime';
import {
  KICK_ASSEMBLER_FILE_EXTENSIONS,
  KICK_ASSEMBLER_LANGUAGE_ID
} from './kick-assembler-language-contribution';

@injectable()
export class KickAssemblerOutlineContribution
  implements FrontendApplicationContribution {
  protected readonly toDispose = new DisposableCollection();

  initialize(): void {
    this.toDispose.push(
      monaco.languages.registerDocumentSymbolProvider(
        KICK_ASSEMBLER_LANGUAGE_ID,
        {
          provideDocumentSymbols: async (model) => {
            if (!isKickAssemblerModel(model)) {
              return [];
            }

            try {
              const symbols = buildKickAssemblerOutline(
                createTextDocumentModel({
                  uri: model.uri.toString(),
                  text: model.getValue(),
                  languageId: model.getLanguageId(),
                  version: model.getVersionId()
                })
              );

              return symbols.map(toMonacoDocumentSymbol);
            } catch {
              return [];
            }
          }
        }
      )
    );
  }

  onStop(): void {
    this.toDispose.dispose();
  }
}

function hasKickAssemblerExtension(resource: URI): boolean {
  return KICK_ASSEMBLER_FILE_EXTENSIONS.includes(resource.path.ext.toLowerCase());
}

function isKickAssemblerModel(model: monaco.editor.ITextModel): boolean {
  if (model.getLanguageId() === KICK_ASSEMBLER_LANGUAGE_ID) {
    return true;
  }

  return hasKickAssemblerExtension(new URI(model.uri.toString()));
}

function toMonacoDocumentSymbol(
  symbol: KickAssemblerOutlineSymbol
): monaco.languages.DocumentSymbol {
  const { start, end } = symbol.location.range;
  const { start: nameStart, end: nameEnd } = symbol.selectionRange;

  return {
    name: symbol.name,
    detail: symbol.detail ?? '',
    kind: toMonacoSymbolKind(symbol.kind),
    range: new monaco.Range(
      start.line + 1,
      start.character + 1,
      end.line + 1,
      end.character + 1
    ),
    selectionRange: new monaco.Range(
      nameStart.line + 1,
      nameStart.character + 1,
      nameEnd.line + 1,
      nameEnd.character + 1
    ),
    children: symbol.children.map(toMonacoDocumentSymbol),
    tags: []
  };
}

function toMonacoSymbolKind(
  kind: KickAssemblerOutlineSymbol['kind']
): monaco.languages.SymbolKind {
  switch (kind) {
    case 'import':
      return monaco.languages.SymbolKind.File;
    case 'segment-definition':
      return monaco.languages.SymbolKind.Class;
    case 'segment':
      return monaco.languages.SymbolKind.Module;
    case 'program-counter':
      return monaco.languages.SymbolKind.Number;
    case 'namespace':
      return monaco.languages.SymbolKind.Namespace;
    case 'macro':
      return monaco.languages.SymbolKind.Method;
    case 'function':
      return monaco.languages.SymbolKind.Function;
    case 'pseudocommand':
      return monaco.languages.SymbolKind.Operator;
    case 'struct':
      return monaco.languages.SymbolKind.Struct;
    case 'enum':
      return monaco.languages.SymbolKind.Enum;
    case 'constant':
      return monaco.languages.SymbolKind.Constant;
    case 'variable':
      return monaco.languages.SymbolKind.Variable;
    case 'label':
      return monaco.languages.SymbolKind.Field;
  }

  return monaco.languages.SymbolKind.Field;
}
