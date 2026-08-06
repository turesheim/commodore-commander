import type { FrontendApplicationContribution } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';

import {
  buildSidScoreOutline,
  createTextDocumentModel,
  type SidScoreOutlineSymbol
} from '@commodore-commander/language-support/runtime';
import {
  SID_SCORE_FILE_EXTENSIONS,
  SID_SCORE_LANGUAGE_ID
} from './sidscore-language-contribution';

@injectable()
export class SidScoreOutlineContribution
  implements FrontendApplicationContribution {
  protected readonly toDispose = new DisposableCollection();

  initialize(): void {
    this.toDispose.push(
      monaco.languages.registerDocumentSymbolProvider(
        SID_SCORE_LANGUAGE_ID,
        {
          provideDocumentSymbols: async (model) => {
            if (!isSidScoreModel(model)) {
              return [];
            }

            try {
              const symbols = buildSidScoreOutline(
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

function hasSidScoreExtension(resource: URI): boolean {
  return SID_SCORE_FILE_EXTENSIONS.includes(resource.path.ext.toLowerCase());
}

function isSidScoreModel(model: monaco.editor.ITextModel): boolean {
  if (model.getLanguageId() === SID_SCORE_LANGUAGE_ID) {
    return true;
  }

  return hasSidScoreExtension(new URI(model.uri.toString()));
}

function toMonacoDocumentSymbol(
  symbol: SidScoreOutlineSymbol
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
  kind: SidScoreOutlineSymbol['kind']
): monaco.languages.SymbolKind {
  switch (kind) {
    case 'subtune':
      return monaco.languages.SymbolKind.Module;
    case 'effect':
      return monaco.languages.SymbolKind.Event;
  }
}
