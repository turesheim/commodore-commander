package net.resheim.eclipse.cc.kickassembler.parser.test;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.BitSet;

import org.antlr.v4.runtime.ANTLRErrorListener;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStream;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.Parser;
import org.antlr.v4.runtime.ParserRuleContext;
import org.antlr.v4.runtime.RecognitionException;
import org.antlr.v4.runtime.Recognizer;
import org.antlr.v4.runtime.atn.ATNConfigSet;
import org.antlr.v4.runtime.dfa.DFA;
import org.antlr.v4.runtime.tree.ErrorNode;
import org.antlr.v4.runtime.tree.ParseTree;
import org.antlr.v4.runtime.tree.TerminalNode;
import org.junit.jupiter.api.Test;

import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerBaseListener;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerLexer;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerListener;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.AbsoluteContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.AbsoluteXContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.AbsoluteYContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.BlockDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ByteContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.CurrentAddressContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DataContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DataDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.DwordContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ImmediateContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.Import_codeContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.IndirectContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.IndirectIndexedContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.InstructionContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelIndexedContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelIndirectContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelReferenceContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelXContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LabelYContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.LineContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.NumberContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.OperandContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ProgramContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.TextContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.VariableDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.WordContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ZeroPageContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ZeroPageXContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ZeroPageYContext;

class KickAssemblerProjectTests {

    class Debugger extends KickAssemblerBaseListener {

        int dataLength = 0;
        ArrayList<Integer> lineLengths = new ArrayList<>();


        @Override
        public void exitByte(ByteContext ctx) {
            dataLength += ctx.getChildCount() / 2;
            lineLengths.add(ctx.getChildCount() / 2);
        }

        @Override
        public void enterWord(WordContext ctx) {
        }

        @Override
        public void exitWord(WordContext ctx) {
            dataLength += ctx.getChildCount();
        }

        @Override
        public void enterDword(DwordContext ctx) {
        }

        @Override
        public void exitDword(DwordContext ctx) {
        }

        @Override
        public void enterText(TextContext ctx) {
        }

        @Override
        public void exitText(TextContext ctx) {
        }

        @Override
        public void enterDataDeclaration(DataDeclarationContext ctx) {
            dataLength = 0;
            lineLengths.clear();
        }

        @Override
        public void exitDataDeclaration(DataDeclarationContext ctx) {
            System.err.println(ctx.name.getText() + ": " + dataLength);
            for (Integer integer : lineLengths) {
                System.err.println(integer);
            }
        }

    }

    private KickAssemblerParser parser;

    private ParseTree parse(CharStream charStream) {
        KickAssemblerLexer lexer = new KickAssemblerLexer(charStream);
        CommonTokenStream tokens = new CommonTokenStream(lexer);
        parser = new KickAssemblerParser(tokens);
        // parser.setErrorHandler(new BailErrorStrategy());
        parser.addParseListener(new Debugger());
        parser.setTrace(true);
        return parser.program();
    }
    @Test
    void testItema() throws Exception {
        File file = new File(getClass().getClassLoader().getResource("itema.asm").getFile());
        parse(CharStreams.fromReader(new FileReader(file, Charset.forName("utf-8"))));
    }

    void testItema2() throws Exception {
        File file = new File(getClass().getClassLoader().getResource("itema.asm").getFile());
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                parse(CharStreams.fromString(line + "\n", "itema.asm"));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }


}
