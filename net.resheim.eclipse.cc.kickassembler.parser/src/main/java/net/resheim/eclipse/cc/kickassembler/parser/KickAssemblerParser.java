// Generated from KickAssembler.g4 by ANTLR 4.13.2
package net.resheim.eclipse.cc.kickassembler.parser;
import org.antlr.v4.runtime.atn.*;
import org.antlr.v4.runtime.dfa.DFA;
import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.misc.*;
import org.antlr.v4.runtime.tree.*;
import java.util.List;
import java.util.Iterator;
import java.util.ArrayList;

@SuppressWarnings({"all", "warnings", "unchecked", "unused", "cast", "CheckReturnValue", "this-escape"})
public class KickAssemblerParser extends Parser {
	static { RuntimeMetaData.checkVersion("4.13.2", RuntimeMetaData.VERSION); }

	protected static final DFA[] _decisionToDFA;
	protected static final PredictionContextCache _sharedContextCache =
		new PredictionContextCache();
	public static final int
		OPCODE=1, KEYWORD=2, D_VAR=3, D_BYTE=4, D_WORD=5, D_DWORD=6, D_TEXT=7, 
		COLOR=8, P_IMPORT=9, P_IF=10, P_ELSE=11, P_ENDIF=12, P_DEFINE=13, P_UNDEF=14, 
		P_ELIF=15, P_IMPORTIF=16, P_IMPORTONCE=17, ASTERISK=18, COLON=19, HASH=20, 
		COMMA=21, X=22, Y=23, LEFT_PAREN=24, RIGHT_PAREN=25, BANG=26, PLUS=27, 
		MINUS=28, EQUALS=29, EOL=30, WS=31, IDENTIFIER=32, DECIMAL_LITERAL=33, 
		BYTE_LITERAL=34, WORD_LITERAL=35, DWORD_LITERAL=36, BINARY_LITERAL=37, 
		STRING_LITERAL=38, DIRECTIVE=39, BLOCK_COMMENT=40, LINE_COMMENT=41, DIRECTIVE_BLOCK=42;
	public static final int
		RULE_program = 0, RULE_line = 1, RULE_import_code = 2, RULE_instruction = 3, 
		RULE_dataDeclaration = 4, RULE_labelDeclaration = 5, RULE_blockDeclaration = 6, 
		RULE_variableDeclaration = 7, RULE_data = 8, RULE_byte = 9, RULE_word = 10, 
		RULE_dword = 11, RULE_text = 12, RULE_operand = 13, RULE_immediate = 14, 
		RULE_zeroPage = 15, RULE_zeroPageX = 16, RULE_zeroPageY = 17, RULE_absolute = 18, 
		RULE_absoluteX = 19, RULE_absoluteY = 20, RULE_indirect = 21, RULE_indirectIndexed = 22, 
		RULE_label = 23, RULE_labelX = 24, RULE_labelY = 25, RULE_labelIndirect = 26, 
		RULE_labelIndexed = 27, RULE_currentAddress = 28, RULE_number = 29, RULE_labelReference = 30;
	private static String[] makeRuleNames() {
		return new String[] {
			"program", "line", "import_code", "instruction", "dataDeclaration", "labelDeclaration", 
			"blockDeclaration", "variableDeclaration", "data", "byte", "word", "dword", 
			"text", "operand", "immediate", "zeroPage", "zeroPageX", "zeroPageY", 
			"absolute", "absoluteX", "absoluteY", "indirect", "indirectIndexed", 
			"label", "labelX", "labelY", "labelIndirect", "labelIndexed", "currentAddress", 
			"number", "labelReference"
		};
	}
	public static final String[] ruleNames = makeRuleNames();

