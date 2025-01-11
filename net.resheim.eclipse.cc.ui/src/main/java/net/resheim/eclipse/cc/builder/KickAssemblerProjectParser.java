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
package net.resheim.eclipse.cc.builder;

import java.io.File;
import java.io.FileReader;
import java.util.ArrayList;

import org.antlr.v4.runtime.CharStream;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.tree.ParseTree;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.IPath;

import net.resheim.eclipse.cc.builder.model.DataLabel;
import net.resheim.eclipse.cc.builder.model.Presentation;
import net.resheim.eclipse.cc.builder.model.Type;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerBaseListener;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerLexer;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ByteContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DataDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DwordContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.WordContext;

/**
 * Utilises the {@link KickAssemblerParser} to find import statements and
 * creates an ordered list of these while also parsing the imported files in
 * order to create a tree. We use this to find the top file and automatically
 * compile this, when there have been changes in it or one of it's imported
 * files.
 */
public class KickAssemblerProjectParser {
	// TODO: Add support for .text/.te

	private class Parser extends KickAssemblerBaseListener {

		/** The number of bytes in the current labeled data */
		private int dataLength = 0;

		private Presentation presentation;

		private Type type;

		/** The number of tokens fore each line in the current labeled data */
		private ArrayList<Integer> lineLengths = new ArrayList<>();

		@Override
		public void exitImport_code(KickAssemblerParser.Import_codeContext ctx) {
			String fileName = ctx.fileName.getText().replaceAll("\"", "");
			IResource resource = getRoot().getResource().getParent().findMember(fileName);
			AssemblyFile file = new AssemblyFile(resource, getRoot());
			getRoot().addInclusion(file);
			KickAssemblerProjectParser p2 = new KickAssemblerProjectParser(file);
			try {
				p2.parseFile(resource);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

		@Override
		public void exitByte(ByteContext ctx) {
			dataLength += ctx.getChildCount() / 2;
			lineLengths.add(ctx.getChildCount() / 2);
			type = Type.BYTE;
			if (ctx.getChild(1) != null) {
				char prefix = ctx.getChild(1).getText().charAt(0);
				switch (prefix) {
				case '$': {
					presentation = Presentation.HEXADECIMAL;
					break;
				}
				case '%': {
					presentation = Presentation.BINARY;
					break;
				}
				default:
					presentation = Presentation.DECIMAL;
				}
			}
		}

		@Override
		public void exitWord(WordContext ctx) {
			dataLength += ctx.getChildCount();
			lineLengths.add(ctx.getChildCount());
			type = Type.WORD;
			if (ctx.getChild(1) != null) {
				char prefix = ctx.getChild(1).getText().charAt(0);
				switch (prefix) {
				case '$': {
					presentation = Presentation.HEXADECIMAL;
					break;
				}
				case '%': {
					presentation = Presentation.BINARY;
					break;
				}
				default:
					presentation = Presentation.DECIMAL;
				}
			}
		}

		@Override
		public void exitDword(DwordContext ctx) {
			dataLength += ctx.getChildCount() * 2;
			lineLengths.add(ctx.getChildCount() * 2);
			type = Type.DWORD;
			if (ctx.getChild(1) != null) {
				char prefix = ctx.getChild(1).getText().charAt(0);
				switch (prefix) {
				case '$': {
					presentation = Presentation.HEXADECIMAL;
					break;
				}
				case '%': {
					presentation = Presentation.BINARY;
					break;
				}
				default:
					presentation = Presentation.DECIMAL;
				}
			}
		}

		@Override
		public void enterDataDeclaration(DataDeclarationContext ctx) {
			dataLength = 0;
			lineLengths.clear();
		}

		@Override
		public void exitDataDeclaration(DataDeclarationContext ctx) {
			root.addDataBlock(new DataLabel(ctx.name.getText(), dataLength,
					lineLengths.stream().mapToInt(Integer::intValue).toArray(), type, presentation));
		}

	}

	private AssemblyFile root;

	public KickAssemblerProjectParser(AssemblyFile root) {
		this.root = root;
	}

	private ParseTree parse(CharStream charStream) {
		KickAssemblerLexer lexer = new KickAssemblerLexer(charStream);
		CommonTokenStream tokens = new CommonTokenStream(lexer);
		KickAssemblerParser parser = new KickAssemblerParser(tokens);
		// parser.setErrorHandler(new DefaultErrorStrategy());
		parser.removeErrorListeners(); // less noise
		parser.addParseListener(new Parser());
		parser.setTrace(false);

		return parser.program();
	}

	public void parseFile(IResource resource) throws Exception {
		IPath path = resource.getRawLocation();
		File file = path.toFile();
		parse(CharStreams.fromReader(new FileReader(file)));
	}

	public AssemblyFile getRoot() {
		return root;
	}

}
