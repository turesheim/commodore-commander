import { Disposable, DisposableCollection } from '@theia/core/lib/common';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import * as monaco from '@theia/monaco-editor-core';
import { StandaloneServices } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import {
  IHoverService
} from '@theia/monaco-editor-core/esm/vs/platform/hover/browser/hover';
import type { IHoverWidget } from '@theia/monaco-editor-core/esm/vs/base/browser/ui/hover/hover';

const HOVER_DELAY_MS = 250;
const SUPPORTED_TARGET_TYPES = new Set<number>([
  monaco.editor.MouseTargetType.CONTENT_EMPTY,
  monaco.editor.MouseTargetType.CONTENT_TEXT
]);

const HOVER_CONTENT_STYLE = `
.cc-reference-hover-content {
  max-width: min(72vw, 880px);
  max-height: min(60vh, 640px);
  overflow: auto;
  user-select: text;
}

.cc-reference-hover-content__body {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: 13px;
  line-height: 1.5;
}

.cc-reference-hover-content__body h3 {
  margin: 0 0 10px;
  font-size: 1em;
}

.cc-reference-hover-content__body p {
  margin: 0 0 10px;
}

.cc-reference-hover-content__body pre {
  overflow: auto;
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.12);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 12px;
  line-height: 1.45;
  white-space: pre;
}

.cc-reference-hover-content__body table {
  margin: 0 0 10px;
  border-collapse: collapse;
  max-width: 100%;
}

.cc-reference-hover-content__body th,
.cc-reference-hover-content__body td {
  padding: 4px 6px;
  border: 1px solid rgba(127, 127, 127, 0.28);
  text-align: left;
  vertical-align: top;
}

.cc-reference-hover-content__body code {
  font-family: var(--vscode-editor-font-family, monospace);
}

.cc-reference-hover-content__body a {
  color: var(--vscode-textLink-foreground, #3794ff);
}

.cc-reference-hover-content__body svg {
  display: block;
  max-width: 100%;
  height: auto;
}
`;

export interface KickAssemblerReferenceHoverRequest {
  anchor: monaco.Position;
  html: string;
  range: monaco.Range;
}

export type KickAssemblerReferenceHoverResolver = (
  model: monaco.editor.ITextModel,
  position: monaco.Position
) => Promise<KickAssemblerReferenceHoverRequest | undefined>;

export class KickAssemblerReferenceHoverWidget implements Disposable {
  protected readonly toDispose = new DisposableCollection();
  protected readonly control: monaco.editor.IStandaloneCodeEditor;
  protected readonly hoverService = StandaloneServices.get(IHoverService);

  protected activeRange: monaco.Range | undefined;
  protected activeHover: IHoverWidget | undefined;
  protected hoverDelayHandle: number | undefined;
  protected pendingRequestId = 0;

