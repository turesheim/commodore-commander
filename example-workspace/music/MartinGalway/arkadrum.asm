
//Mart's super "drum-kit" program 14:56 Thursday 5th February 1987...

.label NMI = $0107
.label N50 = 4927
.label N54 = 6207
.label N57 = 7382
.label BDR = $D020
.label StacksDepth = 8


.label EFFECTS = $2000 //  sound object code goes from $2000 to $3FFF inclusive.
.label JUMPS = $3F00
.label INITSOUND = JUMPS+3*0
.label MUSICTEST = JUMPS+3*1
.label TUNE = JUMPS+3*2
.label EFFECT = JUMPS+3*3
.label FILTER = JUMPS+3*4
.label SOUND0 = JUMPS+3*5
.label SOUND1 = JUMPS+3*6
.label SOUND2 = JUMPS+3*7
.label MUSIC0 = JUMPS+3*8
.label MUSIC1 = JUMPS+3*9
.label MUSIC2 = JUMPS+3*10
.label RefScreen1 = JUMPS+3*11
.label RefScreen2 = JUMPS+3*12
.label RefScreen3 = JUMPS+3*13
.label RefScreen4 = JUMPS+3*14
X:

.label D418 = $3FFF

.label bass = $81
.label snare = $82
.label tomhi = $83
.label tomme = $84
.label tomlo = $85
.label hihat = $86
.label Drest = $87

.label ZERO = $0050
.label seqPC = ZERO+0 //2
.label seqCLK = ZERO+2 //1
.label seqSP = ZERO+3 //1
.label synwksp = ZERO+4 //1

//================================ DRIVER ======================================

* = $4000

Start:
    jsr INITRASTERS
jsr INITSOUND

//              JSR INITSID
//              LDX #eNTERDATA:LDY ^eNTERDATA:LDA #1:JSR RIFF
//              LDY #6*7-2:JSR TUNE
ldx #<(TITLEDATA)
ldy #>TITLEDATA
lda #<(2)
jsr RIFF
ldy #<(9*7-2)
jsr TUNE

MAIN:
    jsr RefScreen1
jsr PLEY
jsr RefScreen2
jsr PLEY
jsr RefScreen3
jsr PLEY
jsr RefScreen4
jsr PLEY
jmp MAIN

//HANG          SEI:INC BDR:JMP HANG

INITRASTERS:
    sei
lda #<($35)
sta $01
lda #<(20)
sta $D012
lda #<($FF)
sta $D019
lda #<($F1)
sta $D01A
ldx #<(%01111111)
sta $DC0D
lda $DC0D
lda #<(0)
sta $DC0E
ldx #<(IRQ)
ldy #>IRQ
stx $FFFE
sty $FFFF
ldx #<(NMI)
ldy #>NMI
stx $FFFA
sty $FFFB
cli
rts

//INITSID       LDX #N50:LDY ^N50:STX $D400:STY $D401
//              LDX #N54:LDY ^N54:STX $D407:STY $D408
//              LDX #N57:LDY ^N57:STX $D40E:STY $D40F
//              LDA #$08:STA $D403:STA $D403+7:STA $D403+14
//              LDA #65:STA $D404:STA $D404+7:STA $D404+14
//              LDA #$FA:STA $D405:STA $D405+7:STA $D405+14
//              LDA #$80:STA $D406:STA $D406+7:STA $D406+14
//              LDA #15:STA $D418
//              RTS

//=== INTERRUPT ROUTINE ===

IRQ:
    pha
lda $D019
sta $D019
lda #<(20)
sta $D012
cld
tya
pha
txa
pha
lda #<(0)
sta BDR
jsr DRUMS
lda #<(1)
sta BDR
jsr MUSIC0
jsr MUSIC1
jsr MUSIC2
jsr SOUND0
jsr SOUND1
jsr SOUND2
jsr FILTER
lda #<(12)
sta BDR
pla
tax
pla
tay
pla
rti

//============================= ACTUAL CODE ====================================

* = $5000

PLEY:
    lda DRUMFLAG
beq exit
lda #<(0)
sta DRUMFLAG
DRMvc:
    jsr $DDDD
lda #<(15)
ora D418
sta $D418
rts

RIFF:
    sta seqCLK
