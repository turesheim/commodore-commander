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
		OPCODE=1, KEYWORD=2, COLOR=3, PREPROCESSORS=4, ASTERISK=5, COLON=6, HASH=7, 
		COMMA=8, X=9, Y=10, LEFT_PAREN=11, RIGHT_PAREN=12, BANG=13, PLUS=14, MINUS=15, 
		EQUALS=16, EOL=17, WS=18, IDENTIFIER=19, DECIMAL_LITERAL=20, HEX_LITERAL=21, 
		HEX_LONG_LITERAL=22, BINARY_LITERAL=23, STRING_LITERAL=24, DIRECTIVE=25, 
		BLOCK_COMMENT=26, LINE_COMMENT=27, DIRECTIVE_BLOCK=28;
	public static final int
		RULE_program = 0, RULE_line = 1, RULE_instruction = 2, RULE_labelDeclaration = 3, 
		RULE_blockDeclaration = 4, RULE_operand = 5, RULE_immediate = 6, RULE_zeroPage = 7, 
		RULE_zeroPageX = 8, RULE_zeroPageY = 9, RULE_absolute = 10, RULE_absoluteX = 11, 
		RULE_absoluteY = 12, RULE_indirect = 13, RULE_indirectIndexed = 14, RULE_label = 15, 
		RULE_labelX = 16, RULE_labelY = 17, RULE_labelIndirect = 18, RULE_labelIndexed = 19, 
		RULE_currentAddress = 20, RULE_labelReference = 21;
	private static String[] makeRuleNames() {
		return new String[] {
			"program", "line", "instruction", "labelDeclaration", "blockDeclaration", 
			"operand", "immediate", "zeroPage", "zeroPageX", "zeroPageY", "absolute", 
			"absoluteX", "absoluteY", "indirect", "indirectIndexed", "label", "labelX", 
			"labelY", "labelIndirect", "labelIndexed", "currentAddress", "labelReference"
		};
	}
	public static final String[] ruleNames = makeRuleNames();

	private static String[] makeLiteralNames() {
		return new String[] {
			null, null, null, null, null, "'*'", "':'", "'#'", "','", "'x'", "'y'", 
			"'('", "')'", "'!'", "'+'", "'-'", "'='"
		};
	}
	private static final String[] _LITERAL_NAMES = makeLiteralNames();
	private static String[] makeSymbolicNames() {
		return new String[] {
			null, "OPCODE", "KEYWORD", "COLOR", "PREPROCESSORS", "ASTERISK", "COLON", 
			"HASH", "COMMA", "X", "Y", "LEFT_PAREN", "RIGHT_PAREN", "BANG", "PLUS", 
			"MINUS", "EQUALS", "EOL", "WS", "IDENTIFIER", "DECIMAL_LITERAL", "HEX_LITERAL", 
			"HEX_LONG_LITERAL", "BINARY_LITERAL", "STRING_LITERAL", "DIRECTIVE", 
			"BLOCK_COMMENT", "LINE_COMMENT", "DIRECTIVE_BLOCK"
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
			setState(47);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while ((((_la) & ~0x3f) == 0 && ((1L << _la) & 663650L) != 0)) {
				{
				{
				setState(44);
				line();
				}
				}
				setState(49);
				_errHandler.sync(this);
				_la = _input.LA(1);
			}
			setState(50);
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
		public BlockDeclarationContext blockDeclaration() {
			return getRuleContext(BlockDeclarationContext.class,0);
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
			setState(55);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,1,_ctx) ) {
			case 1:
				{
				setState(52);
				instruction();
				}
				break;
			case 2:
				{
				setState(53);
				labelDeclaration();
				}
				break;
			case 3:
				{
				setState(54);
				blockDeclaration();
				}
				break;
			}
			setState(57);
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
			setState(60);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 532544L) != 0)) {
				{
				setState(59);
				labelDeclaration();
				}
			}

			setState(62);
			match(OPCODE);
			setState(64);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 6826144L) != 0)) {
				{
				setState(63);
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
		public TerminalNode COLON() { return getToken(KickAssemblerParser.COLON, 0); }
		public TerminalNode BANG() { return getToken(KickAssemblerParser.BANG, 0); }
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
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
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(67);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==BANG) {
				{
				setState(66);
				match(BANG);
				}
			}

			setState(70);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(69);
				match(IDENTIFIER);
				}
			}

			setState(72);
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
	public static class BlockDeclarationContext extends ParserRuleContext {
		public TerminalNode ASTERISK() { return getToken(KickAssemblerParser.ASTERISK, 0); }
		public TerminalNode EQUALS() { return getToken(KickAssemblerParser.EQUALS, 0); }
		public TerminalNode HEX_LONG_LITERAL() { return getToken(KickAssemblerParser.HEX_LONG_LITERAL, 0); }
		public TerminalNode STRING_LITERAL() { return getToken(KickAssemblerParser.STRING_LITERAL, 0); }
		public BlockDeclarationContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_blockDeclaration; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterBlockDeclaration(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitBlockDeclaration(this);
		}
	}

	public final BlockDeclarationContext blockDeclaration() throws RecognitionException {
		BlockDeclarationContext _localctx = new BlockDeclarationContext(_ctx, getState());
		enterRule(_localctx, 8, RULE_blockDeclaration);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(74);
			match(ASTERISK);
			setState(75);
			match(EQUALS);
			setState(76);
			match(HEX_LONG_LITERAL);
			setState(77);
			match(STRING_LITERAL);
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
		public CurrentAddressContext currentAddress() {
			return getRuleContext(CurrentAddressContext.class,0);
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
		enterRule(_localctx, 10, RULE_operand);
		try {
			setState(94);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,6,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(79);
				immediate();
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(80);
				zeroPage();
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(81);
				zeroPageX();
				}
				break;
			case 4:
				enterOuterAlt(_localctx, 4);
				{
				setState(82);
				zeroPageY();
				}
				break;
			case 5:
				enterOuterAlt(_localctx, 5);
				{
				setState(83);
				absolute();
				}
				break;
			case 6:
				enterOuterAlt(_localctx, 6);
				{
				setState(84);
				absoluteX();
				}
				break;
			case 7:
				enterOuterAlt(_localctx, 7);
				{
				setState(85);
				absoluteY();
				}
				break;
			case 8:
				enterOuterAlt(_localctx, 8);
				{
				setState(86);
				indirect();
				}
				break;
			case 9:
				enterOuterAlt(_localctx, 9);
				{
				setState(87);
				indirectIndexed();
				}
				break;
			case 10:
				enterOuterAlt(_localctx, 10);
				{
				setState(88);
				label();
				}
				break;
			case 11:
				enterOuterAlt(_localctx, 11);
				{
				setState(89);
				labelX();
				}
				break;
			case 12:
				enterOuterAlt(_localctx, 12);
				{
				setState(90);
				labelY();
				}
				break;
			case 13:
				enterOuterAlt(_localctx, 13);
				{
				setState(91);
				labelIndirect();
				}
				break;
			case 14:
				enterOuterAlt(_localctx, 14);
				{
				setState(92);
				labelIndexed();
				}
				break;
			case 15:
				enterOuterAlt(_localctx, 15);
				{
				setState(93);
				currentAddress();
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
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode COLON() { return getToken(KickAssemblerParser.COLON, 0); }
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
		enterRule(_localctx, 12, RULE_immediate);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(98);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(96);
				match(IDENTIFIER);
				setState(97);
				match(COLON);
				}
			}

			setState(100);
			match(HASH);
			setState(101);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 11534336L) != 0)) ) {
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
		enterRule(_localctx, 14, RULE_zeroPage);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(103);
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
		enterRule(_localctx, 16, RULE_zeroPageX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(105);
			match(HEX_LITERAL);
			setState(106);
			match(COMMA);
			setState(107);
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
		enterRule(_localctx, 18, RULE_zeroPageY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(109);
			match(HEX_LITERAL);
			setState(110);
			match(COMMA);
			setState(111);
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
		enterRule(_localctx, 20, RULE_absolute);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(113);
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
		enterRule(_localctx, 22, RULE_absoluteX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(115);
			match(HEX_LONG_LITERAL);
			setState(116);
			match(COMMA);
			setState(117);
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
		enterRule(_localctx, 24, RULE_absoluteY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(119);
			match(HEX_LONG_LITERAL);
			setState(120);
			match(COMMA);
			setState(121);
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
		enterRule(_localctx, 26, RULE_indirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(123);
			match(LEFT_PAREN);
			setState(124);
			match(HEX_LONG_LITERAL);
			setState(125);
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
		enterRule(_localctx, 28, RULE_indirectIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(127);
			match(LEFT_PAREN);
			setState(128);
			match(HEX_LITERAL);
			setState(129);
			match(RIGHT_PAREN);
			setState(130);
			match(COMMA);
			setState(131);
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
		public LabelReferenceContext labelReference() {
			return getRuleContext(LabelReferenceContext.class,0);
		}
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
		enterRule(_localctx, 30, RULE_label);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(133);
			labelReference();
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
		public LabelReferenceContext labelReference() {
			return getRuleContext(LabelReferenceContext.class,0);
		}
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
		enterRule(_localctx, 32, RULE_labelX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(135);
			labelReference();
			setState(136);
			match(COMMA);
			setState(137);
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
		public LabelReferenceContext labelReference() {
			return getRuleContext(LabelReferenceContext.class,0);
		}
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
		enterRule(_localctx, 34, RULE_labelY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(139);
			labelReference();
			setState(140);
			match(COMMA);
			setState(141);
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
		public LabelReferenceContext labelReference() {
			return getRuleContext(LabelReferenceContext.class,0);
		}
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
		enterRule(_localctx, 36, RULE_labelIndirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(143);
			match(LEFT_PAREN);
			setState(144);
			labelReference();
			setState(145);
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
		public LabelReferenceContext labelReference() {
			return getRuleContext(LabelReferenceContext.class,0);
		}
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
		enterRule(_localctx, 38, RULE_labelIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(147);
			match(LEFT_PAREN);
			setState(148);
			labelReference();
			setState(149);
			match(RIGHT_PAREN);
			setState(150);
			match(COMMA);
			setState(151);
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
	public static class CurrentAddressContext extends ParserRuleContext {
		public TerminalNode ASTERISK() { return getToken(KickAssemblerParser.ASTERISK, 0); }
		public List<TerminalNode> DECIMAL_LITERAL() { return getTokens(KickAssemblerParser.DECIMAL_LITERAL); }
		public TerminalNode DECIMAL_LITERAL(int i) {
			return getToken(KickAssemblerParser.DECIMAL_LITERAL, i);
		}
		public List<TerminalNode> PLUS() { return getTokens(KickAssemblerParser.PLUS); }
		public TerminalNode PLUS(int i) {
			return getToken(KickAssemblerParser.PLUS, i);
		}
		public List<TerminalNode> MINUS() { return getTokens(KickAssemblerParser.MINUS); }
		public TerminalNode MINUS(int i) {
			return getToken(KickAssemblerParser.MINUS, i);
		}
		public CurrentAddressContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_currentAddress; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterCurrentAddress(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitCurrentAddress(this);
		}
	}

	public final CurrentAddressContext currentAddress() throws RecognitionException {
		CurrentAddressContext _localctx = new CurrentAddressContext(_ctx, getState());
		enterRule(_localctx, 40, RULE_currentAddress);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(153);
			match(ASTERISK);
			setState(158);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while (_la==PLUS || _la==MINUS) {
				{
				{
				setState(154);
				_la = _input.LA(1);
				if ( !(_la==PLUS || _la==MINUS) ) {
				_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				setState(155);
				match(DECIMAL_LITERAL);
				}
				}
				setState(160);
				_errHandler.sync(this);
				_la = _input.LA(1);
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
	public static class LabelReferenceContext extends ParserRuleContext {
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public TerminalNode BANG() { return getToken(KickAssemblerParser.BANG, 0); }
		public List<TerminalNode> PLUS() { return getTokens(KickAssemblerParser.PLUS); }
		public TerminalNode PLUS(int i) {
			return getToken(KickAssemblerParser.PLUS, i);
		}
		public List<TerminalNode> MINUS() { return getTokens(KickAssemblerParser.MINUS); }
		public TerminalNode MINUS(int i) {
			return getToken(KickAssemblerParser.MINUS, i);
		}
		public LabelReferenceContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_labelReference; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterLabelReference(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitLabelReference(this);
		}
	}

	public final LabelReferenceContext labelReference() throws RecognitionException {
		LabelReferenceContext _localctx = new LabelReferenceContext(_ctx, getState());
		enterRule(_localctx, 42, RULE_labelReference);
		int _la;
		try {
			setState(173);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,11,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(161);
				match(IDENTIFIER);
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(162);
				match(BANG);
				setState(163);
				match(IDENTIFIER);
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(164);
				match(BANG);
				setState(166);
				_errHandler.sync(this);
				_la = _input.LA(1);
				if (_la==IDENTIFIER) {
					{
					setState(165);
					match(IDENTIFIER);
					}
				}

				setState(169); 
				_errHandler.sync(this);
				_la = _input.LA(1);
				do {
					{
					{
					setState(168);
					_la = _input.LA(1);
					if ( !(_la==PLUS || _la==MINUS) ) {
					_errHandler.recoverInline(this);
					}
					else {
						if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
						_errHandler.reportMatch(this);
						consume();
					}
					}
					}
					setState(171); 
					_errHandler.sync(this);
					_la = _input.LA(1);
				} while ( _la==PLUS || _la==MINUS );
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

	public static final String _serializedATN =
		"\u0004\u0001\u001c\u00b0\u0002\u0000\u0007\u0000\u0002\u0001\u0007\u0001"+
		"\u0002\u0002\u0007\u0002\u0002\u0003\u0007\u0003\u0002\u0004\u0007\u0004"+
		"\u0002\u0005\u0007\u0005\u0002\u0006\u0007\u0006\u0002\u0007\u0007\u0007"+
		"\u0002\b\u0007\b\u0002\t\u0007\t\u0002\n\u0007\n\u0002\u000b\u0007\u000b"+
		"\u0002\f\u0007\f\u0002\r\u0007\r\u0002\u000e\u0007\u000e\u0002\u000f\u0007"+
		"\u000f\u0002\u0010\u0007\u0010\u0002\u0011\u0007\u0011\u0002\u0012\u0007"+
		"\u0012\u0002\u0013\u0007\u0013\u0002\u0014\u0007\u0014\u0002\u0015\u0007"+
		"\u0015\u0001\u0000\u0005\u0000.\b\u0000\n\u0000\f\u00001\t\u0000\u0001"+
		"\u0000\u0001\u0000\u0001\u0001\u0001\u0001\u0001\u0001\u0003\u00018\b"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0002\u0003\u0002=\b\u0002\u0001"+
		"\u0002\u0001\u0002\u0003\u0002A\b\u0002\u0001\u0003\u0003\u0003D\b\u0003"+
		"\u0001\u0003\u0003\u0003G\b\u0003\u0001\u0003\u0001\u0003\u0001\u0004"+
		"\u0001\u0004\u0001\u0004\u0001\u0004\u0001\u0004\u0001\u0005\u0001\u0005"+
		"\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005"+
		"\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005"+
		"\u0001\u0005\u0003\u0005_\b\u0005\u0001\u0006\u0001\u0006\u0003\u0006"+
		"c\b\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0007\u0001\u0007"+
		"\u0001\b\u0001\b\u0001\b\u0001\b\u0001\t\u0001\t\u0001\t\u0001\t\u0001"+
		"\n\u0001\n\u0001\u000b\u0001\u000b\u0001\u000b\u0001\u000b\u0001\f\u0001"+
		"\f\u0001\f\u0001\f\u0001\r\u0001\r\u0001\r\u0001\r\u0001\u000e\u0001\u000e"+
		"\u0001\u000e\u0001\u000e\u0001\u000e\u0001\u000e\u0001\u000f\u0001\u000f"+
		"\u0001\u0010\u0001\u0010\u0001\u0010\u0001\u0010\u0001\u0011\u0001\u0011"+
		"\u0001\u0011\u0001\u0011\u0001\u0012\u0001\u0012\u0001\u0012\u0001\u0012"+
		"\u0001\u0013\u0001\u0013\u0001\u0013\u0001\u0013\u0001\u0013\u0001\u0013"+
		"\u0001\u0014\u0001\u0014\u0001\u0014\u0005\u0014\u009d\b\u0014\n\u0014"+
		"\f\u0014\u00a0\t\u0014\u0001\u0015\u0001\u0015\u0001\u0015\u0001\u0015"+
		"\u0001\u0015\u0003\u0015\u00a7\b\u0015\u0001\u0015\u0004\u0015\u00aa\b"+
		"\u0015\u000b\u0015\f\u0015\u00ab\u0003\u0015\u00ae\b\u0015\u0001\u0015"+
		"\u0000\u0000\u0016\u0000\u0002\u0004\u0006\b\n\f\u000e\u0010\u0012\u0014"+
		"\u0016\u0018\u001a\u001c\u001e \"$&(*\u0000\u0002\u0002\u0000\u0014\u0015"+
		"\u0017\u0017\u0001\u0000\u000e\u000f\u00b5\u0000/\u0001\u0000\u0000\u0000"+
		"\u00027\u0001\u0000\u0000\u0000\u0004<\u0001\u0000\u0000\u0000\u0006C"+
		"\u0001\u0000\u0000\u0000\bJ\u0001\u0000\u0000\u0000\n^\u0001\u0000\u0000"+
		"\u0000\fb\u0001\u0000\u0000\u0000\u000eg\u0001\u0000\u0000\u0000\u0010"+
		"i\u0001\u0000\u0000\u0000\u0012m\u0001\u0000\u0000\u0000\u0014q\u0001"+
		"\u0000\u0000\u0000\u0016s\u0001\u0000\u0000\u0000\u0018w\u0001\u0000\u0000"+
		"\u0000\u001a{\u0001\u0000\u0000\u0000\u001c\u007f\u0001\u0000\u0000\u0000"+
		"\u001e\u0085\u0001\u0000\u0000\u0000 \u0087\u0001\u0000\u0000\u0000\""+
		"\u008b\u0001\u0000\u0000\u0000$\u008f\u0001\u0000\u0000\u0000&\u0093\u0001"+
		"\u0000\u0000\u0000(\u0099\u0001\u0000\u0000\u0000*\u00ad\u0001\u0000\u0000"+
		"\u0000,.\u0003\u0002\u0001\u0000-,\u0001\u0000\u0000\u0000.1\u0001\u0000"+
		"\u0000\u0000/-\u0001\u0000\u0000\u0000/0\u0001\u0000\u0000\u000002\u0001"+
		"\u0000\u0000\u00001/\u0001\u0000\u0000\u000023\u0005\u0000\u0000\u0001"+
		"3\u0001\u0001\u0000\u0000\u000048\u0003\u0004\u0002\u000058\u0003\u0006"+
		"\u0003\u000068\u0003\b\u0004\u000074\u0001\u0000\u0000\u000075\u0001\u0000"+
		"\u0000\u000076\u0001\u0000\u0000\u000078\u0001\u0000\u0000\u000089\u0001"+
		"\u0000\u0000\u00009:\u0005\u0011\u0000\u0000:\u0003\u0001\u0000\u0000"+
		"\u0000;=\u0003\u0006\u0003\u0000<;\u0001\u0000\u0000\u0000<=\u0001\u0000"+
		"\u0000\u0000=>\u0001\u0000\u0000\u0000>@\u0005\u0001\u0000\u0000?A\u0003"+
		"\n\u0005\u0000@?\u0001\u0000\u0000\u0000@A\u0001\u0000\u0000\u0000A\u0005"+
		"\u0001\u0000\u0000\u0000BD\u0005\r\u0000\u0000CB\u0001\u0000\u0000\u0000"+
		"CD\u0001\u0000\u0000\u0000DF\u0001\u0000\u0000\u0000EG\u0005\u0013\u0000"+
		"\u0000FE\u0001\u0000\u0000\u0000FG\u0001\u0000\u0000\u0000GH\u0001\u0000"+
		"\u0000\u0000HI\u0005\u0006\u0000\u0000I\u0007\u0001\u0000\u0000\u0000"+
		"JK\u0005\u0005\u0000\u0000KL\u0005\u0010\u0000\u0000LM\u0005\u0016\u0000"+
		"\u0000MN\u0005\u0018\u0000\u0000N\t\u0001\u0000\u0000\u0000O_\u0003\f"+
		"\u0006\u0000P_\u0003\u000e\u0007\u0000Q_\u0003\u0010\b\u0000R_\u0003\u0012"+
		"\t\u0000S_\u0003\u0014\n\u0000T_\u0003\u0016\u000b\u0000U_\u0003\u0018"+
		"\f\u0000V_\u0003\u001a\r\u0000W_\u0003\u001c\u000e\u0000X_\u0003\u001e"+
		"\u000f\u0000Y_\u0003 \u0010\u0000Z_\u0003\"\u0011\u0000[_\u0003$\u0012"+
		"\u0000\\_\u0003&\u0013\u0000]_\u0003(\u0014\u0000^O\u0001\u0000\u0000"+
		"\u0000^P\u0001\u0000\u0000\u0000^Q\u0001\u0000\u0000\u0000^R\u0001\u0000"+
		"\u0000\u0000^S\u0001\u0000\u0000\u0000^T\u0001\u0000\u0000\u0000^U\u0001"+
		"\u0000\u0000\u0000^V\u0001\u0000\u0000\u0000^W\u0001\u0000\u0000\u0000"+
		"^X\u0001\u0000\u0000\u0000^Y\u0001\u0000\u0000\u0000^Z\u0001\u0000\u0000"+
		"\u0000^[\u0001\u0000\u0000\u0000^\\\u0001\u0000\u0000\u0000^]\u0001\u0000"+
		"\u0000\u0000_\u000b\u0001\u0000\u0000\u0000`a\u0005\u0013\u0000\u0000"+
		"ac\u0005\u0006\u0000\u0000b`\u0001\u0000\u0000\u0000bc\u0001\u0000\u0000"+
		"\u0000cd\u0001\u0000\u0000\u0000de\u0005\u0007\u0000\u0000ef\u0007\u0000"+
		"\u0000\u0000f\r\u0001\u0000\u0000\u0000gh\u0005\u0015\u0000\u0000h\u000f"+
		"\u0001\u0000\u0000\u0000ij\u0005\u0015\u0000\u0000jk\u0005\b\u0000\u0000"+
		"kl\u0005\t\u0000\u0000l\u0011\u0001\u0000\u0000\u0000mn\u0005\u0015\u0000"+
		"\u0000no\u0005\b\u0000\u0000op\u0005\n\u0000\u0000p\u0013\u0001\u0000"+
		"\u0000\u0000qr\u0005\u0016\u0000\u0000r\u0015\u0001\u0000\u0000\u0000"+
		"st\u0005\u0016\u0000\u0000tu\u0005\b\u0000\u0000uv\u0005\t\u0000\u0000"+
		"v\u0017\u0001\u0000\u0000\u0000wx\u0005\u0016\u0000\u0000xy\u0005\b\u0000"+
		"\u0000yz\u0005\n\u0000\u0000z\u0019\u0001\u0000\u0000\u0000{|\u0005\u000b"+
		"\u0000\u0000|}\u0005\u0016\u0000\u0000}~\u0005\f\u0000\u0000~\u001b\u0001"+
		"\u0000\u0000\u0000\u007f\u0080\u0005\u000b\u0000\u0000\u0080\u0081\u0005"+
		"\u0015\u0000\u0000\u0081\u0082\u0005\f\u0000\u0000\u0082\u0083\u0005\b"+
		"\u0000\u0000\u0083\u0084\u0005\n\u0000\u0000\u0084\u001d\u0001\u0000\u0000"+
		"\u0000\u0085\u0086\u0003*\u0015\u0000\u0086\u001f\u0001\u0000\u0000\u0000"+
		"\u0087\u0088\u0003*\u0015\u0000\u0088\u0089\u0005\b\u0000\u0000\u0089"+
		"\u008a\u0005\t\u0000\u0000\u008a!\u0001\u0000\u0000\u0000\u008b\u008c"+
		"\u0003*\u0015\u0000\u008c\u008d\u0005\b\u0000\u0000\u008d\u008e\u0005"+
		"\n\u0000\u0000\u008e#\u0001\u0000\u0000\u0000\u008f\u0090\u0005\u000b"+
		"\u0000\u0000\u0090\u0091\u0003*\u0015\u0000\u0091\u0092\u0005\f\u0000"+
		"\u0000\u0092%\u0001\u0000\u0000\u0000\u0093\u0094\u0005\u000b\u0000\u0000"+
		"\u0094\u0095\u0003*\u0015\u0000\u0095\u0096\u0005\f\u0000\u0000\u0096"+
		"\u0097\u0005\b\u0000\u0000\u0097\u0098\u0005\n\u0000\u0000\u0098\'\u0001"+
		"\u0000\u0000\u0000\u0099\u009e\u0005\u0005\u0000\u0000\u009a\u009b\u0007"+
		"\u0001\u0000\u0000\u009b\u009d\u0005\u0014\u0000\u0000\u009c\u009a\u0001"+
		"\u0000\u0000\u0000\u009d\u00a0\u0001\u0000\u0000\u0000\u009e\u009c\u0001"+
		"\u0000\u0000\u0000\u009e\u009f\u0001\u0000\u0000\u0000\u009f)\u0001\u0000"+
		"\u0000\u0000\u00a0\u009e\u0001\u0000\u0000\u0000\u00a1\u00ae\u0005\u0013"+
		"\u0000\u0000\u00a2\u00a3\u0005\r\u0000\u0000\u00a3\u00ae\u0005\u0013\u0000"+
		"\u0000\u00a4\u00a6\u0005\r\u0000\u0000\u00a5\u00a7\u0005\u0013\u0000\u0000"+
		"\u00a6\u00a5\u0001\u0000\u0000\u0000\u00a6\u00a7\u0001\u0000\u0000\u0000"+
		"\u00a7\u00a9\u0001\u0000\u0000\u0000\u00a8\u00aa\u0007\u0001\u0000\u0000"+
		"\u00a9\u00a8\u0001\u0000\u0000\u0000\u00aa\u00ab\u0001\u0000\u0000\u0000"+
		"\u00ab\u00a9\u0001\u0000\u0000\u0000\u00ab\u00ac\u0001\u0000\u0000\u0000"+
		"\u00ac\u00ae\u0001\u0000\u0000\u0000\u00ad\u00a1\u0001\u0000\u0000\u0000"+
		"\u00ad\u00a2\u0001\u0000\u0000\u0000\u00ad\u00a4\u0001\u0000\u0000\u0000"+
		"\u00ae+\u0001\u0000\u0000\u0000\f/7<@CF^b\u009e\u00a6\u00ab\u00ad";
	public static final ATN _ATN =
		new ATNDeserializer().deserialize(_serializedATN.toCharArray());
	static {
		_decisionToDFA = new DFA[_ATN.getNumberOfDecisions()];
		for (int i = 0; i < _ATN.getNumberOfDecisions(); i++) {
			_decisionToDFA[i] = new DFA(_ATN.getDecisionState(i), i);
		}
	}
}