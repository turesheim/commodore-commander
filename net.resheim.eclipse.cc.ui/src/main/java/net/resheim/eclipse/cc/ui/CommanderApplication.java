package net.resheim.eclipse.cc.ui;
import org.eclipse.equinox.app.IApplication;
import org.eclipse.equinox.app.IApplicationContext;
import org.eclipse.swt.SWT;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.PlatformUI;

public class CommanderApplication implements IApplication {

    @Override
    public Object start(IApplicationContext context) throws Exception {
        Display display = PlatformUI.createDisplay();
        try {
			Shell shell = new Shell(display, SWT.ON_TOP);
			int returnCode = PlatformUI.createAndRunWorkbench(display, new CommanderWorkbenchAdvisor());
            if (returnCode == PlatformUI.RETURN_RESTART) {
                return IApplication.EXIT_RESTART;
            } else {
                return IApplication.EXIT_OK;
            }
        } finally {
			if (display != null) {
				display.dispose();
			}
        }
    }

    @Override
    public void stop() {
        // Stop logic, if needed
    }
}