// Generated from KickAssembler.g4 by ANTLR 4.13.1
package net.resheim.eclipse.cc.kickassembler.parser;
import org.antlr.v4.runtime.atn.*;
import org.antlr.v4.runtime.dfa.DFA;
import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.misc.*;
import org.antlr.v4.runtime.tree.*;
import java.util.List;
import java.util.Iterator;
import java.util.ArrayList;

@SuppressWarnings({"all", "warnings", "unchecked", "unused", "cast", "CheckReturnValue"})
public class KickAssemblerParser extends Parser {
	static { RuntimeMetaData.checkVersion("4.13.1", RuntimeMetaData.VERSION); }

	protected static final DFA[] _decisionToDFA;
	protected static final PredictionContextCache _sharedContextCache =
		new PredictionContextCache();
	public static final int
		BLOCK_COMMENT=1, LINE_COMMENT=2, OPCODE=3, COLON=4, HASH=5, COMMA=6, X=7, 
		Y=8, LEFT_PAREN=9, RIGHT_PAREN=10, SEMI=11, EOL=12, WS=13, IDENTIFIER=14, 
		HEX_LITERAL=15, HEX_LONG_LITERAL=16, HEX_DIGIT=17, BINARY_LITERAL=18, 
		DECIMAL_LITERAL=19;
	public static final int
		RULE_program = 0, RULE_line = 1, RULE_instruction = 2, RULE_labelDeclaration = 3, 
		RULE_operand = 4, RULE_immediate = 5, RULE_zeroPage = 6, RULE_zeroPageX = 7, 
		RULE_zeroPageY = 8, RULE_absolute = 9, RULE_absoluteX = 10, RULE_absoluteY = 11, 
		RULE_indirect = 12, RULE_indirectIndexed = 13, RULE_label = 14, RULE_labelX = 15, 
		RULE_labelY = 16, RULE_labelIndirect = 17, RULE_labelIndexed = 18;
	private static String[] makeRuleNames() {
		return new String[] {
			"program", "line", "instruction", "labelDeclaration", "operand", "immediate", 
			"zeroPage", "zeroPageX", "zeroPageY", "absolute", "absoluteX", "absoluteY", 
			"indirect", "indirectIndexed", "label", "labelX", "labelY", "labelIndirect", 
			"labelIndexed"
		};
	}
	public static final String[] ruleNames = makeRuleNames();

	private static String[] makeLiteralNames() {
		return new String[] {
			null, null, null, null, "':'", "'#'", "','", "'x'", "'y'", "'('", "')'", 
			"';'"
		};
	}
	private static final String[] _LITERAL_NAMES = makeLiteralNames();
	private static String[] makeSymbolicNames() {
		return new String[] {
			null, "BLOCK_COMMENT", "LINE_COMMENT", "OPCODE", "COLON", "HASH", "COMMA", 
			"X", "Y", "LEFT_PAREN", "RIGHT_PAREN", "SEMI", "EOL", "WS", "IDENTIFIER", 
			"HEX_LITERAL", "HEX_LONG_LITERAL", "HEX_DIGIT", "BINARY_LITERAL", "DECIMAL_LITERAL"
		};
	}
	private static final String[] _SYMBOLIC_NAMES = makeSymbolicNames();
	public static final Vocabulary VOCABULARY = new VocabularyImpl(_LITERAL_NAMES, _SYMBOLIC_NAMES);

	/**
	 * @deprecated Use {@link #VOCABULARY} instead.
	 */
	@Deprecated
	public static final String[] tokenNames;
	static {
		tokenNames = new String[_SYMBOLIC_NAMES.length];
		for (int i = 0; i < tokenNames.length; i++) {
			tokenNames[i] = VOCABULARY.getLiteralName(i);
			if (tokenNames[i] == null) {
				tokenNames[i] = VOCABULARY.getSymbolicName(i);
			}

			if (tokenNames[i] == null) {
				tokenNames[i] = "<INVALID>";
			}
		}
	}

