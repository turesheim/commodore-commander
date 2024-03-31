/*
 *  A basic grammar for 6502 assembly and KickAssembler.
 *
 * Since the main goal for this project is to create a modern IDE for the
 * Commodore 64, none of the 65C02 variants are supported in this grammar.
 *
 */
grammar KickAssembler;

options {
    caseInsensitive = true;
}

program         : line* EOF;

line            : ( instruction | labelDeclaration )? EOL ;

instruction     : labelDeclaration? OPCODE operand? ;

labelDeclaration: IDENTIFIER COLON ;

operand:          immediate
                | zeroPage
                | zeroPageX
                | zeroPageY
                | absolute
                | absoluteX
                | absoluteY
                | indirect
                | indirectIndexed
                | label
                | labelX
                | labelY
                | labelIndirect
                | labelIndexed
                ;

immediate       : HASH ( HEX_LITERAL | BINARY_LITERAL | DECIMAL_LITERAL );
zeroPage        : HEX_LITERAL ;
zeroPageX       : HEX_LITERAL COMMA X ;
zeroPageY       : HEX_LITERAL COMMA Y ;
absolute        : HEX_LONG_LITERAL ;
absoluteX       : HEX_LONG_LITERAL COMMA X ;
absoluteY       : HEX_LONG_LITERAL COMMA Y ;
indirect        : LEFT_PAREN HEX_LONG_LITERAL RIGHT_PAREN ;
indirectIndexed : LEFT_PAREN HEX_LITERAL RIGHT_PAREN COMMA Y;
label           : IDENTIFIER ;
labelX          : IDENTIFIER COMMA X ;
labelY          : IDENTIFIER COMMA Y ;
labelIndirect   : LEFT_PAREN IDENTIFIER RIGHT_PAREN ;
labelIndexed    : LEFT_PAREN IDENTIFIER RIGHT_PAREN COMMA Y;


BLOCK_COMMENT   : '/*' .*? '*/' -> channel(HIDDEN);
LINE_COMMENT    : '//' ~[\r\n]* -> channel(HIDDEN);

OPCODE          :
                ( 'adc' | 'and' | 'asl' | 'bcc' | 'bcs' | 'beq' | 'bit' | 'bmi'
                | 'bne' | 'bpl' | 'brk' | 'bvc' | 'bvs' | 'clc' | 'cld' | 'cli'
                | 'clv' | 'cmp' | 'cpx' | 'cpy' | 'dec' | 'dex' | 'dey' | 'eor'
                | 'inc' | 'inx' | 'iny' | 'jmp' | 'jsr' | 'lda' | 'ldx' | 'ldy'
                | 'lsr' | 'nop' | 'ora' | 'pha' | 'php' | 'pla' | 'plp' | 'rol'
                | 'ror' | 'rti' | 'rts' | 'sbc' | 'sec' | 'sed' | 'sei' | 'sta'
                | 'stx' | 'sty' | 'tax' | 'tay' | 'tsx' | 'txa' | 'txs' | 'tya'
                );

COLON           : ':' ;
HASH            : '#' ;
COMMA           : ',' ;
X               : 'x' ;
Y               : 'y' ;
LEFT_PAREN      : '(' ;
RIGHT_PAREN     : ')' ;
SEMI            : ';' ;
EOL             : '\r\n' | '\n' ;
WS              : [ \t]+  -> channel(HIDDEN) ;

IDENTIFIER      : [a-z_] [a-z0-9_]*;

HEX_LITERAL: '$' HEX_DIGIT HEX_DIGIT;
HEX_LONG_LITERAL: '$' HEX_DIGIT HEX_DIGIT HEX_DIGIT HEX_DIGIT;
HEX_DIGIT       : [0-9a-f] ;
BINARY_LITERAL  : '%' [01]+ ;
DECIMAL_LITERAL : [0-9]+ ;
