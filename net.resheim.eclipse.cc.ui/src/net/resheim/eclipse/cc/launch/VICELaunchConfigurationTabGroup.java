package net.resheim.eclipse.cc.launch;

import org.eclipse.debug.ui.AbstractLaunchConfigurationTabGroup;
import org.eclipse.debug.ui.CommonTab;
import org.eclipse.debug.ui.ILaunchConfigurationDialog;
import org.eclipse.debug.ui.ILaunchConfigurationTab;

public class VICELaunchConfigurationTabGroup extends AbstractLaunchConfigurationTabGroup {

	public VICELaunchConfigurationTabGroup() {
		// TODO Auto-generated constructor stub
	}

	@Override
	public void createTabs(ILaunchConfigurationDialog dialog, String mode) {
		ILaunchConfigurationTab[] tabs = new ILaunchConfigurationTab[] {
				new VICELaunchMainTab(dialog),
				// new VDFMainTab(dialog), new VDFCompilerTab(mode),
				new CommonTab() };
		setTabs(tabs);
	}

}
