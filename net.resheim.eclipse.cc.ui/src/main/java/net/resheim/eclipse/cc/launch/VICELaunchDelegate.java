/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *
 *   Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.cc.launch;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IWorkspace;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.FileLocator;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.Platform;
import org.eclipse.core.runtime.Status;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchManager;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.LaunchConfigurationDelegate;
import org.osgi.framework.Bundle;

import net.resheim.eclipse.cc.builder.Assemblies;
import net.resheim.eclipse.cc.builder.model.Assembly;
import net.resheim.eclipse.cc.builder.model.LineMapping;
import net.resheim.eclipse.cc.vice.debug.model.VICEBreakpoint;
import net.resheim.eclipse.cc.vice.debug.model.VICECheckpoint;
import net.resheim.eclipse.cc.vice.debug.model.VICECheckpoint.Source;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugTarget;

/**
 * Launch delegate for the VICE emulator supporting both <i>run</i> and
 * <i>debug</i> modes.
 *
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 * @implNote an {@link Assembly} must exist for the program, or debugging will
 *           fail.
 */
public class VICELaunchDelegate extends LaunchConfigurationDelegate {


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

			// Fail if we don't have an assembly, we need it for breakpoints
			// and mapping addresses to files and locations in the files.
			// A full build should be executed in order to obtain this.
			Assembly assembly = Assemblies.getDefault().getAssembly(file);
			if (assembly == null) {
				throw new CoreException(Status.error("Program must be compiled"));
			}

			// The VICE startup routine (in bin) is basically a script that
			// detects the current folder and derives what machine to emulate
			// from that. We call the main script directly and emulate this
			// behaviour.
			Bundle vice = Platform.getBundle("net.sourceforge.vice");
			URL fileURL = FileLocator.find(vice, new Path("vice/VICE.app/Contents/Resources/script"), null);
			File script = new File(FileLocator.toFileURL(fileURL).getPath());
			args.add(script.toString());

			// We only need to set the monitor commands file if we intend to do
			// debugging – assuming that KickAssembler has created it.
			if (debug) {
				IPath mcommands = file.getRawLocation().removeFileExtension().addFileExtension("vs");
				if (mcommands.toFile().exists()) {
					args.add("-moncommands");
					args.add(mcommands.toOSString());
				}
				// Update the monitor commands file with a list of checkpoints.
				// this way we do not have to break just after starting the
				// emulator.
				//
				// break [load|store|exec] [address [address] [if <cond_expr>]]
				//
				// This command allows setting a breakpoint or listing the current breakpoints.
				// If no address is given, the currently valid checkpoints are printed. If an
				// address is given, a breakpoint is set for that address and the breakpoint
				// number is printed. The "load|store|exec" parameter can be either "load",
				// "store" or "exec" (or any combination of these) to determine on which
				// operation the monitor breaks. If not specified, the monitor breaks on "exec".
				// A conditional expression can also be specified for the breakpoint. For more
				// information on conditions, see the CONDITION command.
				IBreakpoint[] breakpoints = DebugPlugin.getDefault().getBreakpointManager()
						.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);
				try (FileWriter fw = new FileWriter(mcommands.toFile(), true)) {
					for (IBreakpoint iBreakpoint : breakpoints) {
						if (iBreakpoint.isEnabled() && iBreakpoint instanceof VICECheckpoint) {
							VICECheckpoint cp = (VICECheckpoint) iBreakpoint;
							if (cp.getSource().equals(Source.USER)) {
								updateAdresses(assembly, iBreakpoint);
								if (cp instanceof VICEBreakpoint) {
									fw.append("break ");
									fw.append(Integer.toHexString(cp.getStartAddress()));
									fw.append(" \n");
								}
							}
						}
					}
				}

				// Open port for the binary monitor that is implemented in the
				// net.resheim.eclipse.cc.vice.debug package
				args.add("-binarymonitor");
				args.add("-binarymonitoraddress");
				args.add("127.0.0.1:6502");

				// Break as soon as the kernal is ready. If we omit this, VICE
				// will crash immediately when stepping through code. See
				// https://sourceforge.net/p/vice-emu/bugs/2083/
				// Appears to have been fixed in 3.9, but we need it to set breakpoints as early
				// as possible
//				args.add("-initbreak");
//				args.add("ready");
			}

			// We're looking for a viceconfig somewhere in the
			// program file's folder or in one of the parent folders.
			IPath viceconfig = findViceConfig(file.getRawLocation());
			// Point to the VICE configuration file if it exists
			if (viceconfig != null) {
				args.add("-config");
				args.add(viceconfig.toOSString());
			}

			// Add the path to the program file
			args.add(file.getRawLocation().toPath().toString());

			Map<String, String> env = new HashMap<>(System.getenv());
			// The VICE script can use the PROGRAM environment variable to
			// determine which emulator to launch. If not specified a dialog
			// will ask you to select.
			env.put("PROGRAM", target);
			env.put("TERM", "dumb");
			String workdir = file.getParent().getRawLocation().toOSString();
			ProcessBuilder pb = new ProcessBuilder()
					.directory(new File(workdir))
					.command(args);
			pb.environment().put("PROGRAM", target);
			Process process = pb.start();

			Map<String, String> attributes = new HashMap<>();
			IProcess newProcess = DebugPlugin.newProcess(launch, process, fileName, attributes);
			if (debug) {
				VICEDebugTarget debugTarget = new VICEDebugTarget(newProcess, launch, assembly);
				launch.addDebugTarget(debugTarget);
			}
			monitor.done();

		} catch (IOException e) {
			throw new CoreException(new Status(IStatus.ERROR,
					DebugPlugin.getUniqueIdentifier(),
					DebugPlugin.ERROR,
					"Could not launch " + fileName, e));
		}
	}

	/**
	 * Examines the assembly to find the start and end address of the breakpoint
	 * based on the file and the line number the breakpoint has been assigned to.
	 *
	 * @param assembly    the assembly to be launched
	 * @param iBreakpoint the breakpoint
	 * @throws CoreException
	 */
	private void updateAdresses(Assembly assembly, IBreakpoint iBreakpoint) throws CoreException {
		VICECheckpoint cp = (VICECheckpoint) iBreakpoint;
		if (cp.getSource() != Source.CODE) {
			IResource br = iBreakpoint.getMarker().getResource();
			// see if the checkpoint is in one of the assembled files
			LineMapping lineMapping;
			lineMapping = assembly.getLineMapping((IFile) br, cp.getLineNumber());
			if (lineMapping != null) {
				cp.setStartAddress(lineMapping.getStartAddress());
				cp.setEndAddress(lineMapping.getEndAddress());
			}
		}
	}

	protected IProject[] getBuildOrder(ILaunchConfiguration configuration, String mode) throws CoreException {
		final String projectName = configuration.getAttribute(ICCLaunchConfigurationConstants.ATTR_PROJECT_NAME, "");
		IWorkspace workspace = ResourcesPlugin.getWorkspace();
		IWorkspaceRoot root = workspace.getRoot();
		IProject project = root.getProject(projectName);
		return new IProject[] { project };
	}

}
