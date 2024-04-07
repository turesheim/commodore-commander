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
        CharStream charStream = CharStreams.fromString(code + "\n");
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
        parse("lda #$30");
    }

    @Test
    void testImmediateBinaryAddressing() {
        parse("lda #%01010101");
    }

    @Test
    void testImmediateDecimalAddressing() {
        parse("lda #00");
    }

    @Test
    void testImmediateWithLabelAddressing() {
        parse("lda label:#$ff");
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

    @Test
    void testJumpUnresolvedZeropage() {
        String code = """
                // Uses zeropage form of lda and sta eventhough the labels is first
                // resolved later
                lda zpReg1
                sta zpReg2

                *=$10 virtual
                .zp {
                zpReg1: .byte 0
                zpReg2: .byte 0
                }
                """;
        parse(code);
    }

    @Test
    void testZeropageAddressing() {
        parse("lda $30");
    }

    @Test
    void testZeropageXAddressing() {
        parse("lda $30,x");
    }

    @Test
    void testZeropageYAddressing() {
        parse("lda $30,y");
    }

    @Test
    void testIndirectZeropageYAddressing() {
        parse("lda ($30),y");
    }

    @Test
    void testAbsoluteAddressing() {
        parse("lda $1000");
    }

    @Test
    void testAbsoluteXAddressing() {
        parse("lda $1000,x");
    }

    @Test
    void testAbsoluteYAddressing() {
        parse("lda $1000,y");
    }

    @Test
    void testIndirectAddressing() {
        parse("lda ($1000)");
    }

    /**
     * Outputs bytes.
     */
    @Test
    public void testAssemblerDirective_byte() {
        parse(".byte $01,$02,$03");
    }

    /**
     * Defines a constant.
     */
    @Test
    public void testAssemblerDirective_const() {
        parse(".const DELAY=7");
    }

    /**
     * Changes the instruction set to a different CPU.
     */
    @Test
    public void testAssemblerDirective_cpu() {
        parse(".cpu _65c02");
    }

    /**
     * Executes a block of directives in 'function mode' (faster) to define values.
     */
    @Test
    public void testAssemblerDirective_define() {
        parse(".define width, height {...}");
    }

    /**
     * Creates a d64 image file.
     */
    @Test
    public void testAssemblerDirective_disk() {
        parse(".disk [..disk parameters..] {..file parameters..}");
    }

    /**
     * An alias for '.dword'.
     */
    @Test
    public void testAssemblerDirective_dw() {
        parse(".dw $12341234");
    }

    /**
     * Outputs double words (4 byte values).
     */
    @Test
    public void testAssemblerDirective_dword() {
        parse(".dword $12341234");
    }

    /**
     * Sets the character encoding.
     */
    @Test
    public void testAssemblerDirective_encoding() {
        parse(".encoding \"screencode_upper\"");
    }

    /**
     * Defines a series of constants.
     */
    @Test
    public void testAssemblerDirective_enum() {
        parse(".enum {on, off}");
    }

    /**
     * Creates a user raised error.
     */
    @Test
    public void testAssemblerDirective_error() {
        parse(".error \"not good!\"");
    }

    /**
     * Creates a user raised error if the condition is evaluated to true.
     */
    @Test
    public void testAssemblerDirective_errorif() {
        parse(".errorif x>10 \"not good!\"");
    }

    /**
     * Evaluates a script expression.
     */
    @Test
    public void testAssemblerDirective_eval() {
        parse(".eval x=x+y/2");
    }

    /**
     * Creates a prg or bin file from the given segments.
     */
    @Test
    public void testAssemblerDirective_file() {
        parse(".file [name=\"myfile.prg\" segments=\"Code, Data\"]");
    }

    /**
     * Modify the output of the current source file with the given modifier.
     */
    @Test
    public void testAssemblerDirective_filemodify() {
        parse(".filemodify Encrypt(33)");
    }

    /**
     * Creates a namespace for all the following directives in the current source
     * file.
     */
    @Test
    public void testAssemblerDirective_filenamespace() {
        parse(".filenamespace myspace");
    }

    /**
     * Fills a number of bytes with the value of a given expression.
     */
    @Test
    public void testAssemblerDirective_fill() {
        parse(".fill 10, i*2");
    }

    /**
     * Fills a number of words with the value of a given expression.
     */
    @Test
    public void testAssemblerDirective_fillword() {
        parse(".fillword 10, i*$102");
    }

    /**
     * Creates a for loop.
     */
    @Test
    public void testAssemblerDirective_for() {
        parse(".for(var i;i<10;i++) {...}");
    }

    /**
     * Defines a function.
     */
    @Test
    public void testAssemblerDirective_function() {
        parse(".function area(h,w) {..}");
    }

    /**
     * Executes code if the given condition is true.
     */
    @Test
    public void testAssemblerDirective_if() {
        parse(".if(x>10) {...}");
    }

    /**
     * Imports a binary file.
     */
    @Test
    public void testAssemblerDirective_importbinary() {
        parse(".import binary \"Music.bin\"");
    }

    /**
     * Imports a C64 file. Same as '.import binary', but ignores the two address
     * bytes at the start of the file.
     */
    @Test
    public void testAssemblerDirective_importc64() {
        parse(".import c64 \"Music.c64\"");
    }

    /**
     * Imports another source file. (Deprecated, use #import instead)
     */
    @Test
    public void testAssemblerDirective_importsource() {
        parse(".import source \"MyLib.asm\"");
    }

    /**
     * Imports a text file.
     */
    @Test
    public void testAssemblerDirective_importtext() {
        parse(".import text \"scroll.txt\"");
    }

    /**
     * Make the assembler skip the current file if it has already been imported.
     * (Deprecated, use #importonce instead)
     */
    @Test
    public void testAssemblerDirective_importonce() {
        parse(".importonce");
    }

    /**
     * Assigns a given expression to a label.
     */
    @Test
    public void testAssemblerDirective_label() {
        parse(".label color=$d020");
    }

    /**
     * Fills two tables with hi and lo byte of the given expression. The address of
     * the tables can be read by connecting a label.
     */
    @Test
    public void testAssemblerDirective_lohifill() {
        parse(".lohifill $100, i*40");
    }

    /**
     * Defines a macro.
     */
    @Test
    public void testAssemblerDirective_macro() {
        parse(".macro BasicUpstart() {...}");
    }

    /**
     * Defines a new memory block at the current memory position.
     */
    @Test
    public void testAssemblerDirective_memblock() {
        parse(".memblock \"New block\"");
    }

    /**
     * Modifies the output of a code block using the given modifier.
     */
    @Test
    public void testAssemblerDirective_modify() {
        parse(".modify Encrypt(27) {...}");
    }

    /**
     * Creates a local namespace.
     */
    @Test
    public void testAssemblerDirective_namespace() {
        parse(".namespace myspace {..}");
    }

    /**
     * Same as '*='.
     */
    @Test
    public void testAssemblerDirective_pc() {
        parse(".pc=$1000");
    }

    /**
     * Tells the assembler to look for a plugin at the given Java-package path.
     */
    @Test
    public void testAssemblerDirective_plugin() {
        parse(".plugin \"plugins.macros.MyMacro\"");
    }

    /**
     * Prints a message to the console in the last pass.
     */
    @Test
    public void testAssemblerDirective_print() {
        parse(".print \"Hello\"");
    }

    /**
     * Prints a message to the console immediately.
     */
    @Test
    public void testAssemblerDirective_printnow() {
        parse(".printnow \"Hello now\"");
    }

    /**
     * Defines a pseudocommand.
     */
    @Test
    public void testAssemblerDirective_pseudocommand() {
        parse(".pseudocommand mov src:tar {...}");
    }

    /**
     * Sets the program counter to something else than the actual memory position.
     */
    @Test
    public void testAssemblerDirective_pseudopc() {
        parse(".pseudopc $2000 {...}");
    }

    /**
     * Used inside functions to return a value.
     */
    @Test
    public void testAssemblerDirective_return() {
        parse(".return 27");
    }

    /**
     * Switches to another segment.
     */
    @Test
    public void testAssemblerDirective_segment() {
        parse(".segment Data \"My Data\"");
    }

    /**
     * Defines a segment.
     */
    @Test
    public void testAssemblerDirective_segmentdef() {
        parse(".segmentdef Data [start=$1000]");
    }

    /**
     * Output the bytes of an intermediate segment to the current memory block.
     */
    @Test
    public void testAssemblerDirective_segmentout() {
        parse(".segmentout [segments=\"DRIVE_CODE\"]");
    }

    /**
     * Creates a user-defined structure.
     */
    @Test
    public void testAssemblerDirective_struct() {
        parse(".struct Point {x,y}");
    }

    /**
     * An alias for '.text'.
     */
    @Test
    public void testAssemblerDirective_te() {
        parse(".te \"hello\"");
    }

    /**
     * Dumps text bytes to memory.
     */
    @Test
    public void testAssemblerDirective_text() {
        parse(".text \"hello\"");
    }

    /**
     * Defines a variable.
     */
    @Test
    public void testAssemblerDirective_var() {
        parse(".var x=27");
    }

    /**
     * Creates a while loop.
     */
    @Test
    public void testAssemblerDirective_while() {
        parse(".while(i<10) {...}");
    }

    /**
     * An alias for '.word'.
     */
    @Test
    public void testAssemblerDirective_wo() {
        parse(".wo $1000,$1012");
    }

    /**
     * Outputs words (two bytes values).
     */
    @Test
    public void testAssemblerDirective_word() {
        parse(".word $1000,$1012");
    }

    /**
     * Marks unresolved labels as being in the zero page.
     */
    @Test
    public void testAssemblerDirective_zp() {
        parse(".zp { label: .byte 0 ... }");
    }

}