stx seqPC
sty seqPC+1
lda #<(StacksDepth-1)
sta seqSP
rts

DRUMS:
    dec seqCLK
bne exit
repeat:
    ldy #<(0)
lda (seqPC),Y
bmi drum
ldx #<(255)
control:
    inx
cmp DRUMCONTROLS,X
bne control
lda CNTRLVCSl,X
sta cntrlvc+1
lda CNTRLVCSh,X
sta cntrlvc+2
lda #<(0)
sta synwksp
cntrlvc:
    jsr $DDDD
jmp repeat
drum:
    sta DRUMFLAG
tax
iny
lda (seqPC),Y
sta seqCLK
lda seqPC
clc
adc #<(2)
sta seqPC
lda seqPC+1
adc #<(0)
sta seqPC+1
lda VCTRSlow-$81,X
sta DRMvc+1
lda VCTRShigh-$81,X
sta DRMvc+2
exit:
    rts

STK:
    ldx seqSP
clc
adc seqPC
sta STKLOW,X
lda seqPC+1
adc #<(0)
sta STKHIGH,X
dex
stx seqSP
rts

DESTK:
    inc seqSP
ldx seqSP
DESTKa:
    lda STKLOW,X
sta seqPC
lda STKHIGH,X
sta seqPC+1
rts

DRUMJSR:
    lda #<(3)
jsr STK
DRUMJMP:
    iny
lda (seqPC),Y
tax
iny
lda (seqPC),Y
stx seqPC
sta seqPC+1
rts

DRUMFoR:
    lda #<(2)
jsr STK
pha
iny
lda (seqPC),Y
sta STKCNT+1,X
pla
sta seqPC+1
lda STKLOW+1,X
sta seqPC
rts

DRUMNEXT:
    inc seqSP
ldx seqSP
dec STKCNT,X
beq EOL
jsr DESTKa
dec seqSP
rts
EOL:
    stx seqSP
inc seqPC
bne exit
inc seqPC+1
rts

HIHAT:
    ldy #<(5)
H1:
    ldx #<(25)
H2:
    lda HIHATTABLE,Y
sec
H3:
    sbc #<(1)
bne H3
lda synwksp
clc
adc #<(152)
sta synwksp
and #<(15)
sta $D418
dex
bne H2
dey
bpl H1
rts

TOMhig:
    ldy #<(5)
X1:
    ldx #<(25)
X2:
    lda TOMhiTABLE,Y
X3:
    sec
    sbc #<(1)
bne X3
lda synwksp
clc
adc #<(101)
sta synwksp
and #<(15)
sta $D418
dex
bne X2
dey
bpl X1
rts

TOMlow:
    ldy #<(5)
Y1:
    ldx #<(25)
Y2:
    lda TOMmeTABLE,Y
Y3:
    sec
    sbc #<(1)
bne Y3
lda synwksp
clc
adc #<($DD)
sta synwksp
and #<(15)
sta $D418
dex
bne Y2
dey
bpl Y1
rts

TOMmed:
    ldy #<(5)
Z1:
    ldx #<(25)
Z2:
    lda TOMloTABLE,Y
Z3:
    sec
    sbc #<(1)
bne Z3
lda synwksp
clc
adc #<($DD)
sta synwksp
and #<(15)
sta $D418
dex
bne Z2
dey
bpl Z1
rts

SNARE:
    ldy #<(15)
N1:
    ldx #<(12)
N2:
    lda SNARETABLE,Y
N3:
    sec
    sbc #<(1)
bne N3
lda synwksp
clc
adc #<(14)
sta synwksp
and #<(15)
sta $D418
dex
bne N2
dey
bpl N1
rts

BASS:
    ldy #<(5)
B1:
    ldx #<(25)
B2:
    lda BASSTABLE,Y
B3:
    sec
    sbc #<(1)
bne B3
lda synwksp
clc
adc #<(1)
sta synwksp
and #<(15)
sta $D418
dex
bne B2
dey
bpl B1
DREST:
    rts

TOMhiTABLE:
    .byte <(32), <(16), <(8), <(4), <(2), <(1)
TOMmeTABLE:
    .byte <(35), <(20), <(12), <(9), <(6), <(3)
TOMloTABLE:
    .byte <(5), <(30), <(25), <(20), <(15), <(10)
