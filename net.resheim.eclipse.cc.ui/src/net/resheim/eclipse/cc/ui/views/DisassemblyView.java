package net.resheim.eclipse.cc.ui.views;

import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.part.*;
import org.eclipse.ui.texteditor.AbstractMarkerAnnotationModel;
import org.eclipse.ui.texteditor.DefaultMarkerAnnotationAccess;
import org.eclipse.ui.texteditor.SourceViewerDecorationSupport;
import org.eclipse.ui.themes.ITheme;
import org.eclipse.jface.viewers.*;
import org.eclipse.swt.graphics.Color;
import org.eclipse.swt.graphics.Device;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.graphics.GC;
import org.eclipse.swt.graphics.Image;
import org.eclipse.swt.graphics.Rectangle;

import java.awt.Canvas;
import java.util.List;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.jface.action.*;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.resource.ColorDescriptor;
import org.eclipse.jface.resource.ColorRegistry;
import org.eclipse.jface.resource.DeviceResourceException;
import org.eclipse.jface.resource.JFaceColors;
import org.eclipse.jface.resource.JFaceResources;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.Document;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.ITextViewerExtension;
import org.eclipse.jface.text.ITextViewerExtension5;
import org.eclipse.jface.text.Position;
import org.eclipse.jface.text.Region;
import org.eclipse.jface.text.source.Annotation;
import org.eclipse.jface.text.source.AnnotationModel;
import org.eclipse.jface.text.source.AnnotationPainter;
import org.eclipse.jface.text.source.AnnotationRulerColumn;
import org.eclipse.jface.text.source.CompositeRuler;
import org.eclipse.jface.text.source.IAnnotationAccess;
import org.eclipse.jface.text.source.IAnnotationModel;
import org.eclipse.jface.text.source.ISharedTextColors;
import org.eclipse.jface.text.source.LineNumberRulerColumn;
import org.eclipse.jface.text.source.OverviewRuler;
import org.eclipse.jface.text.source.SourceViewer;
import org.eclipse.jface.text.source.VerticalRuler;
import org.eclipse.jface.text.source.VerticalRulerEvent;
import org.eclipse.ui.*;
import org.eclipse.ui.internal.editors.text.EditorsPlugin;
import org.eclipse.swt.widgets.Menu;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.StyledText;

import jakarta.inject.Inject;
import net.resheim.eclipse.cc.disassembler.Disassembler;
import net.resheim.eclipse.cc.disassembler.Disassembly;
import net.resheim.eclipse.cc.vice.debug.IBinaryMonitor;
import net.resheim.eclipse.cc.vice.debug.VICEStackFrame;
import net.resheim.eclipse.cc.vice.debug.VICEThread;

public class DisassemblyView extends ViewPart implements IDebugEventSetListener {

	// private class AddressRuler extends VerticalRuler

	class AddressAnnotationRulerColumn extends LineNumberRulerColumn {
		protected String createDisplayString(int line) {
			if (disassembly.size() > line) {
				int address = disassembly.get(line).getAddress();
				return String.format("$%04X", address);
			} else
				return "-";
		}
	}

	/**
	 * The ID of the view as specified by the extension.
	 */
	public static final String ID = "net.resheim.eclipse.cc.ui.views.DisassemblyView";

	@Inject
	IWorkbench workbench;

	private SourceViewer viewer;
	private Action action1;
	private Action action2;

	private List<Disassembly> disassembly;

	private AnnotationModel annotationModel = new AnnotationModel();

