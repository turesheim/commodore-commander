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
    void testImmediateWithLabelAddressing() {
        parse("lda label:#$ff\n");
    }

    @Test
    void testIMultilLabelAddressingJumpBackward() {
        String code = """
                        ldx #100
                !loop:  inc $d020
                        dex
                        bne !loop- // Jumps to the previous instance of !loop

                        ldx #100
                !loop:  inc $d021
                        dex
                        bne !loop- // Jumps to the previous instance of !loop
                """;
        parse(code);
    }

    @Test
    void testIMultilLabelAddressingJumpForward() {
        String code = """
                        ldx #10
                !loop:
                        jmp !+ // Jumps over the two next nops to the ! label
                        nop
                        nop
                !:      jmp !+ // Jumps over the two next nops to the ! label
                        nop
                        nop
                !:
                        dex
                        bne !loop- // Jumps to the previous !loop label
                """;
        parse(code);
    }

    @Test
    void testIMultilLabelAddressingSkip() {
        String code = """
                        jmp !+++ // Jumps to the third '!' label
                !:      nop
                !:      nop
                !:              // <- here!
                """;
        parse(code);
    }

    @Test
    void testJumpWithCurrentAddress() {
        String code = """
                // Jumps with '*'
                        jmp *

                        inc $d020
                        inc $d021
                        jmp *-6

                """;
        parse(code);
    }

    @Test
    void testJumpWithLabel() {
        String code = """
                // The same jumps with labels
                this:   jmp this

                !loop:  inc $d020
                        inc $d021
                        jmp !loop-
                """;
        parse(code);
    }

//    @Test
//    void testJumpUnresolvedZeropage() {
//        String code = """
//                // Uses zeropage form of lda and sta eventhough the labels is first
//                // resolved later
//                lda zpReg1
//                sta zpReg2
//
//                *=$10 virtual
//                .zp {
//                zpReg1: .byte 0
//                zpReg2: .byte 0
//                }
//                """;
//        parse(code);
//    }

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
