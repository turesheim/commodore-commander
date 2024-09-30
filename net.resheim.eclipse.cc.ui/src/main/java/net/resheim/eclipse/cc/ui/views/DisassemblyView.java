package net.resheim.eclipse.cc.ui.views;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.jface.action.Action;
import org.eclipse.jface.action.IMenuListener;
import org.eclipse.jface.action.IMenuManager;
import org.eclipse.jface.action.IToolBarManager;
import org.eclipse.jface.action.MenuManager;
import org.eclipse.jface.action.Separator;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.resource.ColorRegistry;
import org.eclipse.jface.resource.JFaceResources;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.Document;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.Position;
import org.eclipse.jface.text.source.AbstractRulerColumn;
import org.eclipse.jface.text.source.Annotation;
import org.eclipse.jface.text.source.AnnotationModel;
import org.eclipse.jface.text.source.AnnotationRulerColumn;
import org.eclipse.jface.text.source.CompositeRuler;
import org.eclipse.jface.text.source.ISharedTextColors;
import org.eclipse.jface.text.source.LineNumberRulerColumn;
import org.eclipse.jface.text.source.SourceViewer;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.StyledText;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Menu;
import org.eclipse.ui.IActionBars;
import org.eclipse.ui.ISharedImages;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchActionConstants;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.internal.editors.text.EditorsPlugin;
import org.eclipse.ui.part.ViewPart;
import org.eclipse.ui.texteditor.DefaultMarkerAnnotationAccess;
import org.eclipse.ui.themes.ITheme;

import jakarta.inject.Inject;
import net.resheim.eclipse.cc.disassembler.Disassembler;
import net.resheim.eclipse.cc.disassembler.Disassembly;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugTarget;
import net.resheim.eclipse.cc.vice.debug.model.VICEStackFrame;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor;

public class DisassemblyView extends ViewPart implements IDebugEventSetListener {

	/**
	 * Displays the start address of the disassembly that is shown on the line.
	 */
	class AddressAnnotationRulerColumn extends AbstractRulerColumn {

		public AddressAnnotationRulerColumn() {
			super();
			setWidth(100);
		}

		protected String computeText(int line) {
			Disassembly dis = disassembler.getLine(line);
			if (dis != null) {
				int address = disassembler.getLine(line).getAddress();
				return String.format("$%04X", address);
			}
			return ">>>" + line;
		}

	}

	class LabelAnnotationRulerColumn extends AbstractRulerColumn {

		public LabelAnnotationRulerColumn() {
			super();
			setWidth(100);
		}

		protected String computeText(int line) {
			Disassembly dis = disassembler.getLine(line);
			if (dis != null) {
				if (dis.getLabel() != null)
					return dis.getLabel();
				else
					return "NOLABEØ";
			}
			return "LABEL";
		}
	}

	/**
	 * The ID of the view as specified by the extension.
	 */
	public static final String ID = "net.resheim.eclipse.cc.ui.views.DisassemblyView";

	@Inject
	IWorkbench workbench;

	private SourceViewer sourceViewer;

	private Action action1;
	private Action action2;

	private Disassembler disassembler;

	private AnnotationModel annotationModel = new AnnotationModel();

	@Override
	public void createPartControl(Composite parent) {

		Font font = JFaceResources.getTextFont();

		// TODO: Add extra ruler for the byte values so that the actual text is clean
		// code?

		CompositeRuler leftRuler = new CompositeRuler();

		DefaultMarkerAnnotationAccess defaultMarkerAnnotationAccess = new DefaultMarkerAnnotationAccess();

		// Add a column showing the address of the disassembled data
		AddressAnnotationRulerColumn addressRuler = new AddressAnnotationRulerColumn();
		addressRuler.setFont(font);
		leftRuler.addDecorator(1, addressRuler);

		// Add another colum for showing breakpoints and various types of markers
		BreakpointRulerColumn annotationRulerColumn = new BreakpointRulerColumn(annotationModel, 16,
				defaultMarkerAnnotationAccess);

		leftRuler.addDecorator(0, annotationRulerColumn);

		// ITheme currentTheme =
		// PlatformUI.getWorkbench().getThemeManager().getCurrentTheme();
		// ColorRegistry colorRegistry = currentTheme.getColorRegistry();
		// annotationRuler.setBackground(colorRegistry.get("org.eclipse.ui.workbench.ACTIVE_TAB_BG_START"));

		sourceViewer = new SourceViewer(parent, leftRuler, SWT.BORDER | SWT.V_SCROLL);
		sourceViewer.setEditable(false); // TODO: consider making it editable
		StyledText styledText = sourceViewer.getTextWidget();
		styledText.setFont(font);

		CompositeRuler rightRuler = new CompositeRuler();
		LabelAnnotationRulerColumn labelsColumn = new LabelAnnotationRulerColumn();
		rightRuler.addDecorator(1, labelsColumn);

		// Add the right ruler to the source viewer's control layout
		// Control rightRulerControl = rightRuler.createControl(parent, sourceViewer);
//		rightRuler.getControl().setLayoutData(new GridData(SWT.RIGHT, SWT.FILL, false, true));



		DebugPlugin.getDefault().addDebugEventListener(this);

		getSite().setSelectionProvider(sourceViewer);

		annotationRulerColumn.initialize();
		leftRuler.relayout();
//		makeActions();
//		hookContextMenu();
//		contributeToActionBars();

	}

