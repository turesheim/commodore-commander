package net.resheim.eclipse.cc.kickassembler.parser.test;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.Charset;
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

import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerLexer;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerListener;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.AbsoluteContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.AbsoluteXContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.AbsoluteYContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.BlockDeclarationContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.CurrentAddressContext;
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
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ZeroPageContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ZeroPageXContext;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser.ZeroPageYContext;

class KickAssemblerProjectTests {

    class Debugger implements KickAssemblerListener {

        @Override
        public void enterEveryRule(ParserRuleContext arg0) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitEveryRule(ParserRuleContext arg0) {
            // TODO Auto-generated method stub

        }

        @Override
        public void visitErrorNode(ErrorNode arg0) {
            // TODO Auto-generated method stub

        }

        @Override
        public void visitTerminal(TerminalNode arg0) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterProgram(ProgramContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitProgram(ProgramContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLine(LineContext ctx) {
            System.out.println(ctx.getAltNumber() + "-" + ctx.getText());
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLine(LineContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterInstruction(InstructionContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitInstruction(InstructionContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabelDeclaration(LabelDeclarationContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabelDeclaration(LabelDeclarationContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterOperand(OperandContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitOperand(OperandContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterImmediate(ImmediateContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitImmediate(ImmediateContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterZeroPage(ZeroPageContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitZeroPage(ZeroPageContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterZeroPageX(ZeroPageXContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitZeroPageX(ZeroPageXContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterZeroPageY(ZeroPageYContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitZeroPageY(ZeroPageYContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterAbsolute(AbsoluteContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitAbsolute(AbsoluteContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterAbsoluteX(AbsoluteXContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitAbsoluteX(AbsoluteXContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterAbsoluteY(AbsoluteYContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitAbsoluteY(AbsoluteYContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterIndirect(IndirectContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitIndirect(IndirectContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterIndirectIndexed(IndirectIndexedContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitIndirectIndexed(IndirectIndexedContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabel(LabelContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabel(LabelContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabelX(LabelXContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabelX(LabelXContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabelY(LabelYContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabelY(LabelYContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabelIndirect(LabelIndirectContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabelIndirect(LabelIndirectContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabelIndexed(LabelIndexedContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabelIndexed(LabelIndexedContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterCurrentAddress(CurrentAddressContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitCurrentAddress(CurrentAddressContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterLabelReference(LabelReferenceContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitLabelReference(LabelReferenceContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterBlockDeclaration(BlockDeclarationContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitBlockDeclaration(BlockDeclarationContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterImport_code(Import_codeContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitImport_code(Import_codeContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void enterNumber(NumberContext ctx) {
            // TODO Auto-generated method stub

        }

        @Override
        public void exitNumber(NumberContext ctx) {
            // TODO Auto-generated method stub

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
