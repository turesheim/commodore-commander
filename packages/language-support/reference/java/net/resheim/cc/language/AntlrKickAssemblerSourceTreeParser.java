/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.language;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.misc.ParseCancellationException;

import net.resheim.cc.core.debuginfo.DataLabel;
import net.resheim.cc.core.debuginfo.NumericPresentation;
import net.resheim.cc.core.debuginfo.ValueType;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerBaseListener;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerLexer;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ByteContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DataDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DwordContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.WordContext;

/**
 * This keeps using the legacy generated ANTLR parser for now, but the public
 * API is no longer tied to Eclipse resources or workspace lookups.
 */
public class AntlrKickAssemblerSourceTreeParser implements KickAssemblerSourceTreeParser {

    @Override
    public AssemblySourceNode parse(Path rootSource) throws IOException {
        Map<Path, AssemblySourceNode> visited = new LinkedHashMap<>();
        return parseSource(rootSource.toAbsolutePath().normalize(), visited);
    }

    private AssemblySourceNode parseSource(Path source, Map<Path, AssemblySourceNode> visited) throws IOException {
        AssemblySourceNode existing = visited.get(source);
        if (existing != null) {
            return existing;
        }
        AssemblySourceNode node = new AssemblySourceNode(source);
        visited.put(source, node);
        try (Reader reader = Files.newBufferedReader(source)) {
            parseReader(reader, source, node, visited);
        }
        return node;
    }

    private void parseReader(Reader reader, Path currentSource, AssemblySourceNode node,
            Map<Path, AssemblySourceNode> visited) throws IOException {
        KickAssemblerLexer lexer = new KickAssemblerLexer(CharStreams.fromReader(reader));
        CommonTokenStream tokens = new CommonTokenStream(lexer);
        KickAssemblerParser parser = new KickAssemblerParser(tokens);
        parser.removeErrorListeners();
        parser.setTrace(false);

        IOException[] deferredFailure = new IOException[1];

        parser.addParseListener(new KickAssemblerBaseListener() {

            private int dataLength = 0;
            private NumericPresentation presentation;
            private ValueType type;
            private final ArrayList<Integer> lineLengths = new ArrayList<>();

            @Override
            public void exitImport_code(KickAssemblerParser.Import_codeContext ctx) {
                Path resolved = resolveImport(ctx.fileName.getText().replace("\"", ""), currentSource);
                if (!Files.exists(resolved)) {
                    node.addUnresolvedInclude(resolved);
                    return;
                }
                try {
                    node.addInclusion(parseSource(resolved, visited));
                } catch (IOException exception) {
                    deferredFailure[0] = exception;
                    throw new ParseCancellationException(exception);
                }
            }

            @Override
            public void enterDataDeclaration(DataDeclarationContext ctx) {
                dataLength = 0;
                lineLengths.clear();
            }

            @Override
            public void exitDataDeclaration(DataDeclarationContext ctx) {
                node.addDataLabel(new DataLabel(ctx.name.getText(), dataLength,
                        lineLengths.stream().mapToInt(Integer::intValue).toArray(), type, presentation));
            }

            @Override
            public void exitByte(ByteContext ctx) {
                int count = ctx.getChildCount() / 2;
                dataLength += count;
                lineLengths.add(count);
                type = ValueType.BYTE;
                presentation = presentationForLiteral(ctx.getChild(1) == null ? null : ctx.getChild(1).getText());
            }

            @Override
            public void exitWord(WordContext ctx) {
                int count = ctx.getChildCount();
                dataLength += count;
                lineLengths.add(count);
                type = ValueType.WORD;
                presentation = presentationForLiteral(ctx.getChild(1) == null ? null : ctx.getChild(1).getText());
            }

            @Override
            public void exitDword(DwordContext ctx) {
                int count = ctx.getChildCount() * 2;
                dataLength += count;
                lineLengths.add(count);
                type = ValueType.DWORD;
                presentation = presentationForLiteral(ctx.getChild(1) == null ? null : ctx.getChild(1).getText());
            }
        });

        try {
            parser.program();
        } catch (UncheckedIOException exception) {
            throw exception.getCause();
        } catch (ParseCancellationException exception) {
            if (deferredFailure[0] != null) {
                throw deferredFailure[0];
            }
            throw exception;
        }

        if (deferredFailure[0] != null) {
            throw deferredFailure[0];
        }
    }

    private static Path resolveImport(String fileName, Path currentSource) {
        Path currentDirectory = currentSource.getParent();
        if (currentDirectory == null) {
            return Path.of(fileName).toAbsolutePath().normalize();
        }
        return currentDirectory.resolve(fileName).toAbsolutePath().normalize();
    }

    private static NumericPresentation presentationForLiteral(String token) {
        if (token == null || token.isBlank()) {
            return NumericPresentation.DECIMAL;
        }
        switch (token.charAt(0)) {
        case '$':
            return NumericPresentation.HEXADECIMAL;
        case '%':
            return NumericPresentation.BINARY;
        default:
            return NumericPresentation.DECIMAL;
        }
    }
}
