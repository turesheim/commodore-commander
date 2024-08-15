package net.resheim.eclipse.cc.ui.views;

import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.jface.text.source.AnnotationRulerColumn;
import org.eclipse.jface.text.source.IAnnotationAccess;
import org.eclipse.jface.text.source.IAnnotationModel;
import org.eclipse.swt.events.MouseAdapter;
import org.eclipse.swt.events.MouseEvent;
import org.eclipse.swt.widgets.Display;

import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;

public class BreakpointRulerColumn extends AnnotationRulerColumn {

	public BreakpointRulerColumn(int width) {
		super(width);
	}

	public BreakpointRulerColumn(int width, IAnnotationAccess annotationAccess) {
		super(width, annotationAccess);
	}

	public BreakpointRulerColumn(IAnnotationModel model, int width) {
		super(model, width);
	}

	public BreakpointRulerColumn(IAnnotationModel model, int width, IAnnotationAccess annotationAccess) {
		super(model, width, annotationAccess);
	}

	public void initialize() {
		addAnnotationTypes();
		addDoubleClickListener();

	}

	private void addAnnotationTypes() {
		addAnnotationType("net.resheim.eclipse.cc.pc");
		addAnnotationType("org.eclipse.debug.core.breakpoint");
	}

	private void addDoubleClickListener() {
		getControl().addMouseListener(new MouseAdapter() {
			@Override
			public void mouseDoubleClick(MouseEvent e) {
				handleDoubleClick(e);
			}
		});
	}

	protected void handleDoubleClick(MouseEvent event) {
		// Get the clicked line
		int line = getLineOfLastMouseButtonActivity();

		// Perform your custom action here
		if (line >= 0) {
			Display.getDefault().asyncExec(() -> {
				System.out.println("Double-clicked on line: " + line);
				// Implement your action here, e.g., open a dialog, jump to a line, etc.
				performCustomAction(line);
			});
		}
	}

	protected void performCustomAction(int line) {
		IBreakpoint[] breakpoints = DebugPlugin.getDefault().getBreakpointManager()
				.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);

		// Example: open a message box
		Display display = Display.getDefault();
		display.asyncExec(() -> {
			// Implement your custom action, such as opening a dialog or editor
			System.out.println("Custom action performed for line: " + line);
		});
	}
}