	private void hookContextMenu() {
		MenuManager menuMgr = new MenuManager("#PopupMenu");
		menuMgr.setRemoveAllWhenShown(true);
		menuMgr.addMenuListener(new IMenuListener() {
			public void menuAboutToShow(IMenuManager manager) {
				DisassemblyView.this.fillContextMenu(manager);
			}
		});
		Menu menu = menuMgr.createContextMenu(sourceViewer.getControl());
		sourceViewer.getControl().setMenu(menu);
		getSite().registerContextMenu(menuMgr, sourceViewer);
	}

	@SuppressWarnings("restriction")
	protected ISharedTextColors getSharedColors() {
		return EditorsPlugin.getDefault().getSharedTextColors();
	}

	private void contributeToActionBars() {
		IActionBars bars = getViewSite().getActionBars();
		fillLocalPullDown(bars.getMenuManager());
		fillLocalToolBar(bars.getToolBarManager());
	}

	private void fillLocalPullDown(IMenuManager manager) {
		manager.add(action1);
		manager.add(new Separator());
		manager.add(action2);
	}

	private void fillContextMenu(IMenuManager manager) {
		manager.add(action1);
		manager.add(action2);
		// Other plug-ins can contribute there actions here
		manager.add(new Separator(IWorkbenchActionConstants.MB_ADDITIONS));
	}

	private void fillLocalToolBar(IToolBarManager manager) {
		manager.add(action1);
		manager.add(action2);
	}

	private void makeActions() {
		action1 = new Action() {
			public void run() {
				showMessage("Action 1 executed");
			}
		};
		action1.setText("Action 1");
		action1.setToolTipText("Action 1 tooltip");
		action1.setImageDescriptor(
				PlatformUI.getWorkbench().getSharedImages().getImageDescriptor(ISharedImages.IMG_OBJS_INFO_TSK));

		action2 = new Action() {
			public void run() {
				showMessage("Action 2 executed");
			}
		};
		action2.setText("Action 2");
		action2.setToolTipText("Action 2 tooltip");
		action2.setImageDescriptor(workbench.getSharedImages().getImageDescriptor(ISharedImages.IMG_OBJS_INFO_TSK));
	}

	private void showMessage(String message) {
		MessageDialog.openInformation(sourceViewer.getControl().getShell(), "Disassembly", message);
	}

	@Override
	public void setFocus() {
		sourceViewer.getControl().setFocus();
	}

	// TODO: Do not create a new Document for each DISASSEMBLE, do reuse
	@Override
	public void handleDebugEvents(DebugEvent[] events) {
		for (DebugEvent event : events) {
			if (event.getSource() instanceof VICEDebugTarget) {
				try {
					VICEStackFrame frame = (VICEStackFrame) ((VICEDebugTarget) event.getSource()).getThreads()[0]
							.getTopStackFrame();
					if (DebugEvent.MODEL_SPECIFIC == event.getKind()) {
						annotationModel.removeAllAnnotations();
						int pc = Short.toUnsignedInt(frame.getProgramCounter());
						switch (event.getDetail()) {
						case IBinaryMonitor.DISASSEMBLE:
//							disassembler = ((VICEDebugTarget) event.getSource()).getDisassembler();
							// We only care about disassembling once this time.
							// - [ ] Update the parts that have changed
							// - [ ] Assume that the changed parts is data, not code
//							if (disassembly == null || disassembly.isEmpty()) {
							Disassembly current = null;
							List<Disassembly> disassembly = disassembler.getDisassembly();
							StringBuilder sb = new StringBuilder();
							for (Disassembly dis : disassembly) {
								if (dis.getLabel() != null)
									sb.append(dis.getLabel() + "\n");
								sb.append(String.format("%04X   ", dis.getAddress()));
								sb.append(dis.getText());
								sb.append("\n");
								if (pc == dis.getAddress()) {
									current = dis;
								}
							}
							System.out.println(sb);
							Document document = new Document();
							document.set(sb.toString());
							final int line = current.getLine();
							Display.getDefault().asyncExec(new Runnable() {
								@Override
								public void run() {
									sourceViewer.setDocument(document, annotationModel);
									// Create a custom annotation
									IDocument document = sourceViewer.getDocument();

									try {
										int startOffset;
										startOffset = document.getLineOffset(line);
										int length = document.getLineLength(line);
										addProgramCounterMarker(startOffset, length);
									} catch (BadLocationException e) {
										e.printStackTrace();
									}
									scrollToLine(sourceViewer, line);
								}

							});
//							}
						}
						break;
					}
				} catch (DebugException e) {
				}
			}
		}
	}

	private void addProgramCounterMarker(int startOffset, int length) {
		Annotation annotation = new Annotation("net.resheim.eclipse.cc.pc", false, "Highlighting description");
		Position position = new Position(startOffset, length);
		annotationModel.addAnnotation(annotation, position);
		sourceViewer.invalidateTextPresentation();
	}

	public static void scrollToLine(SourceViewer sourceViewer, int lineNumber) {
		IDocument document = sourceViewer.getDocument();
		try {
			int lineOffset = document.getLineOffset(lineNumber);
			int lineLength = document.getLineLength(lineNumber);
			sourceViewer.revealRange(lineOffset, lineLength);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