	private static String[] makeLiteralNames() {
		return new String[] {
			null, null, null, "'.var'", null, null, null, null, null, "'#import'", 
			"'#if'", "'#else'", "'#endif'", "'#define'", "'#undef'", "'#elif'", "'#importif'", 
			"'#importonce'", "'*'", "':'", "'#'", "','", "'x'", "'y'", "'('", "')'", 
			"'!'", "'+'", "'-'", "'='"
		};
	}
	private static final String[] _LITERAL_NAMES = makeLiteralNames();
	private static String[] makeSymbolicNames() {
		return new String[] {
			null, "OPCODE", "KEYWORD", "D_VAR", "D_BYTE", "D_WORD", "D_DWORD", "D_TEXT", 
			"COLOR", "P_IMPORT", "P_IF", "P_ELSE", "P_ENDIF", "P_DEFINE", "P_UNDEF", 
			"P_ELIF", "P_IMPORTIF", "P_IMPORTONCE", "ASTERISK", "COLON", "HASH", 
			"COMMA", "X", "Y", "LEFT_PAREN", "RIGHT_PAREN", "BANG", "PLUS", "MINUS", 
			"EQUALS", "EOL", "WS", "IDENTIFIER", "DECIMAL_LITERAL", "BYTE_LITERAL", 
			"WORD_LITERAL", "DWORD_LITERAL", "BINARY_LITERAL", "STRING_LITERAL", 
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
			setState(65);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while ((((_la) & ~0x3f) == 0 && ((1L << _la) & 5436670714L) != 0)) {
				{
				{
				setState(62);
				line();
				}
				}
				setState(67);
				_errHandler.sync(this);
				_la = _input.LA(1);
			}
			setState(68);
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
		public DataContext data() {
			return getRuleContext(DataContext.class,0);
		}
		public VariableDeclarationContext variableDeclaration() {
			return getRuleContext(VariableDeclarationContext.class,0);
		}
		public DataDeclarationContext dataDeclaration() {
			return getRuleContext(DataDeclarationContext.class,0);
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
			setState(77);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,1,_ctx) ) {
			case 1:
				{
				setState(70);
				instruction();
				}
				break;
			case 2:
				{
				setState(71);
				data();
				}
				break;
			case 3:
				{
				setState(72);
				variableDeclaration();
				}
				break;
			case 4:
				{
				setState(73);
				dataDeclaration();
				}
				break;
			case 5:
				{
				setState(74);
				labelDeclaration();
				}
				break;
			case 6:
				{
				setState(75);
				blockDeclaration();
				}
				break;
			case 7:
				{
				setState(76);
				import_code();
				}
				break;
			}
			setState(79);
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
			setState(81);
			_la = _input.LA(1);
			if ( !(_la==P_IMPORT || _la==P_IMPORTIF) ) {
			_errHandler.recoverInline(this);
			}
			else {
				if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
				_errHandler.reportMatch(this);
				consume();
			}
			setState(82);
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
			setState(85);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 4362600448L) != 0)) {
				{
				setState(84);
				labelDeclaration();
				}
			}

			setState(87);
			match(OPCODE);
			setState(89);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if ((((_la) & ~0x3f) == 0 && ((1L << _la) & 55919771648L) != 0)) {
				{
				setState(88);
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
	public static class DataDeclarationContext extends ParserRuleContext {
		public Token name;
		public TerminalNode COLON() { return getToken(KickAssemblerParser.COLON, 0); }
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public List<DataContext> data() {
			return getRuleContexts(DataContext.class);
		}
		public DataContext data(int i) {
			return getRuleContext(DataContext.class,i);
		}
		public List<TerminalNode> EOL() { return getTokens(KickAssemblerParser.EOL); }
		public TerminalNode EOL(int i) {
			return getToken(KickAssemblerParser.EOL, i);
		}
		public DataDeclarationContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_dataDeclaration; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterDataDeclaration(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitDataDeclaration(this);
		}
	}

	public final DataDeclarationContext dataDeclaration() throws RecognitionException {
		DataDeclarationContext _localctx = new DataDeclarationContext(_ctx, getState());
		enterRule(_localctx, 8, RULE_dataDeclaration);
		int _la;
		try {
			int _alt;
			enterOuterAlt(_localctx, 1);
			{
			setState(91);
			((DataDeclarationContext)_localctx).name = match(IDENTIFIER);
			setState(92);
			match(COLON);
			setState(100); 
			_errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					setState(96);
					_errHandler.sync(this);
					_la = _input.LA(1);
					while (_la==EOL) {
						{
						{
						setState(93);
						match(EOL);
						}
						}
						setState(98);
						_errHandler.sync(this);
						_la = _input.LA(1);
					}
					setState(99);
					data();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				setState(102); 
				_errHandler.sync(this);
				_alt = getInterpreter().adaptivePredict(_input,5,_ctx);
			} while ( _alt!=2 && _alt!=org.antlr.v4.runtime.atn.ATN.INVALID_ALT_NUMBER );
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
		enterRule(_localctx, 10, RULE_labelDeclaration);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(105);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==BANG) {
				{
				setState(104);
				match(BANG);
				}
			}

			setState(108);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(107);
				match(IDENTIFIER);
				}
			}

			setState(110);
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
		enterRule(_localctx, 12, RULE_blockDeclaration);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(112);
			match(ASTERISK);
			setState(113);
			match(EQUALS);
			setState(114);
			number();
			setState(115);
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
	public static class VariableDeclarationContext extends ParserRuleContext {
		public Token variable;
		public TerminalNode D_VAR() { return getToken(KickAssemblerParser.D_VAR, 0); }
		public TerminalNode EQUALS() { return getToken(KickAssemblerParser.EQUALS, 0); }
		public NumberContext number() {
			return getRuleContext(NumberContext.class,0);
		}
		public TerminalNode IDENTIFIER() { return getToken(KickAssemblerParser.IDENTIFIER, 0); }
		public VariableDeclarationContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_variableDeclaration; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterVariableDeclaration(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitVariableDeclaration(this);
		}
	}

	public final VariableDeclarationContext variableDeclaration() throws RecognitionException {
		VariableDeclarationContext _localctx = new VariableDeclarationContext(_ctx, getState());
		enterRule(_localctx, 14, RULE_variableDeclaration);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(117);
			match(D_VAR);
			setState(118);
			((VariableDeclarationContext)_localctx).variable = match(IDENTIFIER);
			setState(119);
			match(EQUALS);
			setState(120);
			number();
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
	public static class DataContext extends ParserRuleContext {
		public ByteContext byte_() {
			return getRuleContext(ByteContext.class,0);
		}
		public WordContext word() {
			return getRuleContext(WordContext.class,0);
		}
		public DwordContext dword() {
			return getRuleContext(DwordContext.class,0);
		}
		public TextContext text() {
			return getRuleContext(TextContext.class,0);
		}
		public DataContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_data; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterData(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitData(this);
		}
	}

	public final DataContext data() throws RecognitionException {
		DataContext _localctx = new DataContext(_ctx, getState());
		enterRule(_localctx, 16, RULE_data);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(126);
			_errHandler.sync(this);
			switch (_input.LA(1)) {
			case D_BYTE:
				{
				setState(122);
				byte_();
				}
				break;
			case D_WORD:
				{
				setState(123);
				word();
				}
				break;
			case D_DWORD:
				{
				setState(124);
				dword();
				}
				break;
			case D_TEXT:
				{
				setState(125);
				text();
				}
				break;
			default:
				throw new NoViableAltException(this);
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
	public static class ByteContext extends ParserRuleContext {
		public TerminalNode D_BYTE() { return getToken(KickAssemblerParser.D_BYTE, 0); }
		public List<TerminalNode> DECIMAL_LITERAL() { return getTokens(KickAssemblerParser.DECIMAL_LITERAL); }
		public TerminalNode DECIMAL_LITERAL(int i) {
			return getToken(KickAssemblerParser.DECIMAL_LITERAL, i);
		}
		public List<TerminalNode> BYTE_LITERAL() { return getTokens(KickAssemblerParser.BYTE_LITERAL); }
		public TerminalNode BYTE_LITERAL(int i) {
			return getToken(KickAssemblerParser.BYTE_LITERAL, i);
		}
		public List<TerminalNode> BINARY_LITERAL() { return getTokens(KickAssemblerParser.BINARY_LITERAL); }
		public TerminalNode BINARY_LITERAL(int i) {
			return getToken(KickAssemblerParser.BINARY_LITERAL, i);
		}
		public List<TerminalNode> COMMA() { return getTokens(KickAssemblerParser.COMMA); }
		public TerminalNode COMMA(int i) {
			return getToken(KickAssemblerParser.COMMA, i);
		}
		public ByteContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_byte; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterByte(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitByte(this);
		}
	}

	public final ByteContext byte_() throws RecognitionException {
		ByteContext _localctx = new ByteContext(_ctx, getState());
		enterRule(_localctx, 18, RULE_byte);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(128);
			match(D_BYTE);
			setState(129);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 163208757248L) != 0)) ) {
			_errHandler.recoverInline(this);
			}
			else {
				if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
				_errHandler.reportMatch(this);
				consume();
			}
			setState(134);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while (_la==COMMA) {
				{
				{
				setState(130);
				match(COMMA);
				setState(131);
				_la = _input.LA(1);
				if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 163208757248L) != 0)) ) {
				_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				}
				}
				setState(136);
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
	public static class WordContext extends ParserRuleContext {
		public TerminalNode D_WORD() { return getToken(KickAssemblerParser.D_WORD, 0); }
		public List<TerminalNode> DECIMAL_LITERAL() { return getTokens(KickAssemblerParser.DECIMAL_LITERAL); }
		public TerminalNode DECIMAL_LITERAL(int i) {
			return getToken(KickAssemblerParser.DECIMAL_LITERAL, i);
		}
		public List<TerminalNode> WORD_LITERAL() { return getTokens(KickAssemblerParser.WORD_LITERAL); }
		public TerminalNode WORD_LITERAL(int i) {
			return getToken(KickAssemblerParser.WORD_LITERAL, i);
		}
		public List<TerminalNode> COMMA() { return getTokens(KickAssemblerParser.COMMA); }
		public TerminalNode COMMA(int i) {
			return getToken(KickAssemblerParser.COMMA, i);
		}
		public WordContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_word; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterWord(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitWord(this);
		}
	}

	public final WordContext word() throws RecognitionException {
		WordContext _localctx = new WordContext(_ctx, getState());
		enterRule(_localctx, 20, RULE_word);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(137);
			match(D_WORD);
			setState(138);
			_la = _input.LA(1);
			if ( !(_la==DECIMAL_LITERAL || _la==WORD_LITERAL) ) {
			_errHandler.recoverInline(this);
			}
			else {
				if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
				_errHandler.reportMatch(this);
				consume();
			}
			setState(143);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while (_la==COMMA) {
				{
				{
				setState(139);
				match(COMMA);
				setState(140);
				_la = _input.LA(1);
				if ( !(_la==DECIMAL_LITERAL || _la==WORD_LITERAL) ) {
				_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				}
				}
				setState(145);
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
	public static class DwordContext extends ParserRuleContext {
		public TerminalNode D_DWORD() { return getToken(KickAssemblerParser.D_DWORD, 0); }
		public List<TerminalNode> DECIMAL_LITERAL() { return getTokens(KickAssemblerParser.DECIMAL_LITERAL); }
		public TerminalNode DECIMAL_LITERAL(int i) {
			return getToken(KickAssemblerParser.DECIMAL_LITERAL, i);
		}
		public List<TerminalNode> DWORD_LITERAL() { return getTokens(KickAssemblerParser.DWORD_LITERAL); }
		public TerminalNode DWORD_LITERAL(int i) {
			return getToken(KickAssemblerParser.DWORD_LITERAL, i);
		}
		public List<TerminalNode> COMMA() { return getTokens(KickAssemblerParser.COMMA); }
		public TerminalNode COMMA(int i) {
			return getToken(KickAssemblerParser.COMMA, i);
		}
		public DwordContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_dword; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterDword(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitDword(this);
		}
	}

	public final DwordContext dword() throws RecognitionException {
		DwordContext _localctx = new DwordContext(_ctx, getState());
		enterRule(_localctx, 22, RULE_dword);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(146);
			match(D_DWORD);
			setState(147);
			_la = _input.LA(1);
			if ( !(_la==DECIMAL_LITERAL || _la==DWORD_LITERAL) ) {
			_errHandler.recoverInline(this);
			}
			else {
				if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
				_errHandler.reportMatch(this);
				consume();
			}
			setState(152);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while (_la==COMMA) {
				{
				{
				setState(148);
				match(COMMA);
				setState(149);
				_la = _input.LA(1);
				if ( !(_la==DECIMAL_LITERAL || _la==DWORD_LITERAL) ) {
				_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				}
				}
				setState(154);
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
	public static class TextContext extends ParserRuleContext {
		public TerminalNode D_TEXT() { return getToken(KickAssemblerParser.D_TEXT, 0); }
		public TerminalNode STRING_LITERAL() { return getToken(KickAssemblerParser.STRING_LITERAL, 0); }
		public TextContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_text; }
		@Override
		public void enterRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).enterText(this);
		}
		@Override
		public void exitRule(ParseTreeListener listener) {
			if ( listener instanceof KickAssemblerListener ) ((KickAssemblerListener)listener).exitText(this);
		}
	}

	public final TextContext text() throws RecognitionException {
		TextContext _localctx = new TextContext(_ctx, getState());
		enterRule(_localctx, 24, RULE_text);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(155);
			match(D_TEXT);
			setState(156);
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
		enterRule(_localctx, 26, RULE_operand);
		try {
			setState(173);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,12,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(158);
				immediate();
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(159);
				zeroPage();
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(160);
				zeroPageX();
				}
				break;
			case 4:
				enterOuterAlt(_localctx, 4);
				{
				setState(161);
				zeroPageY();
				}
				break;
			case 5:
				enterOuterAlt(_localctx, 5);
				{
				setState(162);
				absolute();
				}
				break;
			case 6:
				enterOuterAlt(_localctx, 6);
				{
				setState(163);
				absoluteX();
				}
				break;
			case 7:
				enterOuterAlt(_localctx, 7);
				{
				setState(164);
				absoluteY();
				}
				break;
			case 8:
				enterOuterAlt(_localctx, 8);
				{
				setState(165);
				indirect();
				}
				break;
			case 9:
				enterOuterAlt(_localctx, 9);
				{
				setState(166);
				indirectIndexed();
				}
				break;
			case 10:
				enterOuterAlt(_localctx, 10);
				{
				setState(167);
				label();
				}
				break;
			case 11:
				enterOuterAlt(_localctx, 11);
				{
				setState(168);
				labelX();
				}
				break;
			case 12:
				enterOuterAlt(_localctx, 12);
				{
				setState(169);
				labelY();
				}
				break;
			case 13:
				enterOuterAlt(_localctx, 13);
				{
				setState(170);
				labelIndirect();
				}
				break;
			case 14:
				enterOuterAlt(_localctx, 14);
				{
				setState(171);
				labelIndexed();
				}
				break;
			case 15:
				enterOuterAlt(_localctx, 15);
				{
				setState(172);
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
		public TerminalNode BYTE_LITERAL() { return getToken(KickAssemblerParser.BYTE_LITERAL, 0); }
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
		enterRule(_localctx, 28, RULE_immediate);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(177);
			_errHandler.sync(this);
			_la = _input.LA(1);
			if (_la==IDENTIFIER) {
				{
				setState(175);
				match(IDENTIFIER);
				setState(176);
				match(COLON);
				}
			}

			setState(179);
			match(HASH);
			setState(180);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 163208757248L) != 0)) ) {
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
		public TerminalNode BYTE_LITERAL() { return getToken(KickAssemblerParser.BYTE_LITERAL, 0); }
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
		enterRule(_localctx, 30, RULE_zeroPage);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(182);
			match(BYTE_LITERAL);
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
		public TerminalNode BYTE_LITERAL() { return getToken(KickAssemblerParser.BYTE_LITERAL, 0); }
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
		enterRule(_localctx, 32, RULE_zeroPageX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(184);
			match(BYTE_LITERAL);
			setState(185);
			match(COMMA);
			setState(186);
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
		public TerminalNode BYTE_LITERAL() { return getToken(KickAssemblerParser.BYTE_LITERAL, 0); }
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
		enterRule(_localctx, 34, RULE_zeroPageY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(188);
			match(BYTE_LITERAL);
			setState(189);
			match(COMMA);
			setState(190);
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
		public TerminalNode WORD_LITERAL() { return getToken(KickAssemblerParser.WORD_LITERAL, 0); }
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
		enterRule(_localctx, 36, RULE_absolute);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(192);
			match(WORD_LITERAL);
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
		public TerminalNode WORD_LITERAL() { return getToken(KickAssemblerParser.WORD_LITERAL, 0); }
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
		enterRule(_localctx, 38, RULE_absoluteX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(194);
			match(WORD_LITERAL);
			setState(195);
			match(COMMA);
			setState(196);
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
		public TerminalNode WORD_LITERAL() { return getToken(KickAssemblerParser.WORD_LITERAL, 0); }
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
		enterRule(_localctx, 40, RULE_absoluteY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(198);
			match(WORD_LITERAL);
			setState(199);
			match(COMMA);
			setState(200);
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
		public TerminalNode WORD_LITERAL() { return getToken(KickAssemblerParser.WORD_LITERAL, 0); }
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
		enterRule(_localctx, 42, RULE_indirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(202);
			match(LEFT_PAREN);
			setState(203);
			match(WORD_LITERAL);
			setState(204);
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
		public TerminalNode BYTE_LITERAL() { return getToken(KickAssemblerParser.BYTE_LITERAL, 0); }
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
		enterRule(_localctx, 44, RULE_indirectIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(206);
			match(LEFT_PAREN);
			setState(207);
			match(BYTE_LITERAL);
			setState(208);
			match(RIGHT_PAREN);
			setState(209);
			match(COMMA);
			setState(210);
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
		enterRule(_localctx, 46, RULE_label);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(212);
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
		enterRule(_localctx, 48, RULE_labelX);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(214);
			labelReference();
			setState(215);
			match(COMMA);
			setState(216);
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
		enterRule(_localctx, 50, RULE_labelY);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(218);
			labelReference();
			setState(219);
			match(COMMA);
			setState(220);
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
		enterRule(_localctx, 52, RULE_labelIndirect);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(222);
			match(LEFT_PAREN);
			setState(223);
			labelReference();
			setState(224);
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
		enterRule(_localctx, 54, RULE_labelIndexed);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(226);
			match(LEFT_PAREN);
			setState(227);
			labelReference();
			setState(228);
			match(RIGHT_PAREN);
			setState(229);
			match(COMMA);
			setState(230);
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
		enterRule(_localctx, 56, RULE_currentAddress);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(232);
			match(ASTERISK);
			setState(237);
			_errHandler.sync(this);
			_la = _input.LA(1);
			while (_la==PLUS || _la==MINUS) {
				{
				{
				setState(233);
				_la = _input.LA(1);
				if ( !(_la==PLUS || _la==MINUS) ) {
				_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				setState(234);
				match(DECIMAL_LITERAL);
				}
				}
				setState(239);
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
		public TerminalNode WORD_LITERAL() { return getToken(KickAssemblerParser.WORD_LITERAL, 0); }
		public TerminalNode BYTE_LITERAL() { return getToken(KickAssemblerParser.BYTE_LITERAL, 0); }
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
		enterRule(_localctx, 58, RULE_number);
		int _la;
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(240);
			_la = _input.LA(1);
			if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 60129542144L) != 0)) ) {
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
		enterRule(_localctx, 60, RULE_labelReference);
		int _la;
		try {
			setState(254);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,17,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(242);
				match(IDENTIFIER);
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(243);
				match(BANG);
				setState(244);
				match(IDENTIFIER);
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(245);
				match(BANG);
				setState(247);
				_errHandler.sync(this);
				_la = _input.LA(1);
				if (_la==IDENTIFIER) {
					{
					setState(246);
					match(IDENTIFIER);
					}
				}

				setState(250); 
				_errHandler.sync(this);
				_la = _input.LA(1);
				do {
					{
					{
					setState(249);
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
					setState(252); 
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
		"\u0004\u0001*\u0101\u0002\u0000\u0007\u0000\u0002\u0001\u0007\u0001\u0002"+
		"\u0002\u0007\u0002\u0002\u0003\u0007\u0003\u0002\u0004\u0007\u0004\u0002"+
		"\u0005\u0007\u0005\u0002\u0006\u0007\u0006\u0002\u0007\u0007\u0007\u0002"+
		"\b\u0007\b\u0002\t\u0007\t\u0002\n\u0007\n\u0002\u000b\u0007\u000b\u0002"+
		"\f\u0007\f\u0002\r\u0007\r\u0002\u000e\u0007\u000e\u0002\u000f\u0007\u000f"+
		"\u0002\u0010\u0007\u0010\u0002\u0011\u0007\u0011\u0002\u0012\u0007\u0012"+
		"\u0002\u0013\u0007\u0013\u0002\u0014\u0007\u0014\u0002\u0015\u0007\u0015"+
		"\u0002\u0016\u0007\u0016\u0002\u0017\u0007\u0017\u0002\u0018\u0007\u0018"+
		"\u0002\u0019\u0007\u0019\u0002\u001a\u0007\u001a\u0002\u001b\u0007\u001b"+
		"\u0002\u001c\u0007\u001c\u0002\u001d\u0007\u001d\u0002\u001e\u0007\u001e"+
		"\u0001\u0000\u0005\u0000@\b\u0000\n\u0000\f\u0000C\t\u0000\u0001\u0000"+
		"\u0001\u0000\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0003\u0001N\b\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0002\u0001\u0002\u0001\u0002\u0001\u0003\u0003\u0003V\b\u0003"+
		"\u0001\u0003\u0001\u0003\u0003\u0003Z\b\u0003\u0001\u0004\u0001\u0004"+
		"\u0001\u0004\u0005\u0004_\b\u0004\n\u0004\f\u0004b\t\u0004\u0001\u0004"+
		"\u0004\u0004e\b\u0004\u000b\u0004\f\u0004f\u0001\u0005\u0003\u0005j\b"+
		"\u0005\u0001\u0005\u0003\u0005m\b\u0005\u0001\u0005\u0001\u0005\u0001"+
		"\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0006\u0001\u0007\u0001"+
		"\u0007\u0001\u0007\u0001\u0007\u0001\u0007\u0001\b\u0001\b\u0001\b\u0001"+
		"\b\u0003\b\u007f\b\b\u0001\t\u0001\t\u0001\t\u0001\t\u0005\t\u0085\b\t"+
		"\n\t\f\t\u0088\t\t\u0001\n\u0001\n\u0001\n\u0001\n\u0005\n\u008e\b\n\n"+
		"\n\f\n\u0091\t\n\u0001\u000b\u0001\u000b\u0001\u000b\u0001\u000b\u0005"+
		"\u000b\u0097\b\u000b\n\u000b\f\u000b\u009a\t\u000b\u0001\f\u0001\f\u0001"+
		"\f\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001"+
		"\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0001\r\u0003\r\u00ae\b\r\u0001"+
		"\u000e\u0001\u000e\u0003\u000e\u00b2\b\u000e\u0001\u000e\u0001\u000e\u0001"+
		"\u000e\u0001\u000f\u0001\u000f\u0001\u0010\u0001\u0010\u0001\u0010\u0001"+
		"\u0010\u0001\u0011\u0001\u0011\u0001\u0011\u0001\u0011\u0001\u0012\u0001"+
		"\u0012\u0001\u0013\u0001\u0013\u0001\u0013\u0001\u0013\u0001\u0014\u0001"+
		"\u0014\u0001\u0014\u0001\u0014\u0001\u0015\u0001\u0015\u0001\u0015\u0001"+
		"\u0015\u0001\u0016\u0001\u0016\u0001\u0016\u0001\u0016\u0001\u0016\u0001"+
		"\u0016\u0001\u0017\u0001\u0017\u0001\u0018\u0001\u0018\u0001\u0018\u0001"+
		"\u0018\u0001\u0019\u0001\u0019\u0001\u0019\u0001\u0019\u0001\u001a\u0001"+
		"\u001a\u0001\u001a\u0001\u001a\u0001\u001b\u0001\u001b\u0001\u001b\u0001"+
		"\u001b\u0001\u001b\u0001\u001b\u0001\u001c\u0001\u001c\u0001\u001c\u0005"+
		"\u001c\u00ec\b\u001c\n\u001c\f\u001c\u00ef\t\u001c\u0001\u001d\u0001\u001d"+
		"\u0001\u001e\u0001\u001e\u0001\u001e\u0001\u001e\u0001\u001e\u0003\u001e"+
		"\u00f8\b\u001e\u0001\u001e\u0004\u001e\u00fb\b\u001e\u000b\u001e\f\u001e"+
		"\u00fc\u0003\u001e\u00ff\b\u001e\u0001\u001e\u0000\u0000\u001f\u0000\u0002"+
		"\u0004\u0006\b\n\f\u000e\u0010\u0012\u0014\u0016\u0018\u001a\u001c\u001e"+
		" \"$&(*,.02468:<\u0000\u0007\u0002\u0000\t\t\u0010\u0010\u0002\u0000 "+
		" &&\u0002\u0000!\"%%\u0002\u0000!!##\u0002\u0000!!$$\u0001\u0000\u001b"+
		"\u001c\u0001\u0000!#\u0109\u0000A\u0001\u0000\u0000\u0000\u0002M\u0001"+
		"\u0000\u0000\u0000\u0004Q\u0001\u0000\u0000\u0000\u0006U\u0001\u0000\u0000"+
		"\u0000\b[\u0001\u0000\u0000\u0000\ni\u0001\u0000\u0000\u0000\fp\u0001"+
		"\u0000\u0000\u0000\u000eu\u0001\u0000\u0000\u0000\u0010~\u0001\u0000\u0000"+
		"\u0000\u0012\u0080\u0001\u0000\u0000\u0000\u0014\u0089\u0001\u0000\u0000"+
		"\u0000\u0016\u0092\u0001\u0000\u0000\u0000\u0018\u009b\u0001\u0000\u0000"+
		"\u0000\u001a\u00ad\u0001\u0000\u0000\u0000\u001c\u00b1\u0001\u0000\u0000"+
		"\u0000\u001e\u00b6\u0001\u0000\u0000\u0000 \u00b8\u0001\u0000\u0000\u0000"+
		"\"\u00bc\u0001\u0000\u0000\u0000$\u00c0\u0001\u0000\u0000\u0000&\u00c2"+
		"\u0001\u0000\u0000\u0000(\u00c6\u0001\u0000\u0000\u0000*\u00ca\u0001\u0000"+
		"\u0000\u0000,\u00ce\u0001\u0000\u0000\u0000.\u00d4\u0001\u0000\u0000\u0000"+
		"0\u00d6\u0001\u0000\u0000\u00002\u00da\u0001\u0000\u0000\u00004\u00de"+
		"\u0001\u0000\u0000\u00006\u00e2\u0001\u0000\u0000\u00008\u00e8\u0001\u0000"+
		"\u0000\u0000:\u00f0\u0001\u0000\u0000\u0000<\u00fe\u0001\u0000\u0000\u0000"+
		">@\u0003\u0002\u0001\u0000?>\u0001\u0000\u0000\u0000@C\u0001\u0000\u0000"+
		"\u0000A?\u0001\u0000\u0000\u0000AB\u0001\u0000\u0000\u0000BD\u0001\u0000"+
		"\u0000\u0000CA\u0001\u0000\u0000\u0000DE\u0005\u0000\u0000\u0001E\u0001"+
		"\u0001\u0000\u0000\u0000FN\u0003\u0006\u0003\u0000GN\u0003\u0010\b\u0000"+
		"HN\u0003\u000e\u0007\u0000IN\u0003\b\u0004\u0000JN\u0003\n\u0005\u0000"+
		"KN\u0003\f\u0006\u0000LN\u0003\u0004\u0002\u0000MF\u0001\u0000\u0000\u0000"+
		"MG\u0001\u0000\u0000\u0000MH\u0001\u0000\u0000\u0000MI\u0001\u0000\u0000"+
		"\u0000MJ\u0001\u0000\u0000\u0000MK\u0001\u0000\u0000\u0000ML\u0001\u0000"+
		"\u0000\u0000MN\u0001\u0000\u0000\u0000NO\u0001\u0000\u0000\u0000OP\u0005"+
		"\u001e\u0000\u0000P\u0003\u0001\u0000\u0000\u0000QR\u0007\u0000\u0000"+
		"\u0000RS\u0005&\u0000\u0000S\u0005\u0001\u0000\u0000\u0000TV\u0003\n\u0005"+
		"\u0000UT\u0001\u0000\u0000\u0000UV\u0001\u0000\u0000\u0000VW\u0001\u0000"+
		"\u0000\u0000WY\u0005\u0001\u0000\u0000XZ\u0003\u001a\r\u0000YX\u0001\u0000"+
		"\u0000\u0000YZ\u0001\u0000\u0000\u0000Z\u0007\u0001\u0000\u0000\u0000"+
		"[\\\u0005 \u0000\u0000\\d\u0005\u0013\u0000\u0000]_\u0005\u001e\u0000"+
		"\u0000^]\u0001\u0000\u0000\u0000_b\u0001\u0000\u0000\u0000`^\u0001\u0000"+
		"\u0000\u0000`a\u0001\u0000\u0000\u0000ac\u0001\u0000\u0000\u0000b`\u0001"+
		"\u0000\u0000\u0000ce\u0003\u0010\b\u0000d`\u0001\u0000\u0000\u0000ef\u0001"+
		"\u0000\u0000\u0000fd\u0001\u0000\u0000\u0000fg\u0001\u0000\u0000\u0000"+
		"g\t\u0001\u0000\u0000\u0000hj\u0005\u001a\u0000\u0000ih\u0001\u0000\u0000"+
		"\u0000ij\u0001\u0000\u0000\u0000jl\u0001\u0000\u0000\u0000km\u0005 \u0000"+
		"\u0000lk\u0001\u0000\u0000\u0000lm\u0001\u0000\u0000\u0000mn\u0001\u0000"+
		"\u0000\u0000no\u0005\u0013\u0000\u0000o\u000b\u0001\u0000\u0000\u0000"+
		"pq\u0005\u0012\u0000\u0000qr\u0005\u001d\u0000\u0000rs\u0003:\u001d\u0000"+
		"st\u0007\u0001\u0000\u0000t\r\u0001\u0000\u0000\u0000uv\u0005\u0003\u0000"+
		"\u0000vw\u0005 \u0000\u0000wx\u0005\u001d\u0000\u0000xy\u0003:\u001d\u0000"+
		"y\u000f\u0001\u0000\u0000\u0000z\u007f\u0003\u0012\t\u0000{\u007f\u0003"+
		"\u0014\n\u0000|\u007f\u0003\u0016\u000b\u0000}\u007f\u0003\u0018\f\u0000"+
		"~z\u0001\u0000\u0000\u0000~{\u0001\u0000\u0000\u0000~|\u0001\u0000\u0000"+
		"\u0000~}\u0001\u0000\u0000\u0000\u007f\u0011\u0001\u0000\u0000\u0000\u0080"+
		"\u0081\u0005\u0004\u0000\u0000\u0081\u0086\u0007\u0002\u0000\u0000\u0082"+
		"\u0083\u0005\u0015\u0000\u0000\u0083\u0085\u0007\u0002\u0000\u0000\u0084"+
		"\u0082\u0001\u0000\u0000\u0000\u0085\u0088\u0001\u0000\u0000\u0000\u0086"+
		"\u0084\u0001\u0000\u0000\u0000\u0086\u0087\u0001\u0000\u0000\u0000\u0087"+
		"\u0013\u0001\u0000\u0000\u0000\u0088\u0086\u0001\u0000\u0000\u0000\u0089"+
		"\u008a\u0005\u0005\u0000\u0000\u008a\u008f\u0007\u0003\u0000\u0000\u008b"+
		"\u008c\u0005\u0015\u0000\u0000\u008c\u008e\u0007\u0003\u0000\u0000\u008d"+
		"\u008b\u0001\u0000\u0000\u0000\u008e\u0091\u0001\u0000\u0000\u0000\u008f"+
		"\u008d\u0001\u0000\u0000\u0000\u008f\u0090\u0001\u0000\u0000\u0000\u0090"+
		"\u0015\u0001\u0000\u0000\u0000\u0091\u008f\u0001\u0000\u0000\u0000\u0092"+
		"\u0093\u0005\u0006\u0000\u0000\u0093\u0098\u0007\u0004\u0000\u0000\u0094"+
		"\u0095\u0005\u0015\u0000\u0000\u0095\u0097\u0007\u0004\u0000\u0000\u0096"+
		"\u0094\u0001\u0000\u0000\u0000\u0097\u009a\u0001\u0000\u0000\u0000\u0098"+
		"\u0096\u0001\u0000\u0000\u0000\u0098\u0099\u0001\u0000\u0000\u0000\u0099"+
		"\u0017\u0001\u0000\u0000\u0000\u009a\u0098\u0001\u0000\u0000\u0000\u009b"+
		"\u009c\u0005\u0007\u0000\u0000\u009c\u009d\u0005&\u0000\u0000\u009d\u0019"+
		"\u0001\u0000\u0000\u0000\u009e\u00ae\u0003\u001c\u000e\u0000\u009f\u00ae"+
		"\u0003\u001e\u000f\u0000\u00a0\u00ae\u0003 \u0010\u0000\u00a1\u00ae\u0003"+
		"\"\u0011\u0000\u00a2\u00ae\u0003$\u0012\u0000\u00a3\u00ae\u0003&\u0013"+
		"\u0000\u00a4\u00ae\u0003(\u0014\u0000\u00a5\u00ae\u0003*\u0015\u0000\u00a6"+
		"\u00ae\u0003,\u0016\u0000\u00a7\u00ae\u0003.\u0017\u0000\u00a8\u00ae\u0003"+
		"0\u0018\u0000\u00a9\u00ae\u00032\u0019\u0000\u00aa\u00ae\u00034\u001a"+
		"\u0000\u00ab\u00ae\u00036\u001b\u0000\u00ac\u00ae\u00038\u001c\u0000\u00ad"+
		"\u009e\u0001\u0000\u0000\u0000\u00ad\u009f\u0001\u0000\u0000\u0000\u00ad"+
		"\u00a0\u0001\u0000\u0000\u0000\u00ad\u00a1\u0001\u0000\u0000\u0000\u00ad"+
		"\u00a2\u0001\u0000\u0000\u0000\u00ad\u00a3\u0001\u0000\u0000\u0000\u00ad"+
		"\u00a4\u0001\u0000\u0000\u0000\u00ad\u00a5\u0001\u0000\u0000\u0000\u00ad"+
		"\u00a6\u0001\u0000\u0000\u0000\u00ad\u00a7\u0001\u0000\u0000\u0000\u00ad"+
		"\u00a8\u0001\u0000\u0000\u0000\u00ad\u00a9\u0001\u0000\u0000\u0000\u00ad"+
		"\u00aa\u0001\u0000\u0000\u0000\u00ad\u00ab\u0001\u0000\u0000\u0000\u00ad"+
		"\u00ac\u0001\u0000\u0000\u0000\u00ae\u001b\u0001\u0000\u0000\u0000\u00af"+
		"\u00b0\u0005 \u0000\u0000\u00b0\u00b2\u0005\u0013\u0000\u0000\u00b1\u00af"+
		"\u0001\u0000\u0000\u0000\u00b1\u00b2\u0001\u0000\u0000\u0000\u00b2\u00b3"+
		"\u0001\u0000\u0000\u0000\u00b3\u00b4\u0005\u0014\u0000\u0000\u00b4\u00b5"+
		"\u0007\u0002\u0000\u0000\u00b5\u001d\u0001\u0000\u0000\u0000\u00b6\u00b7"+
		"\u0005\"\u0000\u0000\u00b7\u001f\u0001\u0000\u0000\u0000\u00b8\u00b9\u0005"+
		"\"\u0000\u0000\u00b9\u00ba\u0005\u0015\u0000\u0000\u00ba\u00bb\u0005\u0016"+
		"\u0000\u0000\u00bb!\u0001\u0000\u0000\u0000\u00bc\u00bd\u0005\"\u0000"+
		"\u0000\u00bd\u00be\u0005\u0015\u0000\u0000\u00be\u00bf\u0005\u0017\u0000"+
		"\u0000\u00bf#\u0001\u0000\u0000\u0000\u00c0\u00c1\u0005#\u0000\u0000\u00c1"+
		"%\u0001\u0000\u0000\u0000\u00c2\u00c3\u0005#\u0000\u0000\u00c3\u00c4\u0005"+
		"\u0015\u0000\u0000\u00c4\u00c5\u0005\u0016\u0000\u0000\u00c5\'\u0001\u0000"+
		"\u0000\u0000\u00c6\u00c7\u0005#\u0000\u0000\u00c7\u00c8\u0005\u0015\u0000"+
		"\u0000\u00c8\u00c9\u0005\u0017\u0000\u0000\u00c9)\u0001\u0000\u0000\u0000"+
		"\u00ca\u00cb\u0005\u0018\u0000\u0000\u00cb\u00cc\u0005#\u0000\u0000\u00cc"+
		"\u00cd\u0005\u0019\u0000\u0000\u00cd+\u0001\u0000\u0000\u0000\u00ce\u00cf"+
		"\u0005\u0018\u0000\u0000\u00cf\u00d0\u0005\"\u0000\u0000\u00d0\u00d1\u0005"+
		"\u0019\u0000\u0000\u00d1\u00d2\u0005\u0015\u0000\u0000\u00d2\u00d3\u0005"+
		"\u0017\u0000\u0000\u00d3-\u0001\u0000\u0000\u0000\u00d4\u00d5\u0003<\u001e"+
		"\u0000\u00d5/\u0001\u0000\u0000\u0000\u00d6\u00d7\u0003<\u001e\u0000\u00d7"+
		"\u00d8\u0005\u0015\u0000\u0000\u00d8\u00d9\u0005\u0016\u0000\u0000\u00d9"+
		"1\u0001\u0000\u0000\u0000\u00da\u00db\u0003<\u001e\u0000\u00db\u00dc\u0005"+
		"\u0015\u0000\u0000\u00dc\u00dd\u0005\u0017\u0000\u0000\u00dd3\u0001\u0000"+
		"\u0000\u0000\u00de\u00df\u0005\u0018\u0000\u0000\u00df\u00e0\u0003<\u001e"+
		"\u0000\u00e0\u00e1\u0005\u0019\u0000\u0000\u00e15\u0001\u0000\u0000\u0000"+
		"\u00e2\u00e3\u0005\u0018\u0000\u0000\u00e3\u00e4\u0003<\u001e\u0000\u00e4"+
		"\u00e5\u0005\u0019\u0000\u0000\u00e5\u00e6\u0005\u0015\u0000\u0000\u00e6"+
		"\u00e7\u0005\u0017\u0000\u0000\u00e77\u0001\u0000\u0000\u0000\u00e8\u00ed"+
		"\u0005\u0012\u0000\u0000\u00e9\u00ea\u0007\u0005\u0000\u0000\u00ea\u00ec"+
		"\u0005!\u0000\u0000\u00eb\u00e9\u0001\u0000\u0000\u0000\u00ec\u00ef\u0001"+
		"\u0000\u0000\u0000\u00ed\u00eb\u0001\u0000\u0000\u0000\u00ed\u00ee\u0001"+
		"\u0000\u0000\u0000\u00ee9\u0001\u0000\u0000\u0000\u00ef\u00ed\u0001\u0000"+
		"\u0000\u0000\u00f0\u00f1\u0007\u0006\u0000\u0000\u00f1;\u0001\u0000\u0000"+
		"\u0000\u00f2\u00ff\u0005 \u0000\u0000\u00f3\u00f4\u0005\u001a\u0000\u0000"+
		"\u00f4\u00ff\u0005 \u0000\u0000\u00f5\u00f7\u0005\u001a\u0000\u0000\u00f6"+
		"\u00f8\u0005 \u0000\u0000\u00f7\u00f6\u0001\u0000\u0000\u0000\u00f7\u00f8"+
		"\u0001\u0000\u0000\u0000\u00f8\u00fa\u0001\u0000\u0000\u0000\u00f9\u00fb"+
		"\u0007\u0005\u0000\u0000\u00fa\u00f9\u0001\u0000\u0000\u0000\u00fb\u00fc"+
		"\u0001\u0000\u0000\u0000\u00fc\u00fa\u0001\u0000\u0000\u0000\u00fc\u00fd"+
		"\u0001\u0000\u0000\u0000\u00fd\u00ff\u0001\u0000\u0000\u0000\u00fe\u00f2"+
		"\u0001\u0000\u0000\u0000\u00fe\u00f3\u0001\u0000\u0000\u0000\u00fe\u00f5"+
		"\u0001\u0000\u0000\u0000\u00ff=\u0001\u0000\u0000\u0000\u0012AMUY`fil"+
		"~\u0086\u008f\u0098\u00ad\u00b1\u00ed\u00f7\u00fc\u00fe";
	public static final ATN _ATN =
		new ATNDeserializer().deserialize(_serializedATN.toCharArray());
	static {
		_decisionToDFA = new DFA[_ATN.getNumberOfDecisions()];
		for (int i = 0; i < _ATN.getNumberOfDecisions(); i++) {
			_decisionToDFA[i] = new DFA(_ATN.getDecisionState(i), i);
		}
	}
}