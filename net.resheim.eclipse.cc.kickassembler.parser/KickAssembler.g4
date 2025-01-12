/*
 *  This is a basic grammar for 6502 assembly and KickAssembler.
 *
 * Since the main goal for this project is to create a modern IDE for the
 * Commodore 64, none of the 65C02 variants are supported in this grammar.
 *
 * The KickAssembler compiler supports a wide range of different instructions
 * and features.
 *
 */
grammar KickAssembler;

options {
    caseInsensitive = true;
}

program         : line* EOF;

line            :
                (
                  instruction
                | data
                | variableDeclaration
                | dataDeclaration
                | labelDeclaration
                | blockDeclaration
                | import_code
                )? EOL ;

import_code     : ( P_IMPORT | P_IMPORTIF ) fileName=STRING_LITERAL;

instruction     : labelDeclaration? OPCODE operand? ;

dataDeclaration: name=IDENTIFIER COLON ( ( EOL )* data )+ ;
labelDeclaration: BANG? IDENTIFIER? COLON ;


blockDeclaration: ASTERISK EQUALS number ( STRING_LITERAL | IDENTIFIER );

variableDeclaration: D_VAR variable=IDENTIFIER EQUALS number;

data            : ( byte | word | dword | text );

byte            : D_BYTE ( DECIMAL_LITERAL | BYTE_LITERAL | BINARY_LITERAL ) ( COMMA ( DECIMAL_LITERAL | BYTE_LITERAL | BINARY_LITERAL ) )*;
word            : D_WORD ( DECIMAL_LITERAL | WORD_LITERAL ) ( COMMA ( DECIMAL_LITERAL | WORD_LITERAL ) )* ;
dword           : D_DWORD ( DECIMAL_LITERAL | DWORD_LITERAL ) ( COMMA ( DECIMAL_LITERAL | DWORD_LITERAL ) )* ;
text            : D_TEXT STRING_LITERAL ;

operand:          immediate
                | zeroPage | zeroPageX | zeroPageY
                | absolute | absoluteX | absoluteY
                | indirect | indirectIndexed
                | label | labelX | labelY | labelIndirect | labelIndexed
                | currentAddress // Only for JMP?
                ;

immediate       : (IDENTIFIER COLON)? HASH ( BYTE_LITERAL | BINARY_LITERAL | DECIMAL_LITERAL );
zeroPage        : BYTE_LITERAL ;
zeroPageX       : BYTE_LITERAL COMMA X ;
zeroPageY       : BYTE_LITERAL COMMA Y ;
absolute        : WORD_LITERAL ;
absoluteX       : WORD_LITERAL COMMA X ;
absoluteY       : WORD_LITERAL COMMA Y ;
indirect        : LEFT_PAREN WORD_LITERAL RIGHT_PAREN ;
indirectIndexed : LEFT_PAREN BYTE_LITERAL RIGHT_PAREN COMMA Y;
label           : labelReference ;
labelX          : labelReference COMMA X ;
labelY          : labelReference COMMA Y ;
labelIndirect   : LEFT_PAREN labelReference RIGHT_PAREN ;
labelIndexed    : LEFT_PAREN labelReference RIGHT_PAREN COMMA Y ;
currentAddress  : ASTERISK ( ( PLUS | MINUS ) DECIMAL_LITERAL )* ;

number          : ( DECIMAL_LITERAL | WORD_LITERAL | BYTE_LITERAL ) ;

labelReference: IDENTIFIER | BANG IDENTIFIER | BANG IDENTIFIER? ( PLUS | MINUS )+ ;

