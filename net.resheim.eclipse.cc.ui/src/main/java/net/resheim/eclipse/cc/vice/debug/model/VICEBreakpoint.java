package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;

public class VICEBreakpoint extends VICECheckpoint {

	public static final String BREAKPOINT_MARKER_ID = "net.resheim.eclipse.cc.breakpointMarker";

	public VICEBreakpoint() {
		super();
	}

	public VICEBreakpoint(IResource resource, int lineNumber, Source source, int operation)
			throws CoreException {
		super(resource, BREAKPOINT_MARKER_ID, source, lineNumber, operation);
		ensureMarker().setAttribute(IMarker.MESSAGE, "Breakpoint");
	}

}