BASSTABLE:
    .byte <(64), <(24), <(62), <(22), <(60), <(20)
SNARETABLE:
    .byte <(32), <(16), <(8), <(4), <(2), <(1), <(60), <(10), <(40), <(10), <(20), <(10), <($20), <($40), <($60), <($49)
HIHATTABLE:
    .byte <(60), <(10), <(40), <(10), <(20), <(10)
DRUMCONTROLS:
    .byte <($20), <($40), <($60), <($49), <($4C) //JSR, RTI, RTS, EOR & JMP!
CNTRLVCSl:
    .byte <(DRUMJSR), <(DRUMNEXT), <(DESTK), <(DRUMFoR), <(DRUMJMP)
CNTRLVCSh:
    .byte >(DRUMJSR), >(DRUMNEXT), >(DESTK), >(DRUMFoR), >(DRUMJMP)
VCTRSlow:
    .byte <(BASS), <(SNARE), <(TOMhig), <(TOMmed), <(TOMlow), <(HIHAT), <(DREST)
VCTRShigh:
    .byte >(BASS), >(SNARE), >(TOMhig), >(TOMmed), >(TOMlow), >(HIHAT), >(DREST)

BSS:

DRUMFLAG:
    .byte <(0)
STKLOW:
    .fill StacksDepth, 0
STKHIGH:
    .fill StacksDepth, 0
STKCNT:
    .fill StacksDepth, 0

SD: //================= TITLE SCREEN SEQUENCE DATA ===============================

.label D = 4

DS0:
    eor #<(8)
.byte <(tomhi), <(1), <(tomhi), <(3)
rti
eor #<(8)
.byte <(tomlo), <(1), <(tomlo), <(3)
rti
jsr DHH4
jsr DHH4
jsr DHH2
jsr DHH2
DHH4:
    .byte <(hihat), <(2), <(hihat), <(4*D-2)
rts
DS1:
    .byte <(bass), <(2*D)
jsr DHH2
.byte <(bass), <(2*D)
jsr DHH2
jsr DSN2
jsr DHH2
jsr DHH2
.byte <(bass), <(2*D)
jsr DHH2
.byte <(bass), <(2*D), <(bass), <(2*D)
jsr DHH2
DSN2:
    .byte <(snare), <(1), <(snare), <(1), <(snare), <(2*D-2)
rts
DS2:
    jsr DHH2
.byte <(bass), <(2*D)
DHH2:
    .byte <(hihat), <(2), <(hihat), <(2*D-2)
rts
DS3:
    .byte <(bass), <(2*D)
jsr DHH2
.byte <(bass), <(2*D)
rts
DS9:
    jsr DS8
jmp DS4
DS4:
    .byte <(bass), <(2*D), <(tomme), <(2), <(tomme), <(2*D-2), <(tomme), <(2), <(tomme), <(2*D-2)
rts
DS8:
    jsr DS1
jsr DS2
jsr DS1
jsr DS3
jsr DS1
jsr DS2
jmp DS1
DS10:
    .byte <(bass), <(2*D)
jsr DHH2
.byte <(tomhi), <(2), <(tomhi), <(2*D-2)
jsr DHH2
jsr DSN2
jsr DHH2
.byte <(tomhi), <(2), <(tomhi), <(2*D-2)
jmp DHH2
DS11:
    .byte <(tomme), <(2), <(tomme), <(2*D-2)
jsr DHH2
.byte <(tomhi), <(2), <(tomhi), <(2*D-2)
jsr DHH2
jsr DSN2
jsr DHH2
.byte <(tomhi), <(2), <(tomhi), <(2*D-2)
jmp DHH2

TITLEDATA:
    jsr DS0
