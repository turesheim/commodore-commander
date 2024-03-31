// Generated from KickAssembler.g4 by ANTLR 4.13.1
package net.resheim.eclipse.cc.kickassembler.parser;
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link KickAssemblerParser}.
 */
public interface KickAssemblerListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#program}.
	 * @param ctx the parse tree
	 */
	void enterProgram(KickAssemblerParser.ProgramContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#program}.
	 * @param ctx the parse tree
	 */
	void exitProgram(KickAssemblerParser.ProgramContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#line}.
	 * @param ctx the parse tree
	 */
	void enterLine(KickAssemblerParser.LineContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#line}.
	 * @param ctx the parse tree
	 */
	void exitLine(KickAssemblerParser.LineContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#instruction}.
	 * @param ctx the parse tree
	 */
	void enterInstruction(KickAssemblerParser.InstructionContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#instruction}.
	 * @param ctx the parse tree
	 */
	void exitInstruction(KickAssemblerParser.InstructionContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#labelDeclaration}.
	 * @param ctx the parse tree
	 */
	void enterLabelDeclaration(KickAssemblerParser.LabelDeclarationContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#labelDeclaration}.
	 * @param ctx the parse tree
	 */
	void exitLabelDeclaration(KickAssemblerParser.LabelDeclarationContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#operand}.
	 * @param ctx the parse tree
	 */
	void enterOperand(KickAssemblerParser.OperandContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#operand}.
	 * @param ctx the parse tree
	 */
	void exitOperand(KickAssemblerParser.OperandContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#immediate}.
	 * @param ctx the parse tree
	 */
	void enterImmediate(KickAssemblerParser.ImmediateContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#immediate}.
	 * @param ctx the parse tree
	 */
	void exitImmediate(KickAssemblerParser.ImmediateContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#zeroPage}.
	 * @param ctx the parse tree
	 */
	void enterZeroPage(KickAssemblerParser.ZeroPageContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#zeroPage}.
	 * @param ctx the parse tree
	 */
	void exitZeroPage(KickAssemblerParser.ZeroPageContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#zeroPageX}.
	 * @param ctx the parse tree
	 */
	void enterZeroPageX(KickAssemblerParser.ZeroPageXContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#zeroPageX}.
	 * @param ctx the parse tree
	 */
	void exitZeroPageX(KickAssemblerParser.ZeroPageXContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#zeroPageY}.
	 * @param ctx the parse tree
	 */
	void enterZeroPageY(KickAssemblerParser.ZeroPageYContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#zeroPageY}.
	 * @param ctx the parse tree
	 */
	void exitZeroPageY(KickAssemblerParser.ZeroPageYContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#absolute}.
	 * @param ctx the parse tree
	 */
	void enterAbsolute(KickAssemblerParser.AbsoluteContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#absolute}.
	 * @param ctx the parse tree
	 */
	void exitAbsolute(KickAssemblerParser.AbsoluteContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#absoluteX}.
	 * @param ctx the parse tree
	 */
	void enterAbsoluteX(KickAssemblerParser.AbsoluteXContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#absoluteX}.
	 * @param ctx the parse tree
	 */
	void exitAbsoluteX(KickAssemblerParser.AbsoluteXContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#absoluteY}.
	 * @param ctx the parse tree
	 */
	void enterAbsoluteY(KickAssemblerParser.AbsoluteYContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#absoluteY}.
	 * @param ctx the parse tree
	 */
	void exitAbsoluteY(KickAssemblerParser.AbsoluteYContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#indirect}.
	 * @param ctx the parse tree
	 */
	void enterIndirect(KickAssemblerParser.IndirectContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#indirect}.
	 * @param ctx the parse tree
	 */
	void exitIndirect(KickAssemblerParser.IndirectContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#indirectIndexed}.
	 * @param ctx the parse tree
	 */
	void enterIndirectIndexed(KickAssemblerParser.IndirectIndexedContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#indirectIndexed}.
	 * @param ctx the parse tree
	 */
	void exitIndirectIndexed(KickAssemblerParser.IndirectIndexedContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#label}.
	 * @param ctx the parse tree
	 */
	void enterLabel(KickAssemblerParser.LabelContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#label}.
	 * @param ctx the parse tree
	 */
	void exitLabel(KickAssemblerParser.LabelContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#labelX}.
	 * @param ctx the parse tree
	 */
	void enterLabelX(KickAssemblerParser.LabelXContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#labelX}.
	 * @param ctx the parse tree
	 */
	void exitLabelX(KickAssemblerParser.LabelXContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#labelY}.
	 * @param ctx the parse tree
	 */
	void enterLabelY(KickAssemblerParser.LabelYContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#labelY}.
	 * @param ctx the parse tree
	 */
	void exitLabelY(KickAssemblerParser.LabelYContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#labelIndirect}.
	 * @param ctx the parse tree
	 */
	void enterLabelIndirect(KickAssemblerParser.LabelIndirectContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#labelIndirect}.
	 * @param ctx the parse tree
	 */
	void exitLabelIndirect(KickAssemblerParser.LabelIndirectContext ctx);
	/**
	 * Enter a parse tree produced by {@link KickAssemblerParser#labelIndexed}.
	 * @param ctx the parse tree
	 */
	void enterLabelIndexed(KickAssemblerParser.LabelIndexedContext ctx);
	/**
	 * Exit a parse tree produced by {@link KickAssemblerParser#labelIndexed}.
	 * @param ctx the parse tree
	 */
	void exitLabelIndexed(KickAssemblerParser.LabelIndexedContext ctx);
}