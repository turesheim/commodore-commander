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

import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.ui.IDebugModelPresentation;
import org.eclipse.debug.ui.IValueDetailListener;
import org.eclipse.jface.viewers.ILabelProviderListener;
import org.eclipse.swt.graphics.Image;
import org.eclipse.ui.IEditorInput;

import net.resheim.eclipse.cc.vice.debug.model.Checkpoint;

// XXX: Currently not in use – we're keeping it for the future
public class CheckpointPresentation implements IDebugModelPresentation {

	@Override
	public void addListener(ILabelProviderListener listener) {
	}

	@Override
	public void dispose() {
		// TODO Auto-generated method stub

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
		return null;
	}

	@Override
	public String getEditorId(IEditorInput input, Object element) {
		return null;
	}

	@Override
	public void setAttribute(String attribute, Object value) {
		System.err.println(attribute + " > " + value);

	}

	@Override
	public Image getImage(Object element) {
		return null;
	}

	@Override
	public String getText(Object element) {
		if (element instanceof Checkpoint) {
			Checkpoint cp = (Checkpoint) element;
			StringBuilder sb = new StringBuilder();
			sb.append("Checkpoint at ");
			sb.append(String.format("$%04X", cp.getStartAddress()));
			return sb.toString();
		}
		return null;
	}

	@Override
	public void computeDetail(IValue value, IValueDetailListener listener) {
	}

}
