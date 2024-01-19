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
import org.eclipse.jface.text.presentation.IPresentationReconciler;
import org.eclipse.jface.text.source.ISourceViewer;
import org.eclipse.tm4e.ui.text.TMPresentationReconciler;
import org.eclipse.ui.editors.text.TextSourceViewerConfiguration;

// TODO: Considering including code from ExtensionBasedTextViewerConfiguration
public class KickAssemblerViewerConfiguration extends TextSourceViewerConfiguration {


	public KickAssemblerViewerConfiguration() {
		super();
	}

	@Override
	public IPresentationReconciler getPresentationReconciler(final ISourceViewer viewer) {
		final var reconciler = new TMPresentationReconciler();
		return reconciler;
	}

	@Override
	public ITextHover getTextHover(ISourceViewer sourceViewer, String contentType) {
		return new TextHover(sourceViewer);
	}

}
