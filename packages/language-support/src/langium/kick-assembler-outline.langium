grammar KickAssemblerOutline

entry OutlineFile:
    statements+=Statement*;

Statement:
    ImportStatement
  | SegmentDefinition
  | SegmentStatement
  | ProgramCounterStatement
  | NamespaceBlock
  | MacroBlock
  | FunctionBlock
  | StructBlock
  | EnumBlock
  | PseudocommandBlock
  | SymbolDirectiveStatement
  | LabelStatement
  | GenericBlock
  | OtherLine
  | BlankLine
;

ImportStatement:
    directive=ImportDirective parts+=LinePart+ LineEnd
;

SegmentDefinition:
    '.segmentdef' name=NAME parts+=LinePart* LineEnd
;

SegmentStatement:
    '.segment' (name=NAME | name=STRING) parts+=LinePart* LineEnd
;

ProgramCounterStatement:
    '.pc' parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

NamespaceBlock:
    '.namespace' name=NAME parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

MacroBlock:
    '.macro' name=NAME parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

FunctionBlock:
    '.function' name=NAME parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

StructBlock:
    '.struct' name=NAME parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

EnumBlock:
    '.enum' name=NAME parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

PseudocommandBlock:
    '.pseudocommand' name=NAME parts+=LinePart* (block=BraceBlock LineEnd? | LineEnd)
;

SymbolDirectiveStatement:
    directive=SymbolDirective name=NAME parts+=LinePart* LineEnd
;

LabelStatement:
    localName=LOCAL_NAME ':' parts+=LinePart* LineEnd
  | bangOnly?='!' ':' parts+=LinePart* LineEnd
  | name=NAME ':' parts+=LinePart* LineEnd
;

GenericBlock:
    parts+=LinePart+ block=BraceBlock LineEnd?
;

OtherLine:
    parts+=LinePart+ LineEnd
;

BlankLine returns string:
    LineEnd
;

BraceBlock:
    '{' statements+=Statement* '}'
;

ImportDirective returns string:
    '#import'
  | '#importif'
  | '#importonce'
;

SymbolDirective returns string:
    '.const'
  | '.var'
  | '.label'
;

LinePart returns string:
    STRING
  | NAME
  | LOCAL_NAME
  | LINE_FRAGMENT
;

LineEnd returns string:
    NL
;

terminal NAME: /[@A-Za-z_][@A-Za-z0-9_.]*/;
terminal LOCAL_NAME: /![A-Za-z_@][A-Za-z0-9_.@]*/;
terminal STRING: /"([^"\\]|\\.)*"/;
terminal NL: /\r?\n/;

hidden terminal WS: /[ \t\f]+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\r\n]*/;
terminal LINE_FRAGMENT: /[^\s\r\n{}:]+/;
