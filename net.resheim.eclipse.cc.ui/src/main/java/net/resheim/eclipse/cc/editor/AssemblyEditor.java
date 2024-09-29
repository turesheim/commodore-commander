/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 * Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.cc.editor;

import org.eclipse.jface.text.ITextHover;
import org.eclipse.ui.editors.text.TextEditor;

/**
 *
 * XXX: Switching to basic TextEditor breaks some features provided by the
 * TextMate language configuration
 */
public class AssemblyEditor extends TextEditor {

	ITextHover fTextHover;

	public AssemblyEditor() {
		super();
	}

	public void initializeEditor() {
		super.initializeEditor();
		setSourceViewerConfiguration(new AssemblyViewerConfiguration());
	}

}
