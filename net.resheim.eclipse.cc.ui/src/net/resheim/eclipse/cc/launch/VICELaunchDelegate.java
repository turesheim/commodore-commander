package net.resheim.eclipse.cc.launch;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspace;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchManager;
import org.eclipse.debug.core.model.ILaunchConfigurationDelegate;

import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;

/**
 * Don't really care about debug vs run mode currently
 */
public class VICELaunchDelegate implements ILaunchConfigurationDelegate {

	private IPath findViceConfig(IPath file) {
		IPath folder = file.removeLastSegments(1);
		IPath config = folder.append("vice.ini");
		if (config.toFile().exists()) {
			return config;
		}
		if (folder.isRoot()) {
			return null;
		} else
			return findViceConfig(folder);

	}

	@Override
	public void launch(ILaunchConfiguration configuration, String mode, ILaunch launch, IProgressMonitor monitor)
			throws CoreException {
		final String projectName = configuration.getAttribute(ICCLaunchConfigurationConstants.ATTR_PROJECT_NAME, "");
		final String fileName = configuration.getAttribute(ICCLaunchConfigurationConstants.ATTR_FILE_NAME, "");
		boolean debug = mode.equals(ILaunchManager.DEBUG_MODE);

		try {
			List<String> args = new ArrayList<String>();
			IWorkspace workspace = ResourcesPlugin.getWorkspace();
			IWorkspaceRoot root = workspace.getRoot();
			IProject project = root.getProject(projectName);
			IFile file = project.getFile(fileName);

			// We're assuming that there is a viceconfig somewhere in the
			// program file's folder or in one of the parent folders.
			IPath viceconfig = findViceConfig(file.getRawLocation());

			// XXX: Add preferences for executable location
			args.add("/opt/homebrew/bin/x64sc");

			// We only need to set the monitor commands file if we intend to do
			// debugging – assuming that KickAssembler has created it.
			if (debug) {
				IPath mcommands = file.getRawLocation().removeFileExtension().addFileExtension("vs");
				if (mcommands.toFile().exists()) {
					args.add("-moncommands");
					args.add(mcommands.toOSString());
				}
				args.add("-nativemonitor");
			}

			// Point to the VICE configuration file if it exists
			if (viceconfig != null) {
				args.add("-config");
				args.add(viceconfig.toOSString());
			}

			// the program file
			args.add(file.getRawLocation().toPath().toString()); // $NON-NLS-1$

			Map<String, String> env = new HashMap<>(System.getenv());
			env.put("TERM", "dumb");
			PtyProcess process = new PtyProcessBuilder()
					.setCommand(args.toArray(new String[0]))
					.setEnvironment(env)
					.setConsole(true)
					.start();

			Map<String, String> attributes = new HashMap<>();
			DebugPlugin.newProcess(launch, process, fileName, attributes);

		} catch (Exception e) {
			e.printStackTrace();
		}
	}

}
