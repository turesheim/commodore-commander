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
package net.resheim.eclipse.cc.ui;

import java.text.MessageFormat;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.model.ILineBreakpoint;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.ui.IDebugModelPresentation;
import org.eclipse.debug.ui.IValueDetailListener;
import org.eclipse.jface.viewers.ILabelProviderListener;
import org.eclipse.swt.graphics.Image;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.part.FileEditorInput;

import net.resheim.eclipse.cc.editor.CommodoreCommanderPlugin;
import net.resheim.eclipse.cc.vice.debug.model.VICECheckpoint;
import net.resheim.eclipse.cc.vice.debug.model.data.ArrayValueRow;
import net.resheim.eclipse.cc.vice.debug.model.data.NamedDataVariable;

public class VICEDebugModelPresentation implements IDebugModelPresentation {

	private static final String ASSEMBLY_EDITOR = "net.resheim.eclipse.cc.ui.assembly.editor";

	@Override
	public void addListener(ILabelProviderListener listener) {
	}

	@Override
	public void dispose() {
	}

	@Override
	public boolean isLabelProperty(Object element, String property) {
		return false;
	}

	@Override
	public void removeListener(ILabelProviderListener listener) {
	}

	@Override
	public IEditorInput getEditorInput(Object element) {
		// figure out an editor input for the checkpoint so that a double click or
		// similar action will open an editor on the checkpoint
		if (element instanceof VICECheckpoint) {
			VICECheckpoint checkpoint = (VICECheckpoint) element;
			IResource resource = checkpoint.getMarker().getResource();
			if (resource instanceof IFile) {
				IFile file = (IFile) resource;
				return new FileEditorInput(file);
			}
		}
		if (element instanceof IFile) {
			return new FileEditorInput((IFile) element);
		}
		return null;
	}

	@Override
	public String getEditorId(IEditorInput input, Object element) {
		if (element instanceof VICECheckpoint) {
			return ASSEMBLY_EDITOR;
		}
		if (element instanceof IFile) {
			return ASSEMBLY_EDITOR;
		}
		return null;
	}

	@Override
	public void setAttribute(String attribute, Object value) {
	}

	@Override
	public Image getImage(Object element) {
		if (element instanceof ArrayValueRow) {
			return CommodoreCommanderPlugin.getPlugin().getImage(CommodoreCommanderPlugin.IMG_ARRAY_PARTITION);
		}
		if (element instanceof NamedDataVariable) {
			return CommodoreCommanderPlugin.getPlugin().getImage(CommodoreCommanderPlugin.IMG_ARRAY);
		}

		return null;
	}

	@Override
	public String getText(Object element) {
		if (element instanceof VICECheckpoint) {
			return getBreakpointText((VICECheckpoint) element);
		}
		return null;
	}

	@Override
	public void computeDetail(IValue value, IValueDetailListener listener) {
	}

	private String getBreakpointText(VICECheckpoint breakpoint) {
		IResource resource = breakpoint.getMarker().getResource();
		StringBuilder label = new StringBuilder();
		if (resource != null) {
			label.append(resource.getName());
		}
		try {
			int lineNumber = ((ILineBreakpoint) breakpoint).getLineNumber();
			label.append(MessageFormat.format(" [line: {0}] ${1}",
					new Object[] { Integer.toString(lineNumber), Integer.toHexString(breakpoint.getStartAddress()) }));
		} catch (CoreException e) {
		}
		return label.toString();
	}

}
