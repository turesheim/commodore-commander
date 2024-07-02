package net.resheim.eclipse.cc.kickassembler.parser;

import org.antlr.v4.runtime.ParserRuleContext;
import org.antlr.v4.runtime.tree.ErrorNode;
import org.antlr.v4.runtime.tree.TerminalNode;

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

public abstract class AbstractKickAssemblerListener implements KickAssemblerListener {

    @Override
    public void visitTerminal(TerminalNode node) {
    }

    @Override
    public void visitErrorNode(ErrorNode node) {
    }

    @Override
    public void enterEveryRule(ParserRuleContext ctx) {
    }

    @Override
    public void exitEveryRule(ParserRuleContext ctx) {
    }

    @Override
    public void enterAbsolute(AbsoluteContext arg0) {
    }

    @Override
    public void enterAbsoluteX(AbsoluteXContext arg0) {
    }

    @Override
    public void enterAbsoluteY(AbsoluteYContext arg0) {
    }

    @Override
    public void enterBlockDeclaration(BlockDeclarationContext arg0) {
    }

    @Override
    public void enterCurrentAddress(CurrentAddressContext arg0) {
    }

    @Override
    public void enterImmediate(ImmediateContext arg0) {
    }

    @Override
    public void enterImport_code(Import_codeContext arg0) {
    }

    @Override
    public void enterIndirect(IndirectContext arg0) {
    }

    @Override
    public void enterIndirectIndexed(IndirectIndexedContext arg0) {
    }

    @Override
    public void enterInstruction(InstructionContext arg0) {
    }

    @Override
    public void enterLabel(LabelContext arg0) {
    }

    @Override
    public void enterLabelDeclaration(LabelDeclarationContext arg0) {
    }

    @Override
    public void enterLabelIndexed(LabelIndexedContext arg0) {
    }

    @Override
    public void enterLabelIndirect(LabelIndirectContext arg0) {
    }

    @Override
    public void enterLabelReference(LabelReferenceContext arg0) {
    }

    @Override
    public void enterLabelX(LabelXContext arg0) {
    }

    @Override
    public void enterLabelY(LabelYContext arg0) {
    }

    @Override
    public void enterLine(LineContext arg0) {
    }

    @Override
    public void enterNumber(NumberContext arg0) {
    }

    @Override
    public void enterOperand(OperandContext arg0) {
    }

    @Override
    public void enterProgram(ProgramContext arg0) {
    }

    @Override
    public void enterZeroPage(ZeroPageContext arg0) {
    }

    @Override
    public void enterZeroPageX(ZeroPageXContext arg0) {
    }

    @Override
    public void enterZeroPageY(ZeroPageYContext arg0) {
    }

    @Override
    public void exitAbsolute(AbsoluteContext arg0) {
    }

    @Override
    public void exitAbsoluteX(AbsoluteXContext arg0) {
    }

    @Override
    public void exitAbsoluteY(AbsoluteYContext arg0) {
    }

    @Override
    public void exitBlockDeclaration(BlockDeclarationContext arg0) {
    }

    @Override
    public void exitCurrentAddress(CurrentAddressContext arg0) {
    }

    @Override
    public void exitImmediate(ImmediateContext arg0) {
    }

    @Override
    public void exitImport_code(Import_codeContext arg0) {
    }

    @Override
    public void exitIndirect(IndirectContext arg0) {
    }

    @Override
    public void exitIndirectIndexed(IndirectIndexedContext arg0) {
    }

    @Override
    public void exitInstruction(InstructionContext arg0) {
    }

    @Override
    public void exitLabel(LabelContext arg0) {
    }

    @Override
    public void exitLabelDeclaration(LabelDeclarationContext arg0) {
    }

    @Override
    public void exitLabelIndexed(LabelIndexedContext arg0) {
    }

    @Override
    public void exitLabelIndirect(LabelIndirectContext arg0) {
    }

    @Override
    public void exitLabelReference(LabelReferenceContext arg0) {
    }

    @Override
    public void exitLabelX(LabelXContext arg0) {
    }

    @Override
    public void exitLabelY(LabelYContext arg0) {
    }

    @Override
    public void exitLine(LineContext arg0) {
    }

    @Override
    public void exitNumber(NumberContext arg0) {
    }

    @Override
    public void exitOperand(OperandContext arg0) {
    }

    @Override
    public void exitProgram(ProgramContext arg0) {
    }

    @Override
    public void exitZeroPage(ZeroPageContext arg0) {
    }

    @Override
    public void exitZeroPageX(ZeroPageXContext arg0) {
    }

    @Override
    public void exitZeroPageY(ZeroPageYContext arg0) {
    }

}