OPCODE          :
                ( 'adc' | 'and' | 'asl' | 'bcc' | 'bcs' | 'beq' | 'bit' | 'bmi'
                | 'bne' | 'bpl' | 'brk' | 'bvc' | 'bvs' | 'clc' | 'cld' | 'cli'
                | 'clv' | 'cmp' | 'cpx' | 'cpy' | 'dec' | 'dex' | 'dey' | 'eor'
                | 'inc' | 'inx' | 'iny' | 'jmp' | 'jsr' | 'lda' | 'ldx' | 'ldy'
                | 'lsr' | 'nop' | 'ora' | 'pha' | 'php' | 'pla' | 'plp' | 'rol'
                | 'ror' | 'rti' | 'rts' | 'sbc' | 'sec' | 'sed' | 'sei' | 'sta'
                | 'stx' | 'sty' | 'tax' | 'tay' | 'tsx' | 'txa' | 'txs' | 'tya'
                );

KEYWORD         :
                ( '.align' | '.assert' | '.asserterror' | '.break'
                | '.const' | '.cpu' | '.define' | '.disk'
                | '.encoding' | '.enum' | '.error'
                | '.errorif' | '.eval' | '.file' | '.filemodify'
                | '.filenamespace' | '.fill' | '.fillword' | '.for'
                | '.function' | '.if' | '.import' | '.importonce' | '.label'
                | '.lohifill' | '.macro' | '.memblock' | '.modify'
                | '.namespace' | '.pc' | '.plugin' | '.print' | '.printnow'
                | '.pseudocommand' | '.pseudopc' | '.return' | '.segment'
                | '.segmentdef' | '.segmentout' | '.struct'
                | '.while' | '.zp'
                );

D_VAR           : '.var' ;

D_BYTE          : ( '.by' | '.byte' );
D_WORD          : ( '.wo' | '.word' );
D_DWORD         : ( '.dw' | '.dword' );
D_TEXT          : ( '.te' | '.text' );

COLOR           :
                ( 'black' | 'white'  | 'red'    | 'cyan'  | 'purple' | 'green'
                | 'blue'  | 'yellow' | 'orange' | 'brown' | 'light_red'
                | 'dark_gray' | 'dark_grey' | 'gray' | 'grey' | 'light_green'
                | 'light_blue' | 'light_gray' | 'light_grey'
                ) -> channel(HIDDEN);

// Preprocessors
P_IMPORT          : '#import';
P_IF              : '#if';
P_ELSE            : '#else';
P_ENDIF           : '#endif';
P_DEFINE          : '#define';
P_UNDEF           : '#undef';
P_ELIF            : '#elif';
P_IMPORTIF        : '#importif';
P_IMPORTONCE      : '#importonce';


ASTERISK        : '*' ;
COLON           : ':' ;
HASH            : '#' ;
COMMA           : ',' ;
X               : 'x' ;
Y               : 'y' ;
LEFT_PAREN      : '(' ;
RIGHT_PAREN     : ')' ;
BANG            : '!' ;
PLUS            : '+' ;
MINUS           : '-' ;
EQUALS          : '=' ;
EOL             : '\r\n' | '\n' ;
WS              : [ \t]+  -> channel(HIDDEN) ;

IDENTIFIER      : [a-z_] [a-z0-9_]* ;

// Numbers
DECIMAL_LITERAL : [0-9]+ ;
BYTE_LITERAL     : '$' [0-9a-f] [0-9a-f]? ;
WORD_LITERAL     : '$' [0-9a-f] [0-9a-f] [0-9a-f] [0-9a-f] ;
DWORD_LITERAL    : '$' [0-9a-f] [0-9a-f] [0-9a-f] [0-9a-f] [0-9a-f] [0-9a-f] [0-9a-f] [0-9a-f] ;
BINARY_LITERAL  : '%' [01]+ ;
STRING_LITERAL  : '"' ~["]* '"';

// Structures to ignore for now
DIRECTIVE       : KEYWORD ( ~[\r\n{]* | EOL ) -> channel(HIDDEN) ;
BLOCK_COMMENT   : '/*' .*? '*/' -> channel(HIDDEN) ;
LINE_COMMENT    : '//' ~[\r\n]* -> channel(HIDDEN) ;
DIRECTIVE_BLOCK : '{' .*? '}' -> channel(HIDDEN) ;

