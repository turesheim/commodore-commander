import type { FrontendApplicationContribution } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { injectable } from '@theia/core/shared/inversify';
import type { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import type { GrammarDefinition, TextmateRegistry } from '@theia/monaco/lib/browser/textmate/textmate-registry';
import * as monaco from '@theia/monaco-editor-core';

import kickAssemblerGrammar from '@commodore-commander/language-support/syntaxes/kickassembler.tmLanguage.json';
import kickAssemblerLanguageConfiguration from '@commodore-commander/language-support/syntaxes/kickassembler.language-configuration.json';

import {
  isKickAssemblerFileExtension,
  KICK_ASSEMBLER_FILE_EXTENSIONS
} from './kick-assembler-file-associations';

export { KICK_ASSEMBLER_FILE_EXTENSIONS } from './kick-assembler-file-associations';

export const KICK_ASSEMBLER_LANGUAGE_ID = 'kickassembler';
export const KICK_ASSEMBLER_LANGUAGE_NAME = 'Kick Assembler';
export const KICK_ASSEMBLER_SCOPE_NAME = 'source.assembly.kickassembler';

const KICK_ASSEMBLER_LANGUAGE_EXTENSION_POINT: monaco.languages.ILanguageExtensionPoint = {
  id: KICK_ASSEMBLER_LANGUAGE_ID,
  aliases: [KICK_ASSEMBLER_LANGUAGE_NAME, 'KickAssembler'],
  extensions: [...KICK_ASSEMBLER_FILE_EXTENSIONS],
  mimetypes: ['text/x-kickassembler']
};

const KICK_ASSEMBLER_GRAMMAR_DEFINITION: GrammarDefinition = {
  format: 'json',
  content: kickAssemblerGrammar,
  location: 'kickassembler.tmLanguage.json'
};

function toLanguageConfiguration(): monaco.languages.LanguageConfiguration {
  return {
    comments: {
      lineComment: kickAssemblerLanguageConfiguration.comments.lineComment,
      blockComment: [
        kickAssemblerLanguageConfiguration.comments.blockComment[0],
        kickAssemblerLanguageConfiguration.comments.blockComment[1]
      ]
    },
    brackets: kickAssemblerLanguageConfiguration.brackets.map(([open, close]) => [open, close]),
    autoClosingPairs: kickAssemblerLanguageConfiguration.autoClosingPairs.map(pair => (
      Array.isArray(pair)
        ? {
            open: pair[0],
            close: pair[1]
          }
        : {
            open: pair.open,
            close: pair.close,
            notIn: pair.notIn
          }
    )),
    surroundingPairs: kickAssemblerLanguageConfiguration.surroundingPairs.map(([open, close]) => ({
      open,
      close
    })),
    folding: {
      markers: {
        start: new RegExp(kickAssemblerLanguageConfiguration.folding.markers.start),
        end: new RegExp(kickAssemblerLanguageConfiguration.folding.markers.end)
      }
    }
  };
}

@injectable()
export class KickAssemblerLanguageContribution implements FrontendApplicationContribution, LanguageGrammarDefinitionContribution {
  protected readonly toDispose = new DisposableCollection();

  initialize(): void {
    if (!monaco.languages.getLanguages().some(language => language.id === KICK_ASSEMBLER_LANGUAGE_ID)) {
      monaco.languages.register(KICK_ASSEMBLER_LANGUAGE_EXTENSION_POINT);
    }

    monaco.languages.setLanguageConfiguration(KICK_ASSEMBLER_LANGUAGE_ID, toLanguageConfiguration());

    for (const model of monaco.editor.getModels()) {
      this.ensureKickAssemblerLanguage(model);
    }

    this.toDispose.push(
      monaco.editor.onDidCreateModel((model) => {
        this.ensureKickAssemblerLanguage(model);
      })
    );
  }

  registerTextmateLanguage(registry: TextmateRegistry): void {
    registry.registerTextmateGrammarScope(KICK_ASSEMBLER_SCOPE_NAME, {
      getGrammarDefinition: async () => KICK_ASSEMBLER_GRAMMAR_DEFINITION
    });
    registry.mapLanguageIdToTextmateGrammar(
      KICK_ASSEMBLER_LANGUAGE_ID,
      KICK_ASSEMBLER_SCOPE_NAME
    );
  }

  onStop(): void {
    this.toDispose.dispose();
  }

  protected ensureKickAssemblerLanguage(model: monaco.editor.ITextModel): void {
    if (model.isDisposed()) {
      return;
    }

    if (!hasKickAssemblerExtension(new URI(model.uri.toString()))) {
      return;
    }

    if (model.getLanguageId() === KICK_ASSEMBLER_LANGUAGE_ID) {
      return;
    }

    monaco.editor.setModelLanguage(model, KICK_ASSEMBLER_LANGUAGE_ID);
  }
}

function hasKickAssemblerExtension(resource: URI): boolean {
  return isKickAssemblerFileExtension(resource.path.ext);
}

// TODO(theia-ts-migration): Replace these mirrored language identifiers with a
// runtime-safe manifest export from `packages/language-support`.
