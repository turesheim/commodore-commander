package net.resheim.eclipse.cc.launch;

import java.util.ArrayList;
import java.util.List;

import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IWorkspace;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchConfigurationWorkingCopy;
import org.eclipse.debug.ui.AbstractLaunchConfigurationTab;
import org.eclipse.debug.ui.ILaunchConfigurationDialog;
import org.eclipse.jface.viewers.ILabelProvider;
import org.eclipse.jface.window.Window;
import org.eclipse.swt.SWT;
import org.eclipse.swt.events.ModifyEvent;
import org.eclipse.swt.events.ModifyListener;
import org.eclipse.swt.events.SelectionEvent;
import org.eclipse.swt.events.SelectionListener;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Text;
import org.eclipse.ui.dialogs.ElementListSelectionDialog;
import org.eclipse.ui.model.WorkbenchLabelProvider;

import net.resheim.eclipse.cc.nature.CommodoreCommanderNature;
import org.eclipse.swt.widgets.Combo;

public class VICELaunchMainTab extends AbstractLaunchConfigurationTab {
	ILaunchConfigurationDialog fDialog;
	Button fProjectSelect = null;
	Button fFileSelect = null;
	Button fTemplateSelect = null;
	Button fObjectSelect = null;
	Text fProject = null;
	Text fFile = null;

	/**
	 * A listener which handles widget change events for the controls in this tab.
	 */
	private class WidgetListener implements ModifyListener, SelectionListener {
		public void modifyText(ModifyEvent e) {
			updateLaunchConfigurationDialog();
		}

		public void widgetSelected(SelectionEvent e) {
			Object source = e.getSource();
			if (source == fProjectSelect) {
				handleProjectButtonSelected();
			} else if (source == fFileSelect) {
				handleFileButtonSelected();
			} else {
				updateLaunchConfigurationDialog();
			}
		}

		public void widgetDefaultSelected(SelectionEvent e) {
		}
	}

	private WidgetListener fListener = new WidgetListener();
	private Combo fTarget;

	public VICELaunchMainTab(ILaunchConfigurationDialog dialog) {
		this.fDialog = dialog;
	}

