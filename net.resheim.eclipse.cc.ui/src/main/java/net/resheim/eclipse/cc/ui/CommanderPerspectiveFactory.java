package net.resheim.eclipse.cc.ui;

import org.eclipse.debug.ui.IDebugUIConstants;
import org.eclipse.ui.IFolderLayout;
import org.eclipse.ui.IPageLayout;
import org.eclipse.ui.IPerspectiveFactory;
import org.eclipse.ui.console.IConsoleConstants;
import org.eclipse.ui.progress.IProgressConstants;

public class CommanderPerspectiveFactory implements IPerspectiveFactory {

	public static final String DEBUG_PROCESS_FOLDER = "net.resheim.eclipse.cc.ui.debugProcessFolder";
	public static final String NAVIGATION_FOLDER = "net.resheim.eclipse.cc.ui.navigationFolder";
	public static final String TOOLS_FOLDER = "net.resheim.eclipse.cc.ui.toolsFolder";
	public static final String DEBUG_TOOL_FOLDER = "net.resheim.eclipse.cc.ui.debugToolsFolder";

	/**
	 * @see IPerspectiveFactory#createInitialLayout(IPageLayout)
	 */
	@Override
	public void createInitialLayout(IPageLayout layout) {

		String editorArea = layout.getEditorArea();


		IFolderLayout navFolder = layout.createFolder(NAVIGATION_FOLDER,
				IPageLayout.LEFT, (float) 0.25, editorArea);
		navFolder.addView(IPageLayout.ID_PROJECT_EXPLORER);
		// navFolder.addView(IPageLayout.ID_MINIMAP_VIEW);

		IFolderLayout debugFolder = layout.createFolder(DEBUG_PROCESS_FOLDER, IPageLayout.BOTTOM,
				(float) 0.5, NAVIGATION_FOLDER);
		debugFolder.addView(IDebugUIConstants.ID_DEBUG_VIEW);

		IFolderLayout toolsFolder = layout.createFolder(TOOLS_FOLDER,
				IPageLayout.BOTTOM, (float) 0.75, editorArea);
		toolsFolder.addView(IConsoleConstants.ID_CONSOLE_VIEW);
		toolsFolder.addView(IPageLayout.ID_PROBLEM_VIEW);
		toolsFolder.addPlaceholder(IPageLayout.ID_BOOKMARKS);
		toolsFolder.addPlaceholder(IProgressConstants.PROGRESS_VIEW_ID);



		IFolderLayout debugViewsFolder = layout.createFolder(DEBUG_TOOL_FOLDER,
				IPageLayout.RIGHT, (float) 0.65, editorArea);
		debugViewsFolder.addView(IDebugUIConstants.ID_VARIABLE_VIEW);
		debugViewsFolder.addView(IDebugUIConstants.ID_BREAKPOINT_VIEW);
		debugViewsFolder.addView(IDebugUIConstants.ID_EXPRESSION_VIEW);
		debugViewsFolder.addView(IDebugUIConstants.ID_REGISTER_VIEW);
		debugViewsFolder.addPlaceholder(IPageLayout.ID_OUTLINE);
		debugViewsFolder.addPlaceholder(IPageLayout.ID_PROP_SHEET);


		layout.addShowViewShortcut(IProgressConstants.PROGRESS_VIEW_ID);

		layout.addActionSet(IDebugUIConstants.LAUNCH_ACTION_SET);
		layout.addActionSet(IDebugUIConstants.DEBUG_ACTION_SET);
		layout.addActionSet(IPageLayout.ID_NAVIGATE_ACTION_SET);

		setContentsOfShowViewMenu(layout);
	}

	/**
	 * Sets the initial contents of the "Show View" menu.
	 */
	protected void setContentsOfShowViewMenu(IPageLayout layout) {
		layout.addShowViewShortcut(IDebugUIConstants.ID_DEBUG_VIEW);
		layout.addShowViewShortcut(IDebugUIConstants.ID_VARIABLE_VIEW);
		layout.addShowViewShortcut(IDebugUIConstants.ID_BREAKPOINT_VIEW);
		layout.addShowViewShortcut(IDebugUIConstants.ID_EXPRESSION_VIEW);
		layout.addShowViewShortcut(IPageLayout.ID_OUTLINE);
		layout.addShowViewShortcut(IConsoleConstants.ID_CONSOLE_VIEW);
		layout.addShowViewShortcut(IPageLayout.ID_PROBLEM_VIEW);
		layout.addShowViewShortcut(IPageLayout.ID_PROJECT_EXPLORER);
	}

}
