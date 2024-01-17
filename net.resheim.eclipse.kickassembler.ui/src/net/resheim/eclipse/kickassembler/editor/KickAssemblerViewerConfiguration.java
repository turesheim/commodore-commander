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
package net.resheim.eclipse.kickassembler.editor;

import org.eclipse.jface.internal.text.html.BrowserInformationControl;
import org.eclipse.jface.resource.JFaceResources;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.IInformationControl;
import org.eclipse.jface.text.IInformationControlCreator;
import org.eclipse.jface.text.IRegion;
import org.eclipse.jface.text.ITextHover;
import org.eclipse.jface.text.ITextHoverExtension;
import org.eclipse.jface.text.ITextHoverExtension2;
import org.eclipse.jface.text.ITextViewer;
import org.eclipse.jface.text.Region;
import org.eclipse.jface.text.presentation.IPresentationReconciler;
import org.eclipse.jface.text.source.ISourceViewer;
import org.eclipse.jface.text.source.SourceViewerConfiguration;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.tm4e.ui.text.TMPresentationReconciler;

public class KickAssemblerViewerConfiguration extends SourceViewerConfiguration {

	private static final String CSS = """
			<head>
			<style>
			body {
			  background-color: linen;
			}

			h1 {
			  color: maroon;
			  font-family: monospace;
			  font-size: 10pt;
			  font-weight: bold;
			}
			</style>
			</head>
			""";

	public KickAssemblerViewerConfiguration() {
		super();
	}

	@Override
	public IPresentationReconciler getPresentationReconciler(final ISourceViewer viewer) {
		final var reconciler = new TMPresentationReconciler();
		return reconciler;
	}

	class TextHover implements ITextHover, ITextHoverExtension, ITextHoverExtension2 {

		/** This hover's source viewer */
		private ISourceViewer fSourceViewer;

		public TextHover(ISourceViewer sourceViewer) {
			this.fSourceViewer = sourceViewer;
			System.out.println(sourceViewer);
		}

		@Override
		public Object getHoverInfo2(ITextViewer textViewer, IRegion hoverRegion) {
			if (hoverRegion != null) {
				try {
					String hoveredText = textViewer.getDocument().get(hoverRegion.getOffset(), hoverRegion.getLength())
							.toUpperCase();
					IOMap.Entry entry = C64EditorPlugin.getPlugin().getIOMap().getEntriesMap().get(hoveredText);
					if (entry != null) {
						StringBuilder sb = new StringBuilder(CSS);
						sb.append("<h1>" + entry.getAddress());
						if (entry.getId() != null) {
							sb.append(" (" + entry.getId() + ")");
						}
						sb.append(" - " + entry.getName() + "</h1>");
						if (entry.getDescription() != null) {
							sb.append("<pre>" + entry.getDescription() + "</pre>");
						}
						return sb.toString();
				} else
					return null;
				} catch (BadLocationException e) {
				}
			}
			return null;
		}

		@Override
		public IRegion getHoverRegion(ITextViewer textViewer, int offset) {
			return findWord(textViewer.getDocument(), offset);
		}

		//
		private IRegion findWord(IDocument document, int offset) {
			int start = -2;
			int end = -1;

			try {

				int pos = offset;
				char c;

				while (pos >= 0) {
					c = document.getChar(pos);
					if (!Character.isUnicodeIdentifierPart(c) && c != '$' && c != '%')
						break;
					--pos;
				}

				start = pos;

				pos = offset;
				int length = document.getLength();

				while (pos < length) {
					c = document.getChar(pos);
					if (!Character.isUnicodeIdentifierPart(c) && c != '$' && c != '%')
						break;
					++pos;
				}

				end = pos;

			} catch (BadLocationException x) {
			}

			if (start >= -1 && end > -1) {
				if (start == offset && end == offset)
					return new Region(offset, 0);
				else if (start == offset)
					return new Region(start, end - start);
				else
					return new Region(start + 1, end - start - 1);
			}

			return null;
		}


		@Override
		public String getHoverInfo(ITextViewer textViewer, IRegion hoverRegion) {
			return (String) getHoverInfo2(textViewer, hoverRegion);
		}

		@Override
		public IInformationControlCreator getHoverControlCreator() {
			return new IInformationControlCreator() {

				@Override
				public IInformationControl createInformationControl(Shell parent) {
					return new DocumentationInformationControl(parent);
				}
			};
		}

	}

	@Override
	public ITextHover getTextHover(ISourceViewer sourceViewer, String contentType) {
		return new TextHover(sourceViewer);
	}

}
