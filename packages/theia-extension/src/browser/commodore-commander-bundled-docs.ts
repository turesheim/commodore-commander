import {
  FrontendApplicationContribution,
  WidgetOpenerOptions
} from '@theia/core/lib/browser';
import {
  CommonMenus
} from '@theia/core/lib/browser/common-frontend-contribution';
import {
  defaultHandlerPriority,
  OpenHandler,
  OpenerService,
  open
} from '@theia/core/lib/browser/opener-service';
import {
  CommandContribution,
  CommandRegistry,
  MenuContribution,
  MenuModelRegistry,
  Resource,
  ResourceResolver
} from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
  MiniBrowserEnvironment
} from '@theia/mini-browser/lib/browser/environment/mini-browser-environment';
import {
  EditorManager,
  EditorWidget
} from '@theia/editor/lib/browser';
import {
  EditorPreferences
} from '@theia/editor/lib/common/editor-preferences';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import {
  PreviewUri
} from '@theia/preview/lib/browser';
import { MarkdownPreviewHandler } from '@theia/preview/lib/browser/markdown/markdown-preview-handler';
import { PreviewContribution } from '@theia/preview/lib/browser/preview-contribution';
import {
  PreviewHandler,
  RenderContentParams
} from '@theia/preview/lib/browser/preview-handler';
import {
  PreviewLinkNormalizer
} from '@theia/preview/lib/browser/preview-link-normalizer';

export const BUNDLED_DOCUMENTATION_SCHEME = 'cc-doc';
const BUNDLED_DOCUMENTATION_ASSET_ROOT = 'assets/docs/';
const BUNDLED_DOCUMENTATION_MENU = [...CommonMenus.HELP, '8_cc_docs'];
const BUNDLED_DOCUMENTATION_COMMAND_PREFIX =
  'commodoreCommander.documentation.open.';

export interface BundledDocumentationEntry {
  readonly path: string;
  readonly label: string;
  readonly details: string;
}

// Keep this manifest in sync with the root bundled-docs directory.
export const BUNDLED_DOCUMENTS: readonly BundledDocumentationEntry[] = [
  {
    path: 'build-configuration.md',
    label: 'Build Configuration',
    details: 'How to configure profiles, targets and launching'
  },
  {
    path: 'character-set-format.md',
    label: 'Character Set Format',
    details: 'Native charset JSON layout and export formats'
  },
  {
    path: 'introduction_to_sidscore.md',
    label: 'Introduction to SIDScore',
    details: 'Synthesizer and SID background for SIDScore instruments'
  },
  {
    path: 'ADSR_parameter.svg',
    label: 'ADSR Parameter Diagram',
    details: 'Envelope parameter diagram used by the SIDScore introduction'
  }
];

export function bundledDocumentationUri(relativePath: string): URI {
  return new URI(
    `${BUNDLED_DOCUMENTATION_SCHEME}:/${encodeBundledDocumentationPath(
      normalizeBundledDocumentationPath(relativePath)
    )}`
  );
}

export function openBundledDocumentationPreview(
  openerService: OpenerService,
  relativePath: string
): Promise<object | undefined> {
  return open(openerService, bundledDocumentationUri(relativePath), {
    mode: 'activate'
  });
}

@injectable()
export class CommodoreCommanderBundledDocumentationContribution
  implements CommandContribution, MenuContribution {
  @inject(OpenerService)
  protected readonly openerService!: OpenerService;

  registerCommands(commands: CommandRegistry): void {
    for (const document of BUNDLED_DOCUMENTS) {
      commands.registerCommand(
        {
          id: bundledDocumentationCommandId(document.path),
          category: 'Commodore Commander Help',
          label: document.label,
          iconClass: documentationIconClass(document.path)
        },
        {
          execute: () =>
            openBundledDocumentationPreview(
              this.openerService,
              document.path
            ),
          isEnabled: () => true,
          isVisible: () => true
        }
      );
    }
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerSubmenu(
      BUNDLED_DOCUMENTATION_MENU,
      'Commodore Commander Documentation',
      {
        sortString: '8'
      }
    );

    BUNDLED_DOCUMENTS.forEach((document, index) => {
      menus.registerMenuAction(BUNDLED_DOCUMENTATION_MENU, {
        commandId: bundledDocumentationCommandId(document.path),
        label: document.label,
        icon: documentationIconClass(document.path),
        order: index.toString().padStart(2, '0')
      });
    });
  }
}