	/**
	 * @wbp.parser.entryPoint
	 */
	@Override
	public void createControl(Composite parent) {
		Font font = parent.getFont();

		Composite comp = new Composite(parent, SWT.NONE);
		setControl(comp);
		GridLayout topLayout = new GridLayout();
		topLayout.verticalSpacing = 0;
		topLayout.numColumns = 3;
		comp.setLayout(topLayout);
		comp.setFont(font);

		// Project
		Label fProjectLabel = new Label(comp, SWT.NONE);
		fProjectLabel.setText("Project:");
		fProjectLabel.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL));
		fProjectLabel.setFont(font);

		fProject = new Text(comp, SWT.SINGLE | SWT.BORDER);
		fProject.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL | GridData.GRAB_HORIZONTAL));
		fProject.setFont(font);
		fProject.addModifyListener(fListener);

		fProjectSelect = new Button(comp, SWT.PUSH);
		fProjectSelect.setText("Browse");
		fProjectSelect.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL));
		fProjectSelect.setFont(font);
		fProjectSelect.addSelectionListener(fListener);

		// File
		Label fFileLabel = new Label(comp, SWT.NONE);
		fFileLabel.setText("File:");
		fFileLabel.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL));
		fFileLabel.setFont(font);

		fFile = new Text(comp, SWT.SINGLE | SWT.BORDER);
		fFile.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL | GridData.GRAB_HORIZONTAL));
		fFile.setFont(font);
		fFile.addModifyListener(fListener);

		fFileSelect = new Button(comp, SWT.PUSH);
		fFileSelect.setText("Browse");
		fFileSelect.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL));
		fFileSelect.setFont(font);

		Label lblTarget = new Label(comp, SWT.NONE);
		lblTarget.setText("Target:");
		lblTarget.setLayoutData(new GridData(GridData.HORIZONTAL_ALIGN_FILL));
		lblTarget.setFont(font);
		fFileSelect.addSelectionListener(fListener);

		fTarget = new Combo(comp, SWT.READ_ONLY);
		fTarget.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false, 1, 1));
		for (String target : ICCLaunchConfigurationConstants.TARGET_IDS) {
			fTarget.add(target);
		}
		fTarget.addSelectionListener(fListener);
		new Label(comp, SWT.NONE);


	}

	@Override
	public void setDefaults(ILaunchConfigurationWorkingCopy configuration) {
		// TODO Auto-generated method stub

	}

	@Override
	public void initializeFrom(ILaunchConfiguration configuration) {
		updateProjectFromConfig(configuration);
		updateFileFromConfig(configuration);
		updateTargetFromConfig(configuration);
	}


	@Override
	public void performApply(ILaunchConfigurationWorkingCopy configuration) {
		configuration.setAttribute(ICCLaunchConfigurationConstants.ATTR_PROJECT_NAME, fProject.getText());
		configuration.setAttribute(ICCLaunchConfigurationConstants.ATTR_FILE_NAME, fFile.getText());
		configuration.setAttribute(ICCLaunchConfigurationConstants.ATTR_TARGET, fTarget.getText());
	}

	/**
	 * The "Browse" button for project selection has been pushed and we must bring
	 * up the project selection dialog which this method will do.
	 */
	private void handleProjectButtonSelected() {
		IProject project = chooseCCProject();
		if (project == null) {
			return;
		}

		String projectName = project.getName();
		fProject.setText(projectName);
	}

	/**
	 * The "Browse" button for file selection has been pushed and we must bring up
	 * the file selection dialog which this method will do.
	 */
	private void handleFileButtonSelected() {
		IFile file = chooseProgramFile();
		if (file == null) {
			return;
		}
		String fileName = file.getProjectRelativePath().toString();
		fFile.setText(fileName);
	}

	/**
	 * Realize a VDF Project selection dialog and return the first selected project,
	 * or null if there was none.
	 */
	private IProject chooseCCProject() {
		IWorkspace workspace = ResourcesPlugin.getWorkspace();
		IWorkspaceRoot root = workspace.getRoot();
		IProject[] projects = root.getProjects();
		List<IProject> projectsWithNature = new ArrayList<>();
		for (IProject project : projects) {
			try {
				if (project.isOpen() && project.hasNature(CommodoreCommanderNature.NATURE_ID)) {
					projectsWithNature.add(project);
				}
			} catch (CoreException e) {
				e.printStackTrace();
			}
		}

		ILabelProvider labelProvider = new WorkbenchLabelProvider();
		ElementListSelectionDialog dialog = new ElementListSelectionDialog(getShell(), labelProvider);
		dialog.setTitle("Select project"); //$NON-NLS-1$
		dialog.setMessage("Choose a project to constrain the search for files."); //$NON-NLS-1$
		dialog.setElements(projectsWithNature.toArray(new IProject[0]));

		IProject javaProject = getCCProject();
		if (javaProject != null) {
			dialog.setInitialSelections(new Object[] { javaProject });
		}
		if (dialog.open() == Window.OK) {
			return (IProject) dialog.getFirstResult();
		}
		return null;
	}

	/**
	 * Realize a VDF Project selection dialog and return the first selected project,
	 * or null if there was none.
	 */
	private IFile chooseProgramFile() {
		IWorkspace workspace = ResourcesPlugin.getWorkspace();
		IWorkspaceRoot root = workspace.getRoot();
		IProject project = root.getProject(fProject.getText());
		if (project != null) {
			ArrayList<IFile> prgFiles = new ArrayList<>();
			try {
				collectProgramFiles(project, prgFiles);
				ILabelProvider labelProvider = new WorkbenchLabelProvider();
				ElementListSelectionDialog dialog = new ElementListSelectionDialog(getShell(), labelProvider);
				dialog.setTitle("Select Commodore program"); //$NON-NLS-1$
				dialog.setMessage("Choose a program file to run or debug."); //$NON-NLS-1$
				dialog.setElements(prgFiles.toArray(new IFile[0]));
				if (dialog.open() == Window.OK) {
					return (IFile) dialog.getFirstResult();
				}
			} catch (CoreException e) {
				e.printStackTrace();
			}
		}
		return null;
	}

	private static void collectProgramFiles(IResource resource, List<IFile> prgFiles) throws CoreException {
		if (resource instanceof IFile) {
			IFile file = (IFile) resource;
			if (file.getName().endsWith(".prg")) {
				prgFiles.add(file);
			}
		} else if (resource instanceof IContainer) {
			IContainer container = (IContainer) resource;
			for (IResource member : container.members()) {
				collectProgramFiles(member, prgFiles);
			}
		}
	}

	/**
	 * Return the IProject corresponding to the project name in the project name
	 * text field, or null if the text does not match a project name.
	 */
	protected IProject getCCProject() {
		String projectName = fProject.getText().trim();
		if (projectName.length() < 1) {
			return null;
		}
		IWorkspace workspace = ResourcesPlugin.getWorkspace();
		IWorkspaceRoot root = workspace.getRoot();
		return root.getProject(fProject.getText());
	}

	/**
	 * Return the program file corresponding to the name in the file name text
	 * field, or null if the text does not match a file name.
	 */
	protected IFile getProgramFile() {
		String fileName = fFile.getText().trim();
		IProject project = getCCProject();
		if (project != null) {
			return project.getFile(fileName);
		}
		return null;
	}

	@Override
	public String getName() {
		// TODO Auto-generated method stub
		return "Main";
	}

	protected void updateProjectFromConfig(ILaunchConfiguration config) {
		String projectName = ""; //$NON-NLS-1$
		try {
			projectName = config.getAttribute(ICCLaunchConfigurationConstants.ATTR_PROJECT_NAME, "");
		} catch (CoreException ce) {
		}
		fProject.setText(projectName);
	}

	protected void updateFileFromConfig(ILaunchConfiguration config) {
		String fileName = ""; //$NON-NLS-1$
		try {
			fileName = config.getAttribute(ICCLaunchConfigurationConstants.ATTR_FILE_NAME, "");
		} catch (CoreException ce) {
		}
		fFile.setText(fileName);
	}

	private void updateTargetFromConfig(ILaunchConfiguration config) {
		String target = ""; //$NON-NLS-1$
		try {
			target = config.getAttribute(ICCLaunchConfigurationConstants.ATTR_TARGET, "");
		} catch (CoreException ce) {
		}
		fTarget.setText(target);
	}

}
