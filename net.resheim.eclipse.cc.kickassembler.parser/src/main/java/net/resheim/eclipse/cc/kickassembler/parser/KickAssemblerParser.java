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
		OPCODE=1, KEYWORD=2, COLOR=3, P_IMPORT=4, P_IF=5, P_ELSE=6, P_ENDIF=7, 
		P_DEFINE=8, P_UNDEF=9, P_ELIF=10, P_IMPORTIF=11, P_IMPORTONCE=12, ASTERISK=13, 
		COLON=14, HASH=15, COMMA=16, X=17, Y=18, LEFT_PAREN=19, RIGHT_PAREN=20, 
		BANG=21, PLUS=22, MINUS=23, EQUALS=24, EOL=25, WS=26, IDENTIFIER=27, DECIMAL_LITERAL=28, 
		HEX_LITERAL=29, HEX_LONG_LITERAL=30, BINARY_LITERAL=31, STRING_LITERAL=32, 
		DIRECTIVE=33, BLOCK_COMMENT=34, LINE_COMMENT=35, DIRECTIVE_BLOCK=36;
	public static final int
		RULE_program = 0, RULE_line = 1, RULE_import_code = 2, RULE_instruction = 3, 
		RULE_labelDeclaration = 4, RULE_blockDeclaration = 5, RULE_operand = 6, 
		RULE_immediate = 7, RULE_zeroPage = 8, RULE_zeroPageX = 9, RULE_zeroPageY = 10, 
		RULE_absolute = 11, RULE_absoluteX = 12, RULE_absoluteY = 13, RULE_indirect = 14, 
		RULE_indirectIndexed = 15, RULE_label = 16, RULE_labelX = 17, RULE_labelY = 18, 
		RULE_labelIndirect = 19, RULE_labelIndexed = 20, RULE_currentAddress = 21, 
		RULE_number = 22, RULE_labelReference = 23;
	private static String[] makeRuleNames() {
		return new String[] {
			"program", "line", "import_code", "instruction", "labelDeclaration", 
			"blockDeclaration", "operand", "immediate", "zeroPage", "zeroPageX", 
			"zeroPageY", "absolute", "absoluteX", "absoluteY", "indirect", "indirectIndexed", 
			"label", "labelX", "labelY", "labelIndirect", "labelIndexed", "currentAddress", 
			"number", "labelReference"
		};
	}
	public static final String[] ruleNames = makeRuleNames();

	private static String[] makeLiteralNames() {
		return new String[] {
			null, null, null, null, "'#import'", "'#if'", "'#else'", "'#endif'", 
			"'#define'", "'#undef'", "'#elif'", "'#importif'", "'#importonce'", "'*'", 
			"':'", "'#'", "','", "'x'", "'y'", "'('", "')'", "'!'", "'+'", "'-'", 
			"'='"
		};
	}
	private static final String[] _LITERAL_NAMES = makeLiteralNames();
	private static String[] makeSymbolicNames() {
		return new String[] {
			null, "OPCODE", "KEYWORD", "COLOR", "P_IMPORT", "P_IF", "P_ELSE", "P_ENDIF", 
			"P_DEFINE", "P_UNDEF", "P_ELIF", "P_IMPORTIF", "P_IMPORTONCE", "ASTERISK", 
			"COLON", "HASH", "COMMA", "X", "Y", "LEFT_PAREN", "RIGHT_PAREN", "BANG", 
			"PLUS", "MINUS", "EQUALS", "EOL", "WS", "IDENTIFIER", "DECIMAL_LITERAL", 
			"HEX_LITERAL", "HEX_LONG_LITERAL", "BINARY_LITERAL", "STRING_LITERAL", 
			"DIRECTIVE", "BLOCK_COMMENT", "LINE_COMMENT", "DIRECTIVE_BLOCK"
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
			setState(51);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while ((((_la) & ~0x3f) == 0 && ((1L << _la) & 169895954L) != 0)) {
				{
				{
				setState(48);
				line();
				}
				}
				setState(53);
				_errHandler.sync(this);
				_la = _input.LA(1);
			}
			setState(54);
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
		public Import_codeContext import_code() {
			return getRuleContext(Import_codeContext.class,0);
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
			setState(60);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,1,_ctx) ) {
			case 1:
				{
				setState(56);
				instruction();
				}
				break;
			case 2:
				{
				setState(57);
				labelDeclaration();
				}
				break;
			case 3:
				{
				setState(58);
				blockDeclaration();
				}
				break;
			case 4:
				{
				setState(59);
				import_code();
				}
				break;
			}
			setState(62);
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
	public static class Import_codeContext extends ParserRuleContext {
		public Token fileName;
		public TerminalNode P_IMPORT() { return getToken(KickAssemblerParser.P_IMPORT, 0); }
		public TerminalNode P_IMPORTIF() { return getToken(KickAssemblerParser.P_IMPORTIF, 0); }
		public TerminalNode STRING_LITERAL() { return getToken(KickAssemblerParser.STRING_LITERAL, 0); }
		public Import_codeContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_import_code; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterImport_code(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitImport_code(this);
		}
	}

	public final Import_codeContext import_code() throws RecognitionException {
		Import_codeContext _localctx = new Import_codeContext(_ctx, getState());
		enterRule(_localctx, 4, RULE_import_code);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(64);
			_la = _input.LA(1);
			if ( !(_la==P_IMPORT || _la==P_IMPORTIF) ) {
			_errHandler.recoverInline(this);
			}
			else {
				if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
				_errHandler.reportMatch(this);
				consume();
			}
			setState(65);
			((Import_codeContext)_localctx).fileName = match(STRING_LITERAL);
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
		enterRule(_localctx, 6, RULE_instruction);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(68);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 136331264L) != 0)) {
				{
				setState(67);
				labelDeclaration();
				}
			}

			setState(70);
			match(OPCODE);
			setState(72);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 1747492864L) != 0)) {
				{
				setState(71);
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
		enterRule(_localctx, 8, RULE_labelDeclaration);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(75);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==BANG) {
				{
				setState(74);
				match(BANG);
				}
			}

			setState(78);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(77);
				match(IDENTIFIER);
				}
			}

			setState(80);
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
		public NumberContext number() {
			return getRuleContext(NumberContext.class,0);
		}
		public TerminalNode STRING_LITERAL() { return getToken(KickAssemblerParser.STRING_LITERAL, 0); }
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
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
		enterRule(_localctx, 10, RULE_blockDeclaration);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(82);
			match(ASTERISK);
			setState(83);
			match(EQUALS);
			setState(84);
			number();
			setState(85);
			_la = _input.LA(1);
			if ( !(_la==IDENTIFIER || _la==STRING_LITERAL) ) {
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
		enterRule(_localctx, 12, RULE_operand);
		try {
			setState(102);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,6,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(87);
				immediate();
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(88);
				zeroPage();
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(89);
				zeroPageX();
				}
				break;
			case 4:
				enterOuterAlt(_localctx, 4);
				{
				setState(90);
				zeroPageY();
				}
				break;
			case 5:
				enterOuterAlt(_localctx, 5);
				{
				setState(91);
				absolute();
				}
				break;
			case 6:
				enterOuterAlt(_localctx, 6);
				{
				setState(92);
				absoluteX();
				}
				break;
			case 7:
				enterOuterAlt(_localctx, 7);
				{
				setState(93);
				absoluteY();
				}
				break;
			case 8:
				enterOuterAlt(_localctx, 8);
				{
				setState(94);
				indirect();
				}
				break;
			case 9:
				enterOuterAlt(_localctx, 9);
				{
				setState(95);
				indirectIndexed();
				}
				break;
			case 10:
				enterOuterAlt(_localctx, 10);
				{
				setState(96);
				label();
				}
				break;
			case 11:
				enterOuterAlt(_localctx, 11);
				{
				setState(97);
				labelX();
				}
				break;
			case 12:
				enterOuterAlt(_localctx, 12);
				{
				setState(98);
				labelY();
				}
				break;
			case 13:
				enterOuterAlt(_localctx, 13);
				{
				setState(99);
				labelIndirect();
				}
				break;
			case 14:
				enterOuterAlt(_localctx, 14);
				{
				setState(100);
				labelIndexed();
				}
				break;
			case 15:
				enterOuterAlt(_localctx, 15);
				{
				setState(101);
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
		enterRule(_localctx, 14, RULE_immediate);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(106);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(104);
				match(IDENTIFIER);
				setState(105);
				match(COLON);
				}
			}

			setState(108);
			match(HASH);
			setState(109);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 2952790016L) != 0)) ) {
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
		enterRule(_localctx, 16, RULE_zeroPage);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(111);
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
		enterRule(_localctx, 18, RULE_zeroPageX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(113);
			match(HEX_LITERAL);
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
		enterRule(_localctx, 20, RULE_zeroPageY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(117);
			match(HEX_LITERAL);
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
		enterRule(_localctx, 22, RULE_absolute);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(121);
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
		enterRule(_localctx, 24, RULE_absoluteX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(123);
			match(HEX_LONG_LITERAL);
			setState(124);
			match(COMMA);
			setState(125);
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
		enterRule(_localctx, 26, RULE_absoluteY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(127);
			match(HEX_LONG_LITERAL);
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
		enterRule(_localctx, 28, RULE_indirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(131);
			match(LEFT_PAREN);
			setState(132);
			match(HEX_LONG_LITERAL);
			setState(133);
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
		enterRule(_localctx, 30, RULE_indirectIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(135);
			match(LEFT_PAREN);
			setState(136);
			match(HEX_LITERAL);
			setState(137);
			match(RIGHT_PAREN);
			setState(138);
			match(COMMA);
			setState(139);
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
		enterRule(_localctx, 32, RULE_label);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(141);
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
		enterRule(_localctx, 34, RULE_labelX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(143);
			labelReference();
			setState(144);
			match(COMMA);
			setState(145);
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
		enterRule(_localctx, 36, RULE_labelY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(147);
			labelReference();
			setState(148);
			match(COMMA);
			setState(149);
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
		enterRule(_localctx, 38, RULE_labelIndirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(151);
			match(LEFT_PAREN);
			setState(152);
			labelReference();
			setState(153);
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
		enterRule(_localctx, 40, RULE_labelIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(155);
			match(LEFT_PAREN);
			setState(156);
			labelReference();
			setState(157);
			match(RIGHT_PAREN);
			setState(158);
			match(COMMA);
			setState(159);
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
		enterRule(_localctx, 42, RULE_currentAddress);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(161);
			match(ASTERISK);
			setState(166);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while (_la==PLUS || _la==MINUS) {
				{
				{
				setState(162);
				_la = _input.LA(1);
				if ( !(_la==PLUS || _la==MINUS) ) {
				_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				setState(163);
				match(DECIMAL_LITERAL);
				}
				}
				setState(168);
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
	public static class NumberContext extends ParserRuleContext {
		public TerminalNode DECIMAL_LITERAL() { return getToken(KickAssemblerParser.DECIMAL_LITERAL, 0); }
		public TerminalNode HEX_LONG_LITERAL() { return getToken(KickAssemblerParser.HEX_LONG_LITERAL, 0); }
		public TerminalNode HEX_LITERAL() { return getToken(KickAssemblerParser.HEX_LITERAL, 0); }
		public NumberContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_number; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterNumber(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitNumber(this);
		}
	}

	public final NumberContext number() throws RecognitionException {
		NumberContext _localctx = new NumberContext(_ctx, getState());
		enterRule(_localctx, 44, RULE_number);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(169);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 1879048192L) != 0)) ) {
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
		enterRule(_localctx, 46, RULE_labelReference);
		int _la;
		try {
			setState(183);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,11,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(171);
				match(IDENTIFIER);
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(172);
				match(BANG);
				setState(173);
				match(IDENTIFIER);
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(174);
				match(BANG);
				setState(176);
				_errHandler.sync(this);
				_la = _input.LA(1);
				if (_la==IDENTIFIER) {
					{
					setState(175);
					match(IDENTIFIER);
					}
				}

				setState(179); 
				_errHandler.sync(this);
				_la = _input.LA(1);
				do {
					{
					{
					setState(178);
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
					setState(181); 
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
		"\u0004\u0001$\u00ba\u0002\u0000\u0007\u0000\u0002\u0001\u0007\u0001\u0002"+
		"\u0002\u0007\u0002\u0002\u0003\u0007\u0003\u0002\u0004\u0007\u0004\u0002"+
		"\u0005\u0007\u0005\u0002\u0006\u0007\u0006\u0002\u0007\u0007\u0007\u0002"+
		"\b\u0007\b\u0002\t\u0007\t\u0002\n\u0007\n\u0002\u000b\u0007\u000b\u0002"+
		"\f\u0007\f\u0002\r\u0007\r\u0002\u000e\u0007\u000e\u0002\u000f\u0007\u000f"+
		"\u0002\u0010\u0007\u0010\u0002\u0011\u0007\u0011\u0002\u0012\u0007\u0012"+
		"\u0002\u0013\u0007\u0013\u0002\u0014\u0007\u0014\u0002\u0015\u0007\u0015"+
		"\u0002\u0016\u0007\u0016\u0002\u0017\u0007\u0017\u0001\u0000\u0005\u0000"+
		"2\b\u0000\n\u0000\f\u00005\t\u0000\u0001\u0000\u0001\u0000\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0003\u0001=\b\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0002\u0001\u0002\u0001\u0002\u0001\u0003\u0003\u0003"+
		"E\b\u0003\u0001\u0003\u0001\u0003\u0003\u0003I\b\u0003\u0001\u0004\u0003"+
		"\u0004L\b\u0004\u0001\u0004\u0003\u0004O\b\u0004\u0001\u0004\u0001\u0004"+
		"\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0005\u0001\u0006"+
		"\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006"+
		"\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006"+
		"\u0001\u0006\u0001\u0006\u0003\u0006g\b\u0006\u0001\u0007\u0001\u0007"+
		"\u0003\u0007k\b\u0007\u0001\u0007\u0001\u0007\u0001\u0007\u0001\b\u0001"+
		"\b\u0001\t\u0001\t\u0001\t\u0001\t\u0001\n\u0001\n\u0001\n\u0001\n\u0001"+
		"\u000b\u0001\u000b\u0001\f\u0001\f\u0001\f\u0001\f\u0001\r\u0001\r\u0001"+
		"\r\u0001\r\u0001\u000e\u0001\u000e\u0001\u000e\u0001\u000e\u0001\u000f"+
		"\u0001\u000f\u0001\u000f\u0001\u000f\u0001\u000f\u0001\u000f\u0001\u0010"+
		"\u0001\u0010\u0001\u0011\u0001\u0011\u0001\u0011\u0001\u0011\u0001\u0012"+
		"\u0001\u0012\u0001\u0012\u0001\u0012\u0001\u0013\u0001\u0013\u0001\u0013"+
		"\u0001\u0013\u0001\u0014\u0001\u0014\u0001\u0014\u0001\u0014\u0001\u0014"+
		"\u0001\u0014\u0001\u0015\u0001\u0015\u0001\u0015\u0005\u0015\u00a5\b\u0015"+
		"\n\u0015\f\u0015\u00a8\t\u0015\u0001\u0016\u0001\u0016\u0001\u0017\u0001"+
		"\u0017\u0001\u0017\u0001\u0017\u0001\u0017\u0003\u0017\u00b1\b\u0017\u0001"+
		"\u0017\u0004\u0017\u00b4\b\u0017\u000b\u0017\f\u0017\u00b5\u0003\u0017"+
		"\u00b8\b\u0017\u0001\u0017\u0000\u0000\u0018\u0000\u0002\u0004\u0006\b"+
		"\n\f\u000e\u0010\u0012\u0014\u0016\u0018\u001a\u001c\u001e \"$&(*,.\u0000"+
		"\u0005\u0002\u0000\u0004\u0004\u000b\u000b\u0002\u0000\u001b\u001b  \u0002"+
		"\u0000\u001c\u001d\u001f\u001f\u0001\u0000\u0016\u0017\u0001\u0000\u001c"+
		"\u001e\u00be\u00003\u0001\u0000\u0000\u0000\u0002<\u0001\u0000\u0000\u0000"+
		"\u0004@\u0001\u0000\u0000\u0000\u0006D\u0001\u0000\u0000\u0000\bK\u0001"+
		"\u0000\u0000\u0000\nR\u0001\u0000\u0000\u0000\ff\u0001\u0000\u0000\u0000"+
		"\u000ej\u0001\u0000\u0000\u0000\u0010o\u0001\u0000\u0000\u0000\u0012q"+
		"\u0001\u0000\u0000\u0000\u0014u\u0001\u0000\u0000\u0000\u0016y\u0001\u0000"+
		"\u0000\u0000\u0018{\u0001\u0000\u0000\u0000\u001a\u007f\u0001\u0000\u0000"+
		"\u0000\u001c\u0083\u0001\u0000\u0000\u0000\u001e\u0087\u0001\u0000\u0000"+
		"\u0000 \u008d\u0001\u0000\u0000\u0000\"\u008f\u0001\u0000\u0000\u0000"+
		"$\u0093\u0001\u0000\u0000\u0000&\u0097\u0001\u0000\u0000\u0000(\u009b"+
		"\u0001\u0000\u0000\u0000*\u00a1\u0001\u0000\u0000\u0000,\u00a9\u0001\u0000"+
		"\u0000\u0000.\u00b7\u0001\u0000\u0000\u000002\u0003\u0002\u0001\u0000"+
		"10\u0001\u0000\u0000\u000025\u0001\u0000\u0000\u000031\u0001\u0000\u0000"+
		"\u000034\u0001\u0000\u0000\u000046\u0001\u0000\u0000\u000053\u0001\u0000"+
		"\u0000\u000067\u0005\u0000\u0000\u00017\u0001\u0001\u0000\u0000\u0000"+
		"8=\u0003\u0006\u0003\u00009=\u0003\b\u0004\u0000:=\u0003\n\u0005\u0000"+
		";=\u0003\u0004\u0002\u0000<8\u0001\u0000\u0000\u0000<9\u0001\u0000\u0000"+
		"\u0000<:\u0001\u0000\u0000\u0000<;\u0001\u0000\u0000\u0000<=\u0001\u0000"+
		"\u0000\u0000=>\u0001\u0000\u0000\u0000>?\u0005\u0019\u0000\u0000?\u0003"+
		"\u0001\u0000\u0000\u0000@A\u0007\u0000\u0000\u0000AB\u0005 \u0000\u0000"+
		"B\u0005\u0001\u0000\u0000\u0000CE\u0003\b\u0004\u0000DC\u0001\u0000\u0000"+
		"\u0000DE\u0001\u0000\u0000\u0000EF\u0001\u0000\u0000\u0000FH\u0005\u0001"+
		"\u0000\u0000GI\u0003\f\u0006\u0000HG\u0001\u0000\u0000\u0000HI\u0001\u0000"+
		"\u0000\u0000I\u0007\u0001\u0000\u0000\u0000JL\u0005\u0015\u0000\u0000"+
		"KJ\u0001\u0000\u0000\u0000KL\u0001\u0000\u0000\u0000LN\u0001\u0000\u0000"+
		"\u0000MO\u0005\u001b\u0000\u0000NM\u0001\u0000\u0000\u0000NO\u0001\u0000"+
		"\u0000\u0000OP\u0001\u0000\u0000\u0000PQ\u0005\u000e\u0000\u0000Q\t\u0001"+
		"\u0000\u0000\u0000RS\u0005\r\u0000\u0000ST\u0005\u0018\u0000\u0000TU\u0003"+
		",\u0016\u0000UV\u0007\u0001\u0000\u0000V\u000b\u0001\u0000\u0000\u0000"+
		"Wg\u0003\u000e\u0007\u0000Xg\u0003\u0010\b\u0000Yg\u0003\u0012\t\u0000"+
		"Zg\u0003\u0014\n\u0000[g\u0003\u0016\u000b\u0000\\g\u0003\u0018\f\u0000"+
		"]g\u0003\u001a\r\u0000^g\u0003\u001c\u000e\u0000_g\u0003\u001e\u000f\u0000"+
		"`g\u0003 \u0010\u0000ag\u0003\"\u0011\u0000bg\u0003$\u0012\u0000cg\u0003"+
		"&\u0013\u0000dg\u0003(\u0014\u0000eg\u0003*\u0015\u0000fW\u0001\u0000"+
		"\u0000\u0000fX\u0001\u0000\u0000\u0000fY\u0001\u0000\u0000\u0000fZ\u0001"+
		"\u0000\u0000\u0000f[\u0001\u0000\u0000\u0000f\\\u0001\u0000\u0000\u0000"+
		"f]\u0001\u0000\u0000\u0000f^\u0001\u0000\u0000\u0000f_\u0001\u0000\u0000"+
		"\u0000f`\u0001\u0000\u0000\u0000fa\u0001\u0000\u0000\u0000fb\u0001\u0000"+
		"\u0000\u0000fc\u0001\u0000\u0000\u0000fd\u0001\u0000\u0000\u0000fe\u0001"+
		"\u0000\u0000\u0000g\r\u0001\u0000\u0000\u0000hi\u0005\u001b\u0000\u0000"+
		"ik\u0005\u000e\u0000\u0000jh\u0001\u0000\u0000\u0000jk\u0001\u0000\u0000"+
		"\u0000kl\u0001\u0000\u0000\u0000lm\u0005\u000f\u0000\u0000mn\u0007\u0002"+
		"\u0000\u0000n\u000f\u0001\u0000\u0000\u0000op\u0005\u001d\u0000\u0000"+
		"p\u0011\u0001\u0000\u0000\u0000qr\u0005\u001d\u0000\u0000rs\u0005\u0010"+
		"\u0000\u0000st\u0005\u0011\u0000\u0000t\u0013\u0001\u0000\u0000\u0000"+
		"uv\u0005\u001d\u0000\u0000vw\u0005\u0010\u0000\u0000wx\u0005\u0012\u0000"+
		"\u0000x\u0015\u0001\u0000\u0000\u0000yz\u0005\u001e\u0000\u0000z\u0017"+
		"\u0001\u0000\u0000\u0000{|\u0005\u001e\u0000\u0000|}\u0005\u0010\u0000"+
		"\u0000}~\u0005\u0011\u0000\u0000~\u0019\u0001\u0000\u0000\u0000\u007f"+
		"\u0080\u0005\u001e\u0000\u0000\u0080\u0081\u0005\u0010\u0000\u0000\u0081"+
		"\u0082\u0005\u0012\u0000\u0000\u0082\u001b\u0001\u0000\u0000\u0000\u0083"+
		"\u0084\u0005\u0013\u0000\u0000\u0084\u0085\u0005\u001e\u0000\u0000\u0085"+
		"\u0086\u0005\u0014\u0000\u0000\u0086\u001d\u0001\u0000\u0000\u0000\u0087"+
		"\u0088\u0005\u0013\u0000\u0000\u0088\u0089\u0005\u001d\u0000\u0000\u0089"+
		"\u008a\u0005\u0014\u0000\u0000\u008a\u008b\u0005\u0010\u0000\u0000\u008b"+
		"\u008c\u0005\u0012\u0000\u0000\u008c\u001f\u0001\u0000\u0000\u0000\u008d"+
		"\u008e\u0003.\u0017\u0000\u008e!\u0001\u0000\u0000\u0000\u008f\u0090\u0003"+
		".\u0017\u0000\u0090\u0091\u0005\u0010\u0000\u0000\u0091\u0092\u0005\u0011"+
		"\u0000\u0000\u0092#\u0001\u0000\u0000\u0000\u0093\u0094\u0003.\u0017\u0000"+
		"\u0094\u0095\u0005\u0010\u0000\u0000\u0095\u0096\u0005\u0012\u0000\u0000"+
		"\u0096%\u0001\u0000\u0000\u0000\u0097\u0098\u0005\u0013\u0000\u0000\u0098"+
		"\u0099\u0003.\u0017\u0000\u0099\u009a\u0005\u0014\u0000\u0000\u009a\'"+
		"\u0001\u0000\u0000\u0000\u009b\u009c\u0005\u0013\u0000\u0000\u009c\u009d"+
		"\u0003.\u0017\u0000\u009d\u009e\u0005\u0014\u0000\u0000\u009e\u009f\u0005"+
		"\u0010\u0000\u0000\u009f\u00a0\u0005\u0012\u0000\u0000\u00a0)\u0001\u0000"+
		"\u0000\u0000\u00a1\u00a6\u0005\r\u0000\u0000\u00a2\u00a3\u0007\u0003\u0000"+
		"\u0000\u00a3\u00a5\u0005\u001c\u0000\u0000\u00a4\u00a2\u0001\u0000\u0000"+
		"\u0000\u00a5\u00a8\u0001\u0000\u0000\u0000\u00a6\u00a4\u0001\u0000\u0000"+
		"\u0000\u00a6\u00a7\u0001\u0000\u0000\u0000\u00a7+\u0001\u0000\u0000\u0000"+
		"\u00a8\u00a6\u0001\u0000\u0000\u0000\u00a9\u00aa\u0007\u0004\u0000\u0000"+
		"\u00aa-\u0001\u0000\u0000\u0000\u00ab\u00b8\u0005\u001b\u0000\u0000\u00ac"+
		"\u00ad\u0005\u0015\u0000\u0000\u00ad\u00b8\u0005\u001b\u0000\u0000\u00ae"+
		"\u00b0\u0005\u0015\u0000\u0000\u00af\u00b1\u0005\u001b\u0000\u0000\u00b0"+
		"\u00af\u0001\u0000\u0000\u0000\u00b0\u00b1\u0001\u0000\u0000\u0000\u00b1"+
		"\u00b3\u0001\u0000\u0000\u0000\u00b2\u00b4\u0007\u0003\u0000\u0000\u00b3"+
		"\u00b2\u0001\u0000\u0000\u0000\u00b4\u00b5\u0001\u0000\u0000\u0000\u00b5"+
		"\u00b3\u0001\u0000\u0000\u0000\u00b5\u00b6\u0001\u0000\u0000\u0000\u00b6"+
		"\u00b8\u0001\u0000\u0000\u0000\u00b7\u00ab\u0001\u0000\u0000\u0000\u00b7"+
		"\u00ac\u0001\u0000\u0000\u0000\u00b7\u00ae\u0001\u0000\u0000\u0000\u00b8"+
		"/\u0001\u0000\u0000\u0000\f3<DHKNfj\u00a6\u00b0\u00b5\u00b7";
	public static final ATN _ATN =
		new ATNDeserializer().deserialize(_serializedATN.toCharArray());
	static {
		_decisionToDFA = new DFA[_ATN.getNumberOfDecisions()];
		for (int i = 0; i < _ATN.getNumberOfDecisions(); i++) {
			_decisionToDFA[i] = new DFA(_ATN.getDecisionState(i), i);
		}
	}
}