@injectable()
export class CommodoreCommanderBundledDocumentationResourceResolver
  implements ResourceResolver {
  resolve(uri: URI): Resource {
    if (uri.scheme !== BUNDLED_DOCUMENTATION_SCHEME) {
      throw new Error(
        `Expected ${BUNDLED_DOCUMENTATION_SCHEME}: URI. Was: ${uri.toString()}.`
      );
    }

    return new CommodoreCommanderBundledDocumentationResource(
      uri,
      bundledDocumentationPathFromUri(uri)
    );
  }
}

@injectable()
export class CommodoreCommanderBundledDocumentationPreviewHandler
  extends MarkdownPreviewHandler {
  override canHandle(uri: URI): number {
    return isBundledDocumentationUri(uri) &&
      isBundledMarkdownDocumentationPath(uri.path.toString())
        ? 600
        : 0;
  }
}

@injectable()
export class CommodoreCommanderBundledDocumentationImagePreviewHandler
  implements PreviewHandler {
  readonly iconClass = 'codicon codicon-file-media';

  canHandle(uri: URI): number {
    return isBundledDocumentationUri(uri) &&
      isBundledImageDocumentationPath(uri.path.toString())
        ? 600
        : 0;
  }

  renderContent(params: RenderContentParams): HTMLElement {
    const container = document.createElement('div');
    container.style.alignItems = 'center';
    container.style.boxSizing = 'border-box';
    container.style.display = 'flex';
    container.style.height = '100%';
    container.style.justifyContent = 'center';
    container.style.padding = '24px';

    const image = document.createElement('img');
    image.alt = params.originUri.path.base;
    image.src = bundledDocumentationAssetUrl(
      bundledDocumentationPathFromUri(params.originUri)
    );
    image.style.maxHeight = '100%';
    image.style.maxWidth = '100%';
    image.style.objectFit = 'contain';

    container.appendChild(image);
    return container;
  }
}

@injectable()
export class CommodoreCommanderBundledDocumentationLinkNormalizer
  extends PreviewLinkNormalizer {
  @inject(MiniBrowserEnvironment)
  protected override readonly miniBrowserEnvironment!: MiniBrowserEnvironment;

  override normalizeLink(documentUri: URI, link: string): string {
    if (isBundledDocumentationUri(documentUri)) {
      const bundledAssetUrl = resolveBundledDocumentationAssetLink(
        documentUri,
        link
      );
      if (bundledAssetUrl) {
        return bundledAssetUrl;
      }
    }

    return super.normalizeLink(documentUri, link);
  }
}

@injectable()
export class CommodoreCommanderBundledDocumentationOpenHandler
  implements OpenHandler {
  readonly id = 'cc-doc-preview';
  readonly label = 'Commodore Commander Documentation';

  @inject(PreviewContribution)
  protected readonly previewContribution!: PreviewContribution;

  canHandle(uri: URI): number {
    return isBundledDocumentationUri(uri) ? defaultHandlerPriority + 1 : 0;
  }

  open(
    uri: URI,
    options?: WidgetOpenerOptions
  ): Promise<object | undefined> {
    return this.previewContribution.open(PreviewUri.encode(uri), {
      mode: 'activate',
      ...options
    });
  }
}

