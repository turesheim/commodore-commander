package net.resheim.eclipse.cc.ui;

import org.eclipse.ui.application.WorkbenchAdvisor;

public class CommanderWorkbenchAdvisor extends WorkbenchAdvisor {

	private static final String DEBUG_PERSPECTIVE_ID = "org.eclipse.debug.ui.DebugPerspective"; // Debug perspective ID
	private static final String CC_PERSPECTIVE_ID = "net.resheim.eclipse.cc.perspective"; // Debug perspective ID

	@Override
	public String getInitialWindowPerspectiveId() {
		return DEBUG_PERSPECTIVE_ID; // Set Debug Perspective as default

	}

}
