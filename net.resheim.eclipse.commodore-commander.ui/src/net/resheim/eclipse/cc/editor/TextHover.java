package net.resheim.eclipse.cc.editor;

import org.eclipse.jface.internal.text.html.BrowserInformationControl;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.IInformationControl;
import org.eclipse.jface.text.IInformationControlCreator;
import org.eclipse.jface.text.IInformationControlExtension2;
import org.eclipse.jface.text.IRegion;
import org.eclipse.jface.text.ITextHover;
import org.eclipse.jface.text.ITextHoverExtension;
import org.eclipse.jface.text.ITextHoverExtension2;
import org.eclipse.jface.text.ITextViewer;
import org.eclipse.jface.text.Region;
import org.eclipse.jface.text.source.ISourceViewer;
import org.eclipse.swt.widgets.Shell;

import net.resheim.eclipse.cc.editor.IOMap.Entry;
import net.resheim.eclipse.cc.editor.Mnemonics.Mnemonic;

class TextHover implements ITextHover, ITextHoverExtension {
	// CSS Colors: http://davidbau.com/colors/
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
			table {
				border: 1px solid black;
				width: 100%;
			}
			td, th {
				padding: 4px;
				margin: 0px;
				font-family: monospace;
				font-size: 9pt;
			}
			tr {
				background-color: bisque;
			}
			tr:nth-child(even) {
				background-color: tan;
			}
			</style>
			</head>
			""";

	/** This hover's source viewer */
	private ISourceViewer fSourceViewer;

	public TextHover(ISourceViewer sourceViewer) {
		this.fSourceViewer = sourceViewer;
	}

	/**
	 * It would be better to implement {@link ITextHoverExtension2}, but we're
	 * running into trouble when attempting to use
	 * {@link IInformationControlExtension2} in
	 * {@link DocumentationInformationControl} and returning the
	 * {@link BrowserInformationControl} which expects different types of input. So
	 * this is a bit ugly but works just fine.
	 */
	@Override
	public String getHoverInfo(ITextViewer textViewer, IRegion hoverRegion) {
		if (hoverRegion != null) {
			try {
				String hoveredText = textViewer.getDocument().get(hoverRegion.getOffset(), hoverRegion.getLength())
						.toUpperCase();
				IOMap.Entry entry = C64EditorPlugin.getPlugin().getIOMap().getEntriesMap().get(hoveredText);
				if (entry != null) {
					return getHTML(entry);
				}
				Mnemonics.Mnemonic mnemonic = C64EditorPlugin.getPlugin().getMnemonics().getMnemonicMap()
						.get(hoveredText);
				if (mnemonic != null) {
					return getHTML(mnemonic);
				}
			} catch (BadLocationException e) {
			}
		}
		return null;
	}

	@Override
	public IRegion getHoverRegion(ITextViewer textViewer, int offset) {
		return findWord(textViewer.getDocument(), offset);
	}

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
	public IInformationControlCreator getHoverControlCreator() {
		return new IInformationControlCreator() {

			@Override
			public IInformationControl createInformationControl(Shell parent) {
				return new DocumentationInformationControl(parent, source);
			}
		};

	}

	private String source = "";

	public String getHTML(Object input) {
		if (input instanceof Entry) {
			Entry entry = (Entry) input;
			StringBuilder sb = new StringBuilder(CSS);
			sb.append("<h1>" + entry.getAddress());
			if (entry.getId() != null) {
				sb.append(" (" + entry.getId() + ")");
			}
			sb.append(" - " + entry.getName() + "</h1>");
			if (entry.getDescription() != null) {
				sb.append(entry.getDescription());
			}
			source = "Commodore 64 I/O Map";
			return sb.toString();
		}
		if (input instanceof Mnemonic) {
			Mnemonic mnemonic = (Mnemonic) input;
			StringBuilder sb = new StringBuilder(CSS);
			sb.append("<h1>" + mnemonic.getId() + " - " + mnemonic.getName() + "</h1>");
			if (mnemonic.getDescription() != null) {
				sb.append(mnemonic.getDescription());
			}
			source = "MOS 6502 Mnemonic Descriptions";
			return sb.toString();
		}
		return null;
	}

}