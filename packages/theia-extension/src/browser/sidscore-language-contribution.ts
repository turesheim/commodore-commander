import type { FrontendApplicationContribution } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { injectable } from '@theia/core/shared/inversify';
import type { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import type { GrammarDefinition, TextmateRegistry } from '@theia/monaco/lib/browser/textmate/textmate-registry';
import * as monaco from '@theia/monaco-editor-core';

import sidScoreGrammar from '@commodore-commander/language-support/syntaxes/sidscore.tmLanguage.json';
import sidScoreLanguageConfiguration from '@commodore-commander/language-support/syntaxes/sidscore.language-configuration.json';

export const SID_SCORE_LANGUAGE_ID = 'sidscore';
export const SID_SCORE_LANGUAGE_NAME = 'SIDScore';
export const SID_SCORE_SCOPE_NAME = 'source.sidscore';
export const SID_SCORE_FILE_EXTENSIONS = Object.freeze([
  '.sidscore'
]);

const SID_SCORE_FILE_EXTENSION_SET = new Set(SID_SCORE_FILE_EXTENSIONS);

const SID_SCORE_LANGUAGE_EXTENSION_POINT: monaco.languages.ILanguageExtensionPoint = {
  id: SID_SCORE_LANGUAGE_ID,
  aliases: [SID_SCORE_LANGUAGE_NAME, 'SID Score'],
  extensions: [...SID_SCORE_FILE_EXTENSIONS],
  mimetypes: ['text/x-sidscore']
};

const SID_SCORE_GRAMMAR_DEFINITION: GrammarDefinition = {
  format: 'json',
  content: sidScoreGrammar,
  location: 'sidscore.tmLanguage.json'
};

function toLanguageConfiguration(): monaco.languages.LanguageConfiguration {
  return {
    comments: {
      lineComment: sidScoreLanguageConfiguration.comments.lineComment
    },
    brackets: sidScoreLanguageConfiguration.brackets.map(([open, close]) => [open, close]),
    autoClosingPairs: sidScoreLanguageConfiguration.autoClosingPairs.map(([open, close]) => ({
      open,
      close
    })),
    surroundingPairs: sidScoreLanguageConfiguration.surroundingPairs.map(([open, close]) => ({
      open,
      close
    })),
    folding: {
      markers: {
        start: new RegExp(sidScoreLanguageConfiguration.folding.markers.start),
        end: new RegExp(sidScoreLanguageConfiguration.folding.markers.end)
      }
    }
  };
}

@injectable()
export class SidScoreLanguageContribution implements FrontendApplicationContribution, LanguageGrammarDefinitionContribution {
  protected readonly toDispose = new DisposableCollection();

  initialize(): void {
    if (!monaco.languages.getLanguages().some(language => language.id === SID_SCORE_LANGUAGE_ID)) {
      monaco.languages.register(SID_SCORE_LANGUAGE_EXTENSION_POINT);
    }

    monaco.languages.setLanguageConfiguration(SID_SCORE_LANGUAGE_ID, toLanguageConfiguration());

    for (const model of monaco.editor.getModels()) {
      this.ensureSidScoreLanguage(model);
    }

    this.toDispose.push(
      monaco.editor.onDidCreateModel((model) => {
        this.ensureSidScoreLanguage(model);
      })
    );
  }

  registerTextmateLanguage(registry: TextmateRegistry): void {
    registry.registerTextmateGrammarScope(SID_SCORE_SCOPE_NAME, {
      getGrammarDefinition: async () => SID_SCORE_GRAMMAR_DEFINITION
    });
    registry.mapLanguageIdToTextmateGrammar(
      SID_SCORE_LANGUAGE_ID,
      SID_SCORE_SCOPE_NAME
    );
  }

  onStop(): void {
    this.toDispose.dispose();
  }

  protected ensureSidScoreLanguage(model: monaco.editor.ITextModel): void {
    if (model.isDisposed()) {
      return;
    }

    if (!hasSidScoreExtension(new URI(model.uri.toString()))) {
      return;
    }

    if (model.getLanguageId() === SID_SCORE_LANGUAGE_ID) {
      return;
    }

    monaco.editor.setModelLanguage(model, SID_SCORE_LANGUAGE_ID);
  }
}

export function isSidScoreFileExtension(extension: string): boolean {
  return SID_SCORE_FILE_EXTENSION_SET.has(extension.toLowerCase());
}

function hasSidScoreExtension(resource: URI): boolean {
  return isSidScoreFileExtension(resource.path.ext);
}