@injectable()
export class CommodoreCommanderBundledDocumentationEditorContribution
  implements FrontendApplicationContribution {
  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(EditorPreferences)
  protected readonly editorPreferences!: EditorPreferences;

  onStart(): void {
    this.editorManager.onCreated(widget => this.disableMinimap(widget));
    this.disableMinimapForOpenDocumentationEditors();
    this.editorPreferences.onPreferenceChanged(() => {
      window.setTimeout(
        () => this.disableMinimapForOpenDocumentationEditors(),
        0
      );
    });
  }

  protected disableMinimapForOpenDocumentationEditors(): void {
    for (const widget of this.editorManager.all) {
      this.disableMinimap(widget);
    }
  }

  protected disableMinimap(widget: EditorWidget): void {
    const editor = MonacoEditor.get(widget);
    if (!editor || !isBundledDocumentationUri(editor.uri)) {
      return;
    }

    editor.getControl().updateOptions({ minimap: { enabled: false } });
  }
}

function bundledDocumentationCommandId(relativePath: string): string {
  const commandSuffix = normalizeBundledDocumentationPath(relativePath)
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();

  return `${BUNDLED_DOCUMENTATION_COMMAND_PREFIX}${commandSuffix}`;
}

class CommodoreCommanderBundledDocumentationResource implements Resource {
  readonly readOnly = true;
  readonly autosaveable = false;

  constructor(
    readonly uri: URI,
    protected readonly relativePath: string
  ) {}

  dispose(): void {}

  async readContents(): Promise<string> {
    const response = await fetch(this.assetUrl(), { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(
        `Unable to load bundled documentation '${this.relativePath}' ` +
          `(${response.status} ${response.statusText}).`
      );
    }

    return response.text();
  }

  protected assetUrl(): string {
    return bundledDocumentationAssetUrl(this.relativePath);
  }
}

function isBundledDocumentationUri(uri: URI): boolean {
  return uri.scheme === BUNDLED_DOCUMENTATION_SCHEME;
}

function isBundledMarkdownDocumentationPath(relativePath: string): boolean {
  return /\.(md|markdown)$/iu.test(relativePath);
}

function isBundledImageDocumentationPath(relativePath: string): boolean {
  return /\.(svg|png|jpe?g|gif|webp)$/iu.test(relativePath);
}

function documentationIconClass(relativePath: string): string {
  return isBundledImageDocumentationPath(relativePath)
    ? 'codicon codicon-file-media'
    : 'codicon codicon-book';
}

function bundledDocumentationPathFromUri(uri: URI): string {
  return normalizeBundledDocumentationPath(uri.path.toString());
}

function normalizeBundledDocumentationPath(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '');
  const segments = normalized.split('/');

  if (
    !normalized ||
    segments.some(
      segment =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('\\') ||
        /[\u0000-\u001f]/u.test(segment)
    )
  ) {
    throw new Error(
      `Invalid bundled documentation path '${relativePath}'.`
    );
  }

  return normalized;
}

function encodeBundledDocumentationPath(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}

function bundledDocumentationAssetUrl(relativePath: string): string {
  return new URL(
    BUNDLED_DOCUMENTATION_ASSET_ROOT +
      encodeBundledDocumentationPath(
        normalizeBundledDocumentationPath(relativePath)
      ),
    window.location.href
  ).toString();
}

function resolveBundledDocumentationAssetLink(
  documentUri: URI,
  link: string
): string | undefined {
  const parsed = parseRelativeDocumentationLink(link);
  if (!parsed) {
    return undefined;
  }

  try {
    const relativePath = normalizeBundledDocumentationPath(
      documentUri.parent.resolve(parsed.path).path.toString()
    );
    return `${bundledDocumentationAssetUrl(relativePath)}${parsed.suffix}`;
  } catch {
    return undefined;
  }
}

function parseRelativeDocumentationLink(
  link: string
): { path: string; suffix: string } | undefined {
  const trimmed = link.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/iu.test(trimmed)
  ) {
    return undefined;
  }

  const match = /^([^?#]*)(.*)$/u.exec(trimmed);
  const path = match?.[1];
  if (!path) {
    return undefined;
  }

  return {
    path,
    suffix: match?.[2] ?? ''
  };
}