	@Override
	public void createPartControl(Composite parent) {

		// TODO: Add extra ruler for the byte values so that the actual text is clean
		// code?

		CompositeRuler cr = new CompositeRuler();

		DefaultMarkerAnnotationAccess defaultMarkerAnnotationAccess = new DefaultMarkerAnnotationAccess();

		// Add a column showing the address of the disassembled data
		AddressAnnotationRulerColumn annotationRuler = new AddressAnnotationRulerColumn();
		cr.addDecorator(1, annotationRuler);
		// Add another colum for showing breakpoints and various types of markers
		AnnotationRulerColumn annotationRulerColumn = new AnnotationRulerColumn(annotationModel, 16,
				defaultMarkerAnnotationAccess);
		annotationRulerColumn.addAnnotationType("net.resheim.eclipse.cc.pc");
		annotationRulerColumn.addAnnotationType("org.eclipse.debug.core.breakpoint");
		annotationRulerColumn.addAnnotationType(annotationRulerColumn);
		cr.addDecorator(0, annotationRulerColumn);

		ITheme currentTheme = PlatformUI.getWorkbench().getThemeManager().getCurrentTheme();
		ColorRegistry colorRegistry = currentTheme.getColorRegistry();
		annotationRuler.setBackground(colorRegistry.get("org.eclipse.ui.workbench.ACTIVE_TAB_BG_START"));

		viewer = new SourceViewer(parent, cr, SWT.BORDER | SWT.V_SCROLL);
		viewer.setEditable(false);
		viewer.setInput("asdfasdf");

		Font font = JFaceResources.getTextFont();
		StyledText styledText = viewer.getTextWidget();
		Control control = styledText;
		if (viewer instanceof ITextViewerExtension) {
			ITextViewerExtension extension = viewer;
			control = extension.getControl();
		}
		// control.setRedraw(false);
		styledText.setFont(font);
		annotationRuler.setFont(font);
		DebugPlugin.getDefault().addDebugEventListener(this);

		// Create the help context id for the viewer's control
		workbench.getHelpSystem().setHelp(viewer.getControl(), "net.resheim.eclipse.cc.ui.viewer");
		getSite().setSelectionProvider(viewer);
		makeActions();
		hookContextMenu();
		contributeToActionBars();

	}

	private void hookContextMenu() {
		MenuManager menuMgr = new MenuManager("#PopupMenu");
		menuMgr.setRemoveAllWhenShown(true);
		menuMgr.addMenuListener(new IMenuListener() {
			public void menuAboutToShow(IMenuManager manager) {
				DisassemblyView.this.fillContextMenu(manager);
			}
		});
		Menu menu = menuMgr.createContextMenu(viewer.getControl());
		viewer.getControl().setMenu(menu);
		getSite().registerContextMenu(menuMgr, viewer);
	}

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
		MessageDialog.openInformation(viewer.getControl().getShell(), "Disassembly", message);
	}

	@Override
	public void setFocus() {
		viewer.getControl().setFocus();
	}

	@Override
	public void handleDebugEvents(DebugEvent[] events) {
		for (DebugEvent event : events) {
			if (event.getSource() instanceof VICEThread) {
				try {
					VICEStackFrame frame = (VICEStackFrame) ((VICEThread) event.getSource()).getTopStackFrame();
					if (DebugEvent.MODEL_SPECIFIC == event.getKind()) {
						annotationModel.removeAllAnnotations();
						int pc = Short.toUnsignedInt(frame.getProgramCounter());
						switch (event.getDetail()) {
						case IBinaryMonitor.DISASSEMBLE:
							Disassembler disassembler = ((VICEThread) event.getSource()).getDisassembler();
							byte[] memory = ((VICEThread) event.getSource()).getComputerMemory();
							// We only care about disassembling once this time.
							// - [ ] Update the parts that have changed
							// - [ ] Assume that the changed parts is data, not code
//							if (disassembly == null || disassembly.isEmpty()) {
								disassembly = disassembler.disassemble(memory);
								StringBuilder sb = new StringBuilder();
								int lineNumber = 0;
								int startingLine = 0;
								for (Disassembly dis : disassembly) {
									sb.append(dis.getText());
									sb.append("\n");
									if (dis.getAddress() == pc) {
										startingLine = lineNumber;
									}
									lineNumber++;
								}
								Document document = new Document();
								document.set(sb.toString());
								final int line = startingLine;
								Display.getDefault().asyncExec(new Runnable() {
									@Override
									public void run() {
										viewer.setDocument(document, annotationModel);
										// Create a custom annotation
										IDocument document = viewer.getDocument();

										try {
											// Just add a breakpoint to for demonstration
											int startOffset;
											startOffset = document.getLineOffset(line - 1);
											int length = document.getLineLength(line - 1);
											extracted(startOffset, length);
										} catch (BadLocationException e) {
											// TODO Auto-generated catch block
											e.printStackTrace();
										}
										scrollToLine(viewer, line);
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

	private void extracted(int startOffset, int length) {
		Annotation annotation = new Annotation("net.resheim.eclipse.cc.pc", false, "Highlighting description");
		Position position = new Position(startOffset, length);
		annotationModel.addAnnotation(annotation, position);
		viewer.invalidateTextPresentation();
	}

	public static void scrollToLine(SourceViewer sourceViewer, int lineNumber) {
		System.out.println("Scrolling to line " + lineNumber);
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