jsr DS9
jsr DS9
jsr DS0
eor #<(2)
jsr DS9
jsr DS8
eor #<(3)
.byte <(snare), <(1), <(snare), <(1), <(snare), <(6)
rti
rti
.byte <(bass), <(32*4)
eor #<(7)
.byte <(Drest), <(32*4)
rti
jsr DS1
jsr DS2
jsr DS1
jsr DS3
jsr DS1
jsr DS2
.byte <(bass), <(2*D)
jsr DHH2
.byte <(bass), <(2*D)
eor #<(4)
.byte <(bass), <(2*D)
jsr DHH2
rti
.byte <(bass), <(2*D), <(bass), <(8*D)
jsr DS9
jsr DS9
eor #<(3)
jsr DS10
rti
.byte <(bass), <(2*D)
jsr DHH2
.byte <(tomme), <(2), <(tomme), <(2*D-2)
jsr DHH2
jsr DSN2
.byte <(bass), <(2*D)
.byte <(tomme), <(2), <(tomme), <(2*D-2)
.byte <(bass), <(2*D)
eor #<(3)
jsr DS10
rti
.byte <(bass), <(2*D)
jsr DHH2
.byte <(tomme), <(2), <(tomme), <(2*D-2), <(tomlo), <(D), <(tomlo), <(D)
jsr DSN2
.byte <(tomlo), <(2), <(tomlo), <(2*D-2), <(bass), <(D*2)
eor #<(4)
.byte <(hihat), <(2)
rti
eor #<(3)
jsr DS11
rti
.byte <(tomme), <(2), <(tomme), <(2*D-2)
jsr DHH2
.byte <(tomme), <(2), <(tomme), <(2*D-2)
jsr DHH2
jsr DSN2
eor #<(3)
.byte <(tomme), <(2), <(tomme), <(2*D-2)
rti
eor #<(3)
jsr DS11
rti
.byte <(tomme), <(2), <(tomme), <(2*D-2)
jsr DHH2
.byte <(tomme), <(2), <(tomme), <(2*D-2), <(tomlo), <(D), <(tomlo), <(D)
jsr DSN2
.byte <(tomlo), <(2), <(tomlo), <(2*D-2), <(tomme), <(2), <(tomme), <(2*D-2)
eor #<(4)
.byte <(hihat), <(2)
rti
eor #<(2)
.byte <(tomme), <(2), <(tomme), <(4*D-2)
jsr DHH2
jsr DHH2
jsr DSN2
.byte <(Drest), <(D*2)
jsr DHH2
jsr DHH2
rti
.byte <(tomme), <(2), <(tomme), <(4*D-2)
jsr DHH2
jsr DHH2
jsr DSN2
.byte <(bass), <(2*D)
jsr DHH2
jsr DHH2
.byte <(bass), <(32*D)
jmp TITLEDATA

//==================== "ENTER NAME" SCREEN SEQUENCE DATA =======================

.label C = 3
ES0:
    .byte <(tomme), <(C*4), <(hihat), <(C*2), <(hihat), <(C*2)
.byte <(snare), <(C*4), <(hihat), <(C*2), <(hihat), <(C*2)
.byte <(tomme), <(C*2), <(tomme), <(C*2), <(hihat), <(C*2), <(hihat), <(C*2)
.byte <(snare), <(C*4), <(hihat), <(C*2), <(hihat), <(C*2)
.byte <(tomme), <(C*4), <(hihat), <(C*2), <(hihat), <(C*2)
.byte <(snare), <(C*4), <(hihat), <(C*2), <(hihat), <(C*2)
.byte <(tomme), <(C*2), <(tomme), <(C*2), <(hihat), <(C*2), <(hihat), <(C*2)
rts

eNTERDATA:
    .byte <(Drest), <(1)
eLOOP:
    eor #<(7)
.byte <(tomlo), <(C*8)
rti
.byte <(tomlo), <(C*4), <(tomlo), <(C*2), <(tomlo), <(C*2)
eor #<(6)
.byte <(tomlo), <(2), <(tomlo), <(C*8-2)
rti
.byte <(snare), <(2), <(snare), <(C*8-2)
eor #<(2)
.byte <(tomhi), <(2), <(tomhi), <(C*2-2)
rti
eor #<(2)
.byte <(tomme), <(2), <(tomme), <(C*2-2)
rti
eor #<(4)
eor #<(3)
jsr ES0
.byte <(snare), <(C*2), <(tomhi), <(C*2), <(hihat), <(C*2), <(hihat), <(C*2)
rti
jsr ES0
.byte <(snare), <(C*2), <(tomhi), <(C*2), <(snare), <(C*2), <(snare), <(C*2)
rti
jmp eLOOP

//==============================================================================

.label DATASIZE = *-SD
.label SIZE = *-Start

//^^^^^^^^^^^^^^^ This is the end of the source file... (or is it?) ^^^^^^^^^^^^