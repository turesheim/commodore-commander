package net.resheim.eclipse.cc.launch;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspace;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.sourcelookup.ISourceContainer;
import org.eclipse.debug.core.sourcelookup.ISourcePathComputerDelegate;
import org.eclipse.debug.core.sourcelookup.containers.ProjectSourceContainer;

public class SourcePathComputerDelegate implements ISourcePathComputerDelegate {

	@Override
	public ISourceContainer[] computeSourceContainers(ILaunchConfiguration configuration, IProgressMonitor monitor)
			throws CoreException {
		final String projectName = configuration.getAttribute(ICCLaunchConfigurationConstants.ATTR_PROJECT_NAME, "");
		IWorkspace workspace = ResourcesPlugin.getWorkspace();
		IWorkspaceRoot root = workspace.getRoot();
		IProject project = root.getProject(projectName);
		ISourceContainer sourceContainer = new ProjectSourceContainer(project, false);
		return new ISourceContainer[] { sourceContainer };
	}

}
