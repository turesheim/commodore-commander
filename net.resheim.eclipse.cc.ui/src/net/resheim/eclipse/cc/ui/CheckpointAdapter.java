package net.resheim.eclipse.cc.ui;


import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.ILineBreakpoint;
import org.eclipse.debug.ui.actions.IToggleBreakpointsTargetExtension;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.ui.IWorkbenchPart;
import org.eclipse.ui.texteditor.ITextEditor;

import net.resheim.eclipse.cc.vice.debug.model.Checkpoint;

public class CheckpointAdapter implements IToggleBreakpointsTargetExtension {

	@Override
	public void toggleLineBreakpoints(IWorkbenchPart part, ISelection selection) throws CoreException {
	}

	@Override
	public boolean canToggleLineBreakpoints(IWorkbenchPart part, ISelection selection) {
		return getEditor(part) != null;
	}

	@Override
	public void toggleMethodBreakpoints(IWorkbenchPart part, ISelection selection) throws CoreException {
	}

	@Override
	public boolean canToggleMethodBreakpoints(IWorkbenchPart part, ISelection selection) {
		return false;
	}

	@Override
	public boolean canToggleBreakpoints(IWorkbenchPart part, ISelection selection) {
		return getEditor(part) != null;
	}

	@Override
	public void toggleWatchpoints(IWorkbenchPart part, ISelection selection) throws CoreException {
	}

	@Override
	public boolean canToggleWatchpoints(IWorkbenchPart part, ISelection selection) {
		return false;
	}

	@Override
	public void toggleBreakpoints(IWorkbenchPart part, ISelection selection) throws CoreException {
		System.out.println("CheckpointAdapter.toggleBreakpoints()");
		ITextEditor textEditor = getEditor(part);
	       if (textEditor != null) {
	          IResource resource = (IResource) textEditor.getEditorInput()
	                                              .getAdapter(IResource.class);
	          ITextSelection textSelection = (ITextSelection) selection;
	          int lineNumber = textSelection.getStartLine();
	          IBreakpoint[] breakpoints = DebugPlugin.getDefault().getBreakpointManager()
						.getBreakpoints("net.resheim.eclipse.cc.vice.debug");
	          for (int i = 0; i < breakpoints.length; i++) {
	             IBreakpoint breakpoint = breakpoints[i];
	             if (resource.equals(breakpoint.getMarker().getResource())) {
	                if (((ILineBreakpoint)breakpoint).getLineNumber() == (lineNumber + 1)) {
	                breakpoint.delete();
	                   return;
	                }
	             }
	          }
	    Checkpoint lineBreakpoint = new Checkpoint(resource, lineNumber + 1);
		DebugPlugin.getDefault().getBreakpointManager().addBreakpoint(lineBreakpoint);
	}
}


	private ITextEditor getEditor(IWorkbenchPart part) {
		if (part instanceof ITextEditor) {
			ITextEditor editorPart = (ITextEditor) part;
			IResource resource = editorPart.getEditorInput().getAdapter(IResource.class);
			if (resource != null) {
				String extension = resource.getFileExtension();
				if (extension != null && extension.equals("asm")) { //$NON-NLS-1$
					return editorPart;
				}
			}
		}
		return null;
	}
}
