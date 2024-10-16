package net.resheim.eclipse.cc.launch;

import java.io.File;
import java.net.URL;
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
import org.eclipse.core.runtime.FileLocator;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.Platform;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchManager;
import org.eclipse.debug.core.model.ILaunchConfigurationDelegate;
import org.eclipse.debug.core.model.IProcess;
import org.osgi.framework.Bundle;

import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;

import net.resheim.eclipse.cc.disassembler.Disassembler;
import net.resheim.eclipse.cc.disassembler.Label;
import net.resheim.eclipse.cc.disassembler.LabelFileParser;
import net.resheim.eclipse.cc.vice.debug.VICEDebugTarget;

/**
 * Launch delegate for the VICE emulator supporting both <i>run</i> and
 * <i>debug</i> modes.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
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
		final String target = configuration.getAttribute(ICCLaunchConfigurationConstants.ATTR_TARGET, "");
		boolean debug = mode.equals(ILaunchManager.DEBUG_MODE);

		try {
			List<String> args = new ArrayList<String>();
			IWorkspace workspace = ResourcesPlugin.getWorkspace();
			IWorkspaceRoot root = workspace.getRoot();
			IProject project = root.getProject(projectName);
			IFile file = project.getFile(fileName);

			// We're looking for a viceconfig somewhere in the
			// program file's folder or in one of the parent folders.
			IPath viceconfig = findViceConfig(file.getRawLocation());

			// The VICE startup routine (in bin) is basically a script that
			// detects the current folder and derives what machine to emulate
			// from that. We call the main script directly and emulate this
			// behaviour.
			Bundle vice = Platform.getBundle("net.sourceforge.vice");
			URL fileURL = FileLocator.find(vice, new Path("vice/VICE.app/Contents/Resources/script"), null);
			File x64sc = new File(FileLocator.toFileURL(fileURL).getPath());
			args.add(x64sc.toString());

			HashMap<Integer, Label> labels = new HashMap<>();

			// We only need to set the monitor commands file if we intend to do
			// debugging – assuming that KickAssembler has created it.
			if (debug) {
				IPath mcommands = file.getRawLocation().removeFileExtension().addFileExtension("vs");
				if (mcommands.toFile().exists()) {
					args.add("-moncommands");
					args.add(mcommands.toOSString());
					labels = LabelFileParser.parse(mcommands.toFile());
				}
				// In case one wants to telnet to the address and use the text
				// mode monitor
				args.add("-remotemonitor");
				args.add("-remotemonitoraddress");
				args.add("127.0.0.1:6510");

				// Open port for the binary monitor that is implemented in the
				// net.resheim.eclipse.cc.vice.debug package
				args.add("-binarymonitor");
				args.add("-binarymonitoraddress");
				args.add("127.0.0.1:6502");
				// Break as soon as the kernal is ready, this should part of the
				// launch configuration setting
				args.add("-initbreak");
				args.add("ready");
			}

			// Point to the VICE configuration file if it exists
			if (viceconfig != null) {
				args.add("-config");
				args.add(viceconfig.toOSString());
			}

			// Add the path to the program file
			args.add(file.getRawLocation().toPath().toString()); // $NON-NLS-1$

			Map<String, String> env = new HashMap<>(System.getenv());
			env.put("PROGRAM", target);
			env.put("TERM", "dumb");
			PtyProcess process = new PtyProcessBuilder()
					.setCommand(args.toArray(new String[0]))
					.setEnvironment(env)
					.setConsole(true)
					.start();

			Map<String, String> attributes = new HashMap<>();
			IProcess newProcess = DebugPlugin.newProcess(launch, process, fileName, attributes);
			if (debug) {
				Disassembler disassembler = new Disassembler(labels);
				VICEDebugTarget debugTarget = new VICEDebugTarget(newProcess, launch, disassembler);
				launch.addDebugTarget(debugTarget);
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

}