  constructor(
    protected readonly editor: MonacoEditor,
    protected readonly resolveHover: KickAssemblerReferenceHoverResolver
  ) {
    this.control = editor.getControl();
    this.bindEditorListeners();
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  protected bindEditorListeners(): void {
    this.toDispose.push(
      this.control.onMouseMove((event) => this.handleMouseMove(event))
    );
    this.toDispose.push(this.control.onMouseLeave(() => this.cancelPendingHover()));
    this.toDispose.push(
      this.control.onDidBlurEditorWidget(() => this.hide())
    );
    this.toDispose.push(
      this.control.onDidChangeCursorSelection(() => this.hide())
    );
    this.toDispose.push(this.control.onDidScrollChange(() => this.hide()));
    this.toDispose.push(this.control.onDidChangeModel(() => this.hide()));
    this.toDispose.push(this.control.onKeyDown(() => this.hide()));
    this.toDispose.push(this.editor.onDispose(() => this.dispose()));
    this.toDispose.push(
      Disposable.create(() => {
        this.clearTimers();
        this.disposeActiveHover();
      })
    );
  }

  protected handleMouseMove(event: monaco.editor.IEditorMouseEvent): void {
    const targetPosition = event.target.position;
    if (
      !targetPosition ||
      !SUPPORTED_TARGET_TYPES.has(event.target.type)
    ) {
      this.cancelPendingHover();
      return;
    }

    if (
      !this.activeHover?.isDisposed &&
      this.activeRange?.containsPosition(targetPosition)
    ) {
      return;
    }

    const model = this.control.getModel();
    if (!model) {
      this.hide();
      return;
    }

    const targetElement = event.target.element ?? event.event.target;
    const browserEvent = event.event.browserEvent;

    this.cancelPendingHover();
    const requestId = ++this.pendingRequestId;
    this.hoverDelayHandle = window.setTimeout(() => {
      void this.resolveAndShowHover(
        requestId,
        model,
        targetPosition,
        targetElement,
        browserEvent
      );
    }, HOVER_DELAY_MS);
  }

  protected async resolveAndShowHover(
    requestId: number,
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    targetElement: HTMLElement | null,
    browserEvent: MouseEvent
  ): Promise<void> {
    this.hoverDelayHandle = undefined;

    if (requestId !== this.pendingRequestId) {
      return;
    }

    const request = await this.resolveHover(model, position);
    if (requestId !== this.pendingRequestId) {
      return;
    }

    if (!request || !targetElement) {
      this.hide();
      return;
    }

    this.pendingRequestId = 0;
    this.activeRange = request.range;
    this.disposeActiveHover();
    this.activeHover = this.hoverService.showHover({
      content: createHoverContentElement(request.html),
      target: {
        targetElements: [targetElement],
        x: browserEvent.pageX,
        y: browserEvent.pageY
      },
      container: this.control.getDomNode() ?? undefined,
      position: {
        hoverPosition: browserEvent
      },
      persistence: {
        sticky: true,
        hideOnHover: false,
        hideOnKeyDown: true
      },
      appearance: {
        showPointer: true
      }
    });
  }

  async showAtPosition(position: monaco.Position): Promise<boolean> {
    const model = this.control.getModel();
    if (!model) {
      this.hide();
      return false;
    }

    const request = await this.resolveHover(model, position);
    if (!request) {
      this.hide();
      return false;
    }

    this.pendingRequestId = 0;
    this.activeRange = request.range;
    this.disposeActiveHover();

    const targetElement = this.control.getDomNode();
    if (!targetElement) {
      return false;
    }

    const visiblePosition = this.control.getScrolledVisiblePosition(position);
    const targetRect = targetElement.getBoundingClientRect();
    const x = visiblePosition
      ? targetRect.left + visiblePosition.left + 4
      : targetRect.left + 24;
    const y = visiblePosition
      ? targetRect.top + visiblePosition.top + visiblePosition.height / 2
      : targetRect.top + 24;
    const hoverPosition = new MouseEvent('mousemove', {
      bubbles: true,
      clientX: x,
      clientY: y
    });

    this.activeHover = this.hoverService.showHover({
      content: createHoverContentElement(request.html),
      target: {
        targetElements: [targetElement],
        x,
        y
      },
      container: targetElement,
      position: {
        hoverPosition
      },
      persistence: {
        sticky: true,
        hideOnHover: false,
        hideOnKeyDown: true
      },
      appearance: {
        showPointer: true
      }
    });

    return Boolean(this.activeHover);
  }

  protected cancelPendingHover(): void {
    if (this.hoverDelayHandle !== undefined) {
      window.clearTimeout(this.hoverDelayHandle);
      this.hoverDelayHandle = undefined;
    }
    this.pendingRequestId += 1;
  }

  protected clearTimers(): void {
    if (this.hoverDelayHandle !== undefined) {
      window.clearTimeout(this.hoverDelayHandle);
      this.hoverDelayHandle = undefined;
    }
  }

  protected disposeActiveHover(): void {
    this.activeHover?.dispose();
    this.activeHover = undefined;
  }

  protected hide(): void {
    this.cancelPendingHover();
    this.activeRange = undefined;
    this.disposeActiveHover();
  }
}

function createHoverContentElement(html: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cc-reference-hover-content';

  const style = document.createElement('style');
  style.textContent = HOVER_CONTENT_STYLE;

  const body = document.createElement('div');
  body.className = 'cc-reference-hover-content__body';
  body.innerHTML = html;

  root.append(style, body);
  return root;
}