	@Override
	@Deprecated
	public String[] getTokenNames() {
		return tokenNames;
	}

	@Override

	public Vocabulary getVocabulary() {
		return VOCABULARY;
	}

	@Override
	public String getGrammarFileName() { return "KickAssembler.g4"; }

	@Override
	public String[] getRuleNames() { return ruleNames; }

	@Override
	public String getSerializedATN() { return _serializedATN; }

	@Override
	public ATN getATN() { return _ATN; }

	public KickAssemblerParser(TokenStream input) {
		super(input);
		_interp = new ParserATNSimulator(this,_ATN,_decisionToDFA,_sharedContextCache);
	}

	@SuppressWarnings("CheckReturnValue")
	public static class ProgramContext extends ParserRuleContext {
		public TerminalNode EOF() { return getToken(KickAssemblerParser.EOF, 0); }
		public List<LineContext> line() {
			return getRuleContexts(LineContext.class);
		}
		public LineContext line(int i) {
			return getRuleContext(LineContext.class,i);
		}
		public ProgramContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_program; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterProgram(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitProgram(this);
		}
	}

	public final ProgramContext program() throws RecognitionException {
		ProgramContext _localctx = new ProgramContext(_ctx, getState());
		enterRule(_localctx, 0, RULE_program);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(41);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while ((((_la) & ~0x3f) == 0 && ((1L << _la) & 20488L) != 0)) {
				{
				{
				setState(38);
				line();
				}
				}
				setState(43);
				_errHandler.sync(this);
				_la = _input.LA(1);
			}
			setState(44);
			match(EOF);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LineContext extends ParserRuleContext {
		public TerminalNode EOL() { return getToken(KickAssemblerParser.EOL, 0); }
		public InstructionContext instruction() {
			return getRuleContext(InstructionContext.class,0);
		}
		public LabelDeclarationContext labelDeclaration() {
			return getRuleContext(LabelDeclarationContext.class,0);
		}
		public LineContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_line; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLine(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLine(this);
		}
	}

	public final LineContext line() throws RecognitionException {
		LineContext _localctx = new LineContext(_ctx, getState());
		enterRule(_localctx, 2, RULE_line);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(48);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,1,_ctx) ) {
			case 1:
				{
				setState(46);
				instruction();
				}
				break;
			case 2:
				{
				setState(47);
				labelDeclaration();
				}
				break;
			}
			setState(50);
			match(EOL);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class InstructionContext extends ParserRuleContext {
		public TerminalNode OPCODE() { return getToken(KickAssemblerParser.OPCODE, 0); }
		public LabelDeclarationContext labelDeclaration() {
			return getRuleContext(LabelDeclarationContext.class,0);
		}
		public OperandContext operand() {
			return getRuleContext(OperandContext.class,0);
		}
		public InstructionContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_instruction; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterInstruction(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitInstruction(this);
		}
	}

