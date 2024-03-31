package net.resheim.eclipse.cc.kickassembler.parser.test;

import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStream;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.tree.ParseTree;
import org.junit.jupiter.api.Test;

import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerLexer;
import net.resheim.eclipse.cc.kickassembler.parser.KickAssemblerParser;

class KickAssemblerGrammarTest {

    private KickAssemblerParser parser;

    // Utility method to parse a given string input
    private ParseTree parse(String code) {
        CharStream charStream = CharStreams.fromString(code);
        KickAssemblerLexer lexer = new KickAssemblerLexer(charStream);
        CommonTokenStream tokens = new CommonTokenStream(lexer);
        parser = new KickAssemblerParser(tokens);
        parser.setErrorHandler(new BailErrorStrategy());
        parser.setTrace(true);
        return parser.program();
    }

    @Test
    void testLabelInstruction() {
        String code = """
                loop: inc $20
                      jmp loop
                """;
        parse(code);
    }

    @Test
    void testNoArgumentInstruction() {
        String code = """
                nop
                brk
                """;
        parse(code);
    }

    @Test
    void testImmediateHexAddressing() {
        parse("lda #$30\n");
    }

    @Test
    void testImmediateBinaryAddressing() {
        parse("lda #%01010101\n");
    }

    @Test
    void testImmediateDecimalAddressing() {
        parse("lda #00\n");
    }

    @Test
    void testZeropageAddressing() {
        parse("lda $30\n");
    }

    @Test
    void testZeropageXAddressing() {
        parse("lda $30,x\n");
    }

    @Test
    void testZeropageYAddressing() {
        parse("lda $30,y\n");
    }

    @Test
    void testIndirectZeropageYAddressing() {
        parse("lda ($30),y\n");
    }

    @Test
    void testAbsoluteAddressing() {
        parse("lda $1000\n");
    }

    @Test
    void testAbsoluteXAddressing() {
        parse("lda $1000,x\n");
    }

    @Test
    void testAbsoluteYAddressing() {
        parse("lda $1000,y\n");
    }

    @Test
    void testIndirectAddressing() {
        parse("lda ($1000)\n");
    }

}
