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

import org.antlr.v4.runtime.CharStream;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.DefaultErrorStrategy;
import org.antlr.v4.runtime.tree.ParseTree;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.IPath;

import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerBaseListener;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerLexer;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser;

/**
 * Utilises the {@link KickAssemblerParser} to find import statements and
 * creates an ordered list of these while also parsing the imported files in
 * order to create a tree.
 */
public class KickAssemblerProjectParser {

	class ImportParser extends KickAssemblerBaseListener {

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

	}

	private AssemblyFile root;

	public KickAssemblerProjectParser(AssemblyFile root) {
		this.root = root;
	}

	private ParseTree parse(CharStream charStream) {
		KickAssemblerLexer lexer = new KickAssemblerLexer(charStream);
		CommonTokenStream tokens = new CommonTokenStream(lexer);
		KickAssemblerParser parser = new KickAssemblerParser(tokens);
		parser.setErrorHandler(new DefaultErrorStrategy());
		parser.addParseListener(new ImportParser());
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