	public final InstructionContext instruction() throws RecognitionException {
		InstructionContext _localctx = new InstructionContext(_ctx, getState());
		enterRule(_localctx, 4, RULE_instruction);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(53);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(52);
				labelDeclaration();
				}
			}

			setState(55);
			match(OPCODE);
			setState(57);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 115232L) != 0)) {
				{
				setState(56);
				operand();
				}
			}

			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LabelDeclarationContext extends ParserRuleContext {
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode COLON() { return getToken(KickAssemblerParser.COLON, 0); }
		public LabelDeclarationContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_labelDeclaration; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabelDeclaration(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabelDeclaration(this);
		}
	}

	public final LabelDeclarationContext labelDeclaration() throws RecognitionException {
		LabelDeclarationContext _localctx = new LabelDeclarationContext(_ctx, getState());
		enterRule(_localctx, 6, RULE_labelDeclaration);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(59);
			match(IDENTIFIER);
			setState(60);
			match(COLON);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class OperandContext extends ParserRuleContext {
		public ImmediateContext immediate() {
			return getRuleContext(ImmediateContext.class,0);
		}
		public ZeroPageContext zeroPage() {
			return getRuleContext(ZeroPageContext.class,0);
		}
		public ZeroPageXContext zeroPageX() {
			return getRuleContext(ZeroPageXContext.class,0);
		}
		public ZeroPageYContext zeroPageY() {
			return getRuleContext(ZeroPageYContext.class,0);
		}
		public AbsoluteContext absolute() {
			return getRuleContext(AbsoluteContext.class,0);
		}
		public AbsoluteXContext absoluteX() {
			return getRuleContext(AbsoluteXContext.class,0);
		}
		public AbsoluteYContext absoluteY() {
			return getRuleContext(AbsoluteYContext.class,0);
		}
		public IndirectContext indirect() {
			return getRuleContext(IndirectContext.class,0);
		}
		public IndirectIndexedContext indirectIndexed() {
			return getRuleContext(IndirectIndexedContext.class,0);
		}
		public LabelContext label() {
			return getRuleContext(LabelContext.class,0);
		}
		public LabelXContext labelX() {
			return getRuleContext(LabelXContext.class,0);
		}
		public LabelYContext labelY() {
			return getRuleContext(LabelYContext.class,0);
		}
		public LabelIndirectContext labelIndirect() {
			return getRuleContext(LabelIndirectContext.class,0);
		}
		public LabelIndexedContext labelIndexed() {
			return getRuleContext(LabelIndexedContext.class,0);
		}
		public OperandContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_operand; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterOperand(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitOperand(this);
		}
	}

	public final OperandContext operand() throws RecognitionException {
		OperandContext _localctx = new OperandContext(_ctx, getState());
		enterRule(_localctx, 8, RULE_operand);
		try {
			setState(76);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,4,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(62);
				immediate();
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(63);
				zeroPage();
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(64);
				zeroPageX();
				}
				break;
			case 4:
				enterOuterAlt(_localctx, 4);
				{
				setState(65);
				zeroPageY();
				}
				break;
			case 5:
				enterOuterAlt(_localctx, 5);
				{
				setState(66);
				absolute();
				}
				break;
			case 6:
				enterOuterAlt(_localctx, 6);
				{
				setState(67);
				absoluteX();
				}
				break;
			case 7:
				enterOuterAlt(_localctx, 7);
				{
				setState(68);
				absoluteY();
				}
				break;
			case 8:
				enterOuterAlt(_localctx, 8);
				{
				setState(69);
				indirect();
				}
				break;
			case 9:
				enterOuterAlt(_localctx, 9);
				{
				setState(70);
				indirectIndexed();
				}
				break;
			case 10:
				enterOuterAlt(_localctx, 10);
				{
				setState(71);
				label();
				}
				break;
			case 11:
				enterOuterAlt(_localctx, 11);
				{
				setState(72);
				labelX();
				}
				break;
			case 12:
				enterOuterAlt(_localctx, 12);
				{
				setState(73);
				labelY();
				}
				break;
			case 13:
				enterOuterAlt(_localctx, 13);
				{
				setState(74);
				labelIndirect();
				}
				break;
			case 14:
				enterOuterAlt(_localctx, 14);
				{
				setState(75);
				labelIndexed();
				}
				break;
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class ImmediateContext extends ParserRuleContext {
		public TerminalNode HASH() { return getToken(KickAssemblerParser.HASH, 0); }
		public TerminalNode HEX_LITERAL() { return getToken(KickAssemblerParser.HEX_LITERAL, 0); }
		public TerminalNode BINARY_LITERAL() { return getToken(KickAssemblerParser.BINARY_LITERAL, 0); }
		public TerminalNode DECIMAL_LITERAL() { return getToken(KickAssemblerParser.DECIMAL_LITERAL, 0); }
		public ImmediateContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_immediate; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterImmediate(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitImmediate(this);
		}
	}

	public final ImmediateContext immediate() throws RecognitionException {
		ImmediateContext _localctx = new ImmediateContext(_ctx, getState());
		enterRule(_localctx, 10, RULE_immediate);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(78);
			match(HASH);
			setState(79);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 819200L) != 0)) ) {
			_errHandler.recoverInline(this);
			}
			else {
				if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
				_errHandler.reportMatch(this);
				consume();
			}
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class ZeroPageContext extends ParserRuleContext {
		public TerminalNode HEX_LITERAL() { return getToken(KickAssemblerParser.HEX_LITERAL, 0); }
		public ZeroPageContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_zeroPage; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterZeroPage(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitZeroPage(this);
		}
	}

	public final ZeroPageContext zeroPage() throws RecognitionException {
		ZeroPageContext _localctx = new ZeroPageContext(_ctx, getState());
		enterRule(_localctx, 12, RULE_zeroPage);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(81);
			match(HEX_LITERAL);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class ZeroPageXContext extends ParserRuleContext {
		public TerminalNode HEX_LITERAL() { return getToken(KickAssemblerParser.HEX_LITERAL, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode X() { return getToken(KickAssemblerParser.X, 0); }
		public ZeroPageXContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_zeroPageX; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterZeroPageX(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitZeroPageX(this);
		}
	}

	public final ZeroPageXContext zeroPageX() throws RecognitionException {
		ZeroPageXContext _localctx = new ZeroPageXContext(_ctx, getState());
		enterRule(_localctx, 14, RULE_zeroPageX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(83);
			match(HEX_LITERAL);
			setState(84);
			match(COMMA);
			setState(85);
			match(X);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class ZeroPageYContext extends ParserRuleContext {
		public TerminalNode HEX_LITERAL() { return getToken(KickAssemblerParser.HEX_LITERAL, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode Y() { return getToken(KickAssemblerParser.Y, 0); }
		public ZeroPageYContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_zeroPageY; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterZeroPageY(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitZeroPageY(this);
		}
	}

	public final ZeroPageYContext zeroPageY() throws RecognitionException {
		ZeroPageYContext _localctx = new ZeroPageYContext(_ctx, getState());
		enterRule(_localctx, 16, RULE_zeroPageY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(87);
			match(HEX_LITERAL);
			setState(88);
			match(COMMA);
			setState(89);
			match(Y);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class AbsoluteContext extends ParserRuleContext {
		public TerminalNode HEX_LONG_LITERAL() { return getToken(KickAssemblerParser.HEX_LONG_LITERAL, 0); }
		public AbsoluteContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_absolute; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterAbsolute(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitAbsolute(this);
		}
	}

	public final AbsoluteContext absolute() throws RecognitionException {
		AbsoluteContext _localctx = new AbsoluteContext(_ctx, getState());
		enterRule(_localctx, 18, RULE_absolute);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(91);
			match(HEX_LONG_LITERAL);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class AbsoluteXContext extends ParserRuleContext {
		public TerminalNode HEX_LONG_LITERAL() { return getToken(KickAssemblerParser.HEX_LONG_LITERAL, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode X() { return getToken(KickAssemblerParser.X, 0); }
		public AbsoluteXContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_absoluteX; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterAbsoluteX(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitAbsoluteX(this);
		}
	}

	public final AbsoluteXContext absoluteX() throws RecognitionException {
		AbsoluteXContext _localctx = new AbsoluteXContext(_ctx, getState());
		enterRule(_localctx, 20, RULE_absoluteX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(93);
			match(HEX_LONG_LITERAL);
			setState(94);
			match(COMMA);
			setState(95);
			match(X);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class AbsoluteYContext extends ParserRuleContext {
		public TerminalNode HEX_LONG_LITERAL() { return getToken(KickAssemblerParser.HEX_LONG_LITERAL, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode Y() { return getToken(KickAssemblerParser.Y, 0); }
		public AbsoluteYContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_absoluteY; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterAbsoluteY(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitAbsoluteY(this);
		}
	}

	public final AbsoluteYContext absoluteY() throws RecognitionException {
		AbsoluteYContext _localctx = new AbsoluteYContext(_ctx, getState());
		enterRule(_localctx, 22, RULE_absoluteY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(97);
			match(HEX_LONG_LITERAL);
			setState(98);
			match(COMMA);
			setState(99);
			match(Y);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class IndirectContext extends ParserRuleContext {
		public TerminalNode LEFT_PAREN() { return getToken(KickAssemblerParser.LEFT_PAREN, 0); }
		public TerminalNode HEX_LONG_LITERAL() { return getToken(KickAssemblerParser.HEX_LONG_LITERAL, 0); }
		public TerminalNode RIGHT_PAREN() { return getToken(KickAssemblerParser.RIGHT_PAREN, 0); }
		public IndirectContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_indirect; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterIndirect(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitIndirect(this);
		}
	}

	public final IndirectContext indirect() throws RecognitionException {
		IndirectContext _localctx = new IndirectContext(_ctx, getState());
		enterRule(_localctx, 24, RULE_indirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(101);
			match(LEFT_PAREN);
			setState(102);
			match(HEX_LONG_LITERAL);
			setState(103);
			match(RIGHT_PAREN);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class IndirectIndexedContext extends ParserRuleContext {
		public TerminalNode LEFT_PAREN() { return getToken(KickAssemblerParser.LEFT_PAREN, 0); }
		public TerminalNode HEX_LITERAL() { return getToken(KickAssemblerParser.HEX_LITERAL, 0); }
		public TerminalNode RIGHT_PAREN() { return getToken(KickAssemblerParser.RIGHT_PAREN, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode Y() { return getToken(KickAssemblerParser.Y, 0); }
		public IndirectIndexedContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_indirectIndexed; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterIndirectIndexed(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitIndirectIndexed(this);
		}
	}

	public final IndirectIndexedContext indirectIndexed() throws RecognitionException {
		IndirectIndexedContext _localctx = new IndirectIndexedContext(_ctx, getState());
		enterRule(_localctx, 26, RULE_indirectIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(105);
			match(LEFT_PAREN);
			setState(106);
			match(HEX_LITERAL);
			setState(107);
			match(RIGHT_PAREN);
			setState(108);
			match(COMMA);
			setState(109);
			match(Y);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LabelContext extends ParserRuleContext {
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public LabelContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_label; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabel(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabel(this);
		}
	}

	public final LabelContext label() throws RecognitionException {
		LabelContext _localctx = new LabelContext(_ctx, getState());
		enterRule(_localctx, 28, RULE_label);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(111);
			match(IDENTIFIER);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LabelXContext extends ParserRuleContext {
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode X() { return getToken(KickAssemblerParser.X, 0); }
		public LabelXContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_labelX; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabelX(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabelX(this);
		}
	}

	public final LabelXContext labelX() throws RecognitionException {
		LabelXContext _localctx = new LabelXContext(_ctx, getState());
		enterRule(_localctx, 30, RULE_labelX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(113);
			match(IDENTIFIER);
			setState(114);
			match(COMMA);
			setState(115);
			match(X);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LabelYContext extends ParserRuleContext {
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode Y() { return getToken(KickAssemblerParser.Y, 0); }
		public LabelYContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_labelY; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabelY(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabelY(this);
		}
	}

	public final LabelYContext labelY() throws RecognitionException {
		LabelYContext _localctx = new LabelYContext(_ctx, getState());
		enterRule(_localctx, 32, RULE_labelY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(117);
			match(IDENTIFIER);
			setState(118);
			match(COMMA);
			setState(119);
			match(Y);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LabelIndirectContext extends ParserRuleContext {
		public TerminalNode LEFT_PAREN() { return getToken(KickAssemblerParser.LEFT_PAREN, 0); }
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode RIGHT_PAREN() { return getToken(KickAssemblerParser.RIGHT_PAREN, 0); }
		public LabelIndirectContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_labelIndirect; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabelIndirect(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabelIndirect(this);
		}
	}

	public final LabelIndirectContext labelIndirect() throws RecognitionException {
		LabelIndirectContext _localctx = new LabelIndirectContext(_ctx, getState());
		enterRule(_localctx, 34, RULE_labelIndirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(121);
			match(LEFT_PAREN);
			setState(122);
			match(IDENTIFIER);
			setState(123);
			match(RIGHT_PAREN);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class LabelIndexedContext extends ParserRuleContext {
		public TerminalNode LEFT_PAREN() { return getToken(KickAssemblerParser.LEFT_PAREN, 0); }
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode RIGHT_PAREN() { return getToken(KickAssemblerParser.RIGHT_PAREN, 0); }
		public TerminalNode COMMA() { return getToken(KickAssemblerParser.COMMA, 0); }
		public TerminalNode Y() { return getToken(KickAssemblerParser.Y, 0); }
		public LabelIndexedContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_labelIndexed; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabelIndexed(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabelIndexed(this);
		}
	}

	public final LabelIndexedContext labelIndexed() throws RecognitionException {
		LabelIndexedContext _localctx = new LabelIndexedContext(_ctx, getState());
		enterRule(_localctx, 36, RULE_labelIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(125);
			match(LEFT_PAREN);
			setState(126);
			match(IDENTIFIER);
			setState(127);
			match(RIGHT_PAREN);
			setState(128);
			match(COMMA);
			setState(129);
			match(Y);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	public static final String _serializedATN =
		"\u0004\u0001\u0013\u0084\u0002\u0000\u0007\u0000\u0002\u0001\u0007\u0001"+
		"\u0002\u0002\u0007\u0002\u0002\u0003\u0007\u0003\u0002\u0004\u0007\u0004"+
		"\u0002\u0005\u0007\u0005\u0002\u0006\u0007\u0006\u0002\u0007\u0007\u0007"+
		"\u0002\b\u0007\b\u0002\t\u0007\t\u0002\n\u0007\n\u0002\u000b\u0007\u000b"+
		"\u0002\f\u0007\f\u0002\r\u0007\r\u0002\u000e\u0007\u000e\u0002\u000f\u0007"+
		"\u000f\u0002\u0010\u0007\u0010\u0002\u0011\u0007\u0011\u0002\u0012\u0007"+
		"\u0012\u0001\u0000\u0005\u0000(\b\u0000\n\u0000\f\u0000+\t\u0000\u0001"+
		"\u0000\u0001\u0000\u0001\u0001\u0001\u0001\u0003\u00011\b\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0002\u0003\u00026\b\u0002\u0001\u0002\u0001"+
		"\u0002\u0003\u0002:\b\u0002\u0001\u0003\u0001\u0003\u0001\u0003\u0001"+
		"\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001"+
		"\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001"+
		"\u0004\u0001\u0004\u0003\u0004M\b\u0004\u0001\u0005\u0001\u0005\u0001"+
		"\u0005\u0001\u0006\u0001\u0006\u0001\u0007\u0001\u0007\u0001\u0007\u0001"+
		"\u0007\u0001\b\u0001\b\u0001\b\u0001\b\u0001\t\u0001\t\u0001\n\u0001\n"+
		"\u0001\n\u0001\n\u0001\u000b\u0001\u000b\u0001\u000b\u0001\u000b\u0001"+
		"\f\u0001\f\u0001\f\u0001\f\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001"+
		"\r\u0001\u000e\u0001\u000e\u0001\u000f\u0001\u000f\u0001\u000f\u0001\u000f"+
		"\u0001\u0010\u0001\u0010\u0001\u0010\u0001\u0010\u0001\u0011\u0001\u0011"+
		"\u0001\u0011\u0001\u0011\u0001\u0012\u0001\u0012\u0001\u0012\u0001\u0012"+
		"\u0001\u0012\u0001\u0012\u0001\u0012\u0000\u0000\u0013\u0000\u0002\u0004"+
		"\u0006\b\n\f\u000e\u0010\u0012\u0014\u0016\u0018\u001a\u001c\u001e \""+
		"$\u0000\u0001\u0002\u0000\u000f\u000f\u0012\u0013\u0082\u0000)\u0001\u0000"+
		"\u0000\u0000\u00020\u0001\u0000\u0000\u0000\u00045\u0001\u0000\u0000\u0000"+
		"\u0006;\u0001\u0000\u0000\u0000\bL\u0001\u0000\u0000\u0000\nN\u0001\u0000"+
		"\u0000\u0000\fQ\u0001\u0000\u0000\u0000\u000eS\u0001\u0000\u0000\u0000"+
		"\u0010W\u0001\u0000\u0000\u0000\u0012[\u0001\u0000\u0000\u0000\u0014]"+
		"\u0001\u0000\u0000\u0000\u0016a\u0001\u0000\u0000\u0000\u0018e\u0001\u0000"+
		"\u0000\u0000\u001ai\u0001\u0000\u0000\u0000\u001co\u0001\u0000\u0000\u0000"+
		"\u001eq\u0001\u0000\u0000\u0000 u\u0001\u0000\u0000\u0000\"y\u0001\u0000"+
		"\u0000\u0000$}\u0001\u0000\u0000\u0000&(\u0003\u0002\u0001\u0000\'&\u0001"+
		"\u0000\u0000\u0000(+\u0001\u0000\u0000\u0000)\'\u0001\u0000\u0000\u0000"+
		")*\u0001\u0000\u0000\u0000*,\u0001\u0000\u0000\u0000+)\u0001\u0000\u0000"+
		"\u0000,-\u0005\u0000\u0000\u0001-\u0001\u0001\u0000\u0000\u0000.1\u0003"+
		"\u0004\u0002\u0000/1\u0003\u0006\u0003\u00000.\u0001\u0000\u0000\u0000"+
		"0/\u0001\u0000\u0000\u000001\u0001\u0000\u0000\u000012\u0001\u0000\u0000"+
		"\u000023\u0005\f\u0000\u00003\u0003\u0001\u0000\u0000\u000046\u0003\u0006"+
		"\u0003\u000054\u0001\u0000\u0000\u000056\u0001\u0000\u0000\u000067\u0001"+
		"\u0000\u0000\u000079\u0005\u0003\u0000\u00008:\u0003\b\u0004\u000098\u0001"+
		"\u0000\u0000\u00009:\u0001\u0000\u0000\u0000:\u0005\u0001\u0000\u0000"+
		"\u0000;<\u0005\u000e\u0000\u0000<=\u0005\u0004\u0000\u0000=\u0007\u0001"+
		"\u0000\u0000\u0000>M\u0003\n\u0005\u0000?M\u0003\f\u0006\u0000@M\u0003"+
		"\u000e\u0007\u0000AM\u0003\u0010\b\u0000BM\u0003\u0012\t\u0000CM\u0003"+
		"\u0014\n\u0000DM\u0003\u0016\u000b\u0000EM\u0003\u0018\f\u0000FM\u0003"+
		"\u001a\r\u0000GM\u0003\u001c\u000e\u0000HM\u0003\u001e\u000f\u0000IM\u0003"+
		" \u0010\u0000JM\u0003\"\u0011\u0000KM\u0003$\u0012\u0000L>\u0001\u0000"+
		"\u0000\u0000L?\u0001\u0000\u0000\u0000L@\u0001\u0000\u0000\u0000LA\u0001"+
		"\u0000\u0000\u0000LB\u0001\u0000\u0000\u0000LC\u0001\u0000\u0000\u0000"+
		"LD\u0001\u0000\u0000\u0000LE\u0001\u0000\u0000\u0000LF\u0001\u0000\u0000"+
		"\u0000LG\u0001\u0000\u0000\u0000LH\u0001\u0000\u0000\u0000LI\u0001\u0000"+
		"\u0000\u0000LJ\u0001\u0000\u0000\u0000LK\u0001\u0000\u0000\u0000M\t\u0001"+
		"\u0000\u0000\u0000NO\u0005\u0005\u0000\u0000OP\u0007\u0000\u0000\u0000"+
		"P\u000b\u0001\u0000\u0000\u0000QR\u0005\u000f\u0000\u0000R\r\u0001\u0000"+
		"\u0000\u0000ST\u0005\u000f\u0000\u0000TU\u0005\u0006\u0000\u0000UV\u0005"+
		"\u0007\u0000\u0000V\u000f\u0001\u0000\u0000\u0000WX\u0005\u000f\u0000"+
		"\u0000XY\u0005\u0006\u0000\u0000YZ\u0005\b\u0000\u0000Z\u0011\u0001\u0000"+
		"\u0000\u0000[\\\u0005\u0010\u0000\u0000\\\u0013\u0001\u0000\u0000\u0000"+
		"]^\u0005\u0010\u0000\u0000^_\u0005\u0006\u0000\u0000_`\u0005\u0007\u0000"+
		"\u0000`\u0015\u0001\u0000\u0000\u0000ab\u0005\u0010\u0000\u0000bc\u0005"+
		"\u0006\u0000\u0000cd\u0005\b\u0000\u0000d\u0017\u0001\u0000\u0000\u0000"+
		"ef\u0005\t\u0000\u0000fg\u0005\u0010\u0000\u0000gh\u0005\n\u0000\u0000"+
		"h\u0019\u0001\u0000\u0000\u0000ij\u0005\t\u0000\u0000jk\u0005\u000f\u0000"+
		"\u0000kl\u0005\n\u0000\u0000lm\u0005\u0006\u0000\u0000mn\u0005\b\u0000"+
		"\u0000n\u001b\u0001\u0000\u0000\u0000op\u0005\u000e\u0000\u0000p\u001d"+
		"\u0001\u0000\u0000\u0000qr\u0005\u000e\u0000\u0000rs\u0005\u0006\u0000"+
		"\u0000st\u0005\u0007\u0000\u0000t\u001f\u0001\u0000\u0000\u0000uv\u0005"+
		"\u000e\u0000\u0000vw\u0005\u0006\u0000\u0000wx\u0005\b\u0000\u0000x!\u0001"+
		"\u0000\u0000\u0000yz\u0005\t\u0000\u0000z{\u0005\u000e\u0000\u0000{|\u0005"+
		"\n\u0000\u0000|#\u0001\u0000\u0000\u0000}~\u0005\t\u0000\u0000~\u007f"+
		"\u0005\u000e\u0000\u0000\u007f\u0080\u0005\n\u0000\u0000\u0080\u0081\u0005"+
		"\u0006\u0000\u0000\u0081\u0082\u0005\b\u0000\u0000\u0082%\u0001\u0000"+
		"\u0000\u0000\u0005)059L";
	public static final ATN _ATN =
		new ATNDeserializer().deserialize(_serializedATN.toCharArray());
	static {
		_decisionToDFA = new DFA[_ATN.getNumberOfDecisions()];
		for (int i = 0; i < _ATN.getNumberOfDecisions(); i++) {
			_decisionToDFA[i] = new DFA(_ATN.getDecisionState(i), i);
		}
	}
}