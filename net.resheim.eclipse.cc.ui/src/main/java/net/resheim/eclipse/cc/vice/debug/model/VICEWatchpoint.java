package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.model.IWatchpoint;

public class VICEWatchpoint extends VICECheckpoint implements IWatchpoint {

	public static final String WATCHPOINT_MARKER_ID = "net.resheim.eclipse.cc.watchpointMarker";

	public VICEWatchpoint() {
		super();
	}

	public VICEWatchpoint(IResource resource, int lineNumber, Source source, int operation)
			throws CoreException {
		super(resource, WATCHPOINT_MARKER_ID, source, lineNumber, operation);
		ensureMarker().setAttribute(IMarker.MESSAGE, "Watchpoint");
	}

	@Override
	public boolean isAccess() throws CoreException {
		return this.isLoad();
	}

	@Override
	public void setAccess(boolean access) throws CoreException {
		setLoad(access);
	}

	@Override
	public boolean isModification() throws CoreException {
		return isStore();
	}

	@Override
	public void setModification(boolean modification) throws CoreException {
		setStore(modification);
	}

	@Override
	public boolean supportsAccess() {
		return true;
	}

	@Override
	public boolean supportsModification() {
		return true;
	}

}
