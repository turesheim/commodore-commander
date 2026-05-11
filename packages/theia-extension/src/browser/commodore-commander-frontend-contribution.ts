import {
  FrontendApplication,
  FrontendApplicationContribution,
  TreeNode
} from '@theia/core/lib/browser';
import { TreeElementNode } from '@theia/core/lib/browser/source-tree';
import { DebugStackFrame } from '@theia/debug/lib/browser/model/debug-stack-frame';
import { DebugStackFramesWidget } from '@theia/debug/lib/browser/view/debug-stack-frames-widget';
import { injectable } from '@theia/core/shared/inversify';

import {
  COMMODORE_COMMANDER_APPLICATION_ID,
  ensureCommodoreCommanderBranding
} from './commodore-commander-branding';

const STACK_FRAME_TAP_PATCHED = Symbol.for(
  'commodoreCommander.debugStackFrameTapPatched'
);

interface StackFramesWidgetTapPatch {
  [STACK_FRAME_TAP_PATCHED]?: true;
  model: {
    selectedNodes: readonly TreeNode[];
  };
  updateModelSelection: () => void | Promise<void>;
}

@injectable()
export class CommodoreCommanderFrontendContribution implements FrontendApplicationContribution {
  onStart(_app: FrontendApplication): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.document.body.dataset.applicationId = COMMODORE_COMMANDER_APPLICATION_ID;
    ensureCommodoreCommanderBranding(window.document);
    this.patchDebugStackFrameTap();
  }

  protected patchDebugStackFrameTap(): void {
    const prototype = DebugStackFramesWidget.prototype as unknown as StackFramesWidgetTapPatch;
    if (prototype[STACK_FRAME_TAP_PATCHED]) {
      return;
    }

    const originalUpdateModelSelection = prototype.updateModelSelection;
    prototype.updateModelSelection = function patchedDebugStackFrameSelection(): void | Promise<void> {
      const result = originalUpdateModelSelection.call(this);
      const openSelectedFrame = (): void => {
        const selectedNode = this.model.selectedNodes[0];
        openDebugStackFrame(extractDebugStackFrame(selectedNode));
      };
      if (result && typeof result.then === 'function') {
        return result.then(openSelectedFrame);
      }
      openSelectedFrame();
      return result;
    };
    prototype[STACK_FRAME_TAP_PATCHED] = true;
  }
}

function extractDebugStackFrame(node?: TreeNode): DebugStackFrame | undefined {
  if (!TreeElementNode.is(node)) {
    return undefined;
  }
  return isDebugStackFrame(node.element) ? node.element : undefined;
}

function isDebugStackFrame(candidate: unknown): candidate is DebugStackFrame {
  const frame = candidate as Partial<DebugStackFrame> | undefined;
  return Boolean(
    frame &&
    typeof frame === 'object' &&
    'raw' in frame &&
    'source' in frame
  );
}

function openDebugStackFrame(frame: DebugStackFrame | undefined): void {
  if (!frame?.source || frame.raw.line <= 0) {
    return;
  }

  const selection = {
    start: {
      line: Math.max(0, frame.raw.line - 1),
      character: Math.max(0, (frame.raw.column ?? 1) - 1)
    },
    ...(typeof frame.raw.endLine === 'number'
      ? {
          end: {
            line: Math.max(0, frame.raw.endLine - 1),
            character: Math.max(0, (frame.raw.endColumn ?? frame.raw.column ?? 1) - 1)
          }
        }
      : {})
  };

  void frame.source.open({
    mode: 'reveal',
    revealOption: 'center',
    selection
  }).catch((error: unknown) => {
    console.warn('Could not open debug stack frame source.', error);
  });
}
