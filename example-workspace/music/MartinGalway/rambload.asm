
//R.A.M.B.O.-First Blood Part II
//
//This.is.only the Loading Music!!
//
//Composed, Arranged & Programmed
//by.Martin Galway,12th November
//
//(C).Ocean Software 1985
//
//================================
//CAREFUL- LIMITED  SSI VERSION!!!
//================================
//
.label endS = *
.label MOBJlengt = DE-MUS
.label endO = DE
//
.label Ret = $C0
.label Volume = $C2
.label WrDat = $C4
.label Freq = $C6
.label Pulse = $C8
.label Call = $CA
.label Transp = $CC
.label CT = $CE
//
.label DPoke = $D0
.label JT = $D2
.label Code = $D4
.label SPoke = $D6
.label Chord = $D8
.label loop = $DA
.label Next = $DC
.label Rest = 95
.label Sil = 94
//
.label Z0 = $10 //ZERO-PAGE
.label Z1 = Z0+1 //WORKSPACE
.label Z2 = Z0+2 //STARTS AT $10
.label Z3 = Z0+3 //(FOR 16 BYTES)
.label Z4 = Z0+4
.label Z5 = Z0+5
.label Z6 = Z0+6
.label Z7 = Z0+7
.label Z8 = Z0+8
.label Z9 = Z0+9
.label ZA = Z0+10
.label ZB = Z0+11
.label ZC = Z0+12
.label ZD = Z0+13
.label ZE = Z0+14
.label ZF = Z0+15
//
//=========Driver Code...=========
//

* = $1000

START:
sei
ldx #<(15) //*
stx $D418
//
//this.delay simulates BILLOADER
//loading.in the music program
//
ldy #<(0)
d:
    dex
bne d
d2:
    dex
bne d2
dey
bne d
//
//main.loop
//
jsr MUS+3 //*
L:
    lda $D012
cmp #<(99)
bne L
inc $D020
jsr MUS+0 //*
lda #<(0)
sta $D020
jsr MUS+6 //*
bne L
//
//finished
//
inc $D020
jmp *-3
//
//================================
//=========Actual Code...=========
//
MUS:
    jmp REFRESH
jmp STOPSTART
jmp MUSICTEST
//
trnsfrpl0:
    ldx SB0+22
ldy SB0+23
stx SB0+35
sty SB0+36
lda SB0+14
sta SB0+37
lda SB0+15
sta SB0+38
rts
//
trnsfrpl1:
    ldx SB1+22
ldy SB1+23
stx SB1+35
sty SB1+36
lda SB1+14
sta SB1+37
lda SB1+15
sta SB1+38
rts
//
trnsfrpl2:
    ldx SB2+22
ldy SB2+23
stx SB2+35
sty SB2+36
lda SB2+14
sta SB2+37
lda SB2+15
sta SB2+38
rts
//
trnsferf0:
    lda SB0+11
sta SB0+34
lda SB0+10
sta SB0+33
lda SB0+9
sta SB0+32
lda SB0+8
sta SB0+31
rts
//
trnsferf1:
    lda SB1+11
sta SB1+34
lda SB1+10
sta SB1+33
lda SB1+9
sta SB1+32
lda SB1+8
sta SB1+31
rts
//
trnsferf2:
    lda SB2+11
sta SB2+34
lda SB2+10
sta SB2+33
lda SB2+9
sta SB2+32
lda SB2+8
sta SB2+31
rts
//
MUSIC0:
    lda Z9
lsr
bcc jsound0
dec ZA
beq read0
jsound0:
    jmp SOUND0
ad3c0:
    lda #<(3)
adc0:
    clc
adc Z0
sta Z0
bcc read0
inc Z1
read0:
    ldy #<(0)
lda (Z0),Y
cmp #<(192)
bcc notctrl0
and #<(63)
tax
lda vt0,X
sta v0+1
lda vt0+1,X
sta v0+2
iny
lda (Z0),Y
tax
sta Z6
iny
lda (Z0),Y
sta Z7
v0:
    jmp $FFFF
js0:
    jmp st0
notctrl0:
    sta Z8
cmp #<(96)
bcc idr0
sbc #<(96)
idr0:
    cmp #<(Rest)
beq js0
adc DB0+73
gotnote0:
    tax
NOTE0:
    ldy #<(4)
n0sl2:
    lda #<(0)
sta $D402,Y
lda DB0+22,Y
sta $D402,Y
dey
bpl n0sl2
lda DB0+24
sta SB0+26
dln0:
    ldy HIFRQ,X
lda LOFRQ,X
sta SB0+29
sty SB0+30
sta $D400
sty $D401
dlp0:
    lda DB0+17
sta SB0+17
beq dlf0
ldy #<(9)
dlpl0:
    lda DB0+14,Y
sta SB0+14,Y
dey
bpl dlpl0
jsr trnsfrpl0
dlf0:
    ldx DB0+13
stx SB0+13
beq dld0
ldy #<(13)
dlfl0:
    lda DB0,Y
sta SB0,Y
dey
bpl dlfl0
txa
and #<(8)
beq nolm0
lda Z8
clc
adc DB0+73
sta SB0+10
sty SB0+12
nolm0:
    jsr trnsferf0
dld0:
    ldx DB0+27
ldy DB0+28
stx SB0+27
sty SB0+28
st0:
    ldy #<(1)
lda (Z0),Y
ldx Z8
cpx #<(96)
bcs ddr0
tax
lda DB0+32,X
ddr0:
    sta ZA
lda #<(2)
adn0:
    clc
adc Z0
sta Z0
bcc dia0
inc Z1
dia0:
    jmp SOUND0
//
.label MC0 = *
retrut0:
    inc ZD
ldy ZD
cpy #<(8)
beq rc0
r0a:
    ldx DB0+49,Y
lda DB0+57,Y
jmp goto0
rc0:
    lda Z9
and #<(%11111110)
sta Z9
rts
//
for0:
    ldx ZD
clc
tya
adc Z0
sta DB0+49,X
lda #<(0)
adc Z1
sta DB0+57,X
lda Z6
sta DB0+65,X
dec ZD
tya
jmp adc0
//
next0:
    ldx ZD
dec DB0+66,X
beq n0a
inx
txa
tay
bpl r0a
n0a:
    inc ZD
lda #<(1)
jmp adc0
//
wrvol0:
    ldy #<(4)
ldx #<(28)
tr0:
    lda (Z6),Y
sta DB0,X
dex
dey
bpl tr0
jmp ad3c0
freq0:
    ldy #<(13)
ldx #<(13)
bne tr0
pulse0:
    ldy #<(09)
ldx #<(23)
bne tr0
wrall0:
    ldy #<(48)
ldx #<(48)
bne tr0
chord0:
    ldy #<(09)
ldx #<(09)
bne tr0
//
goto0l:
    lda Z7
goto0:
    stx Z0
sta Z1
jmp read0
//
code0:
    lda #>ad3c0-1
pha
lda #<(ad3c0-1)
pha
jmp (Z6)
//
call0:
    lda #<(3)
c0a:
    ldy ZD
clc
adc Z0
sta DB0+49,Y
lda #<(0)
adc Z1
sta DB0+57,Y
dec ZD
jmp goto0l
//
callt0:
    iny
lda (Z0),Y
sta DB0+73
lda #<(4)
bne c0a
//
transp0:
    stx DB0+73
tya
jmp adc0
//
pokedb0:
    sta DB0,X
jmp ad3c0
//
pokesb0:
    sta SB0,X
jmp ad3c0
//
nosound0:
    rts
SOUND0:
    ldx SB0+28
beq nosound0
//
VC0:
    lda SB0+26
and #<(8)
beq adsr0
lda ZA
cmp SB0+27
bcs PL0
lda #<(00)
sta SB0+27
lda SB0+26
and #<(246)
sta SB0+26
bne trigrel0
adsr0:
    lda SB0+27
bne ad0
dec SB0+28
bne PL0
ldx #<(6)
cc0:
    sta $D400,X
dex
bpl cc0
rts
ad0:
    dec SB0+27
bne PL0
lda SB0+26
and #<(246)
trigrel0:
    sta $D404
//
PL0:
    lda SB0+17
beq FC0
lda SB0+16
beq plcdel0
dec SB0+16
jmp FC0
plcdel0:
    clc
ldx SB0+35
ldy SB0+36
plcs00:
    lda SB0+37
beq plcs10
txa
adc SB0+18
tax
tya
adc SB0+19
tay
dec SB0+37
jmp stpl0
plcs10:
    lda SB0+38
beq plcrep0
txa
adc SB0+20
tax
tya
adc SB0+21
tay
dec SB0+38
jmp stpl0
plcrep0:
    lda SB0+17
and #<($81)
beq stpl0
bpl nplcopy0
jsr trnsfrpl0
jmp plcdel0
nplcopy0:
    jsr trnsfrpl0+12
jmp plcdel0
stpl0:
    stx SB0+35
sty SB0+36
stx $D402
sty $D403
//
FC0:
    lda SB0+13
beq exit0
and #<(8)
bne olm0
ldx SB0+29
ldy SB0+30
clc
lda SB0+12
beq fcs10+1
dec SB0+12
lda SB0+13
and #<(2)
bne fcs40l1
exit0:
    rts
olm0:
    ldx SB0+12
bpl no0
ldx SB0+11
no0:
    lda SB0+10
clc
adc SB0,X
dex
stx SB0+12
tay
ldx LOFRQ,Y
lda HIFRQ,Y
jmp stf0TAY
fcs10:
    clc
lda SB0+31
beq fcs20
dec SB0+31
txa
adc SB0+0
tax
tya
adc SB0+1
jmp stf0TAY
fcs20:
    lda SB0+32
beq fcs30
dec SB0+32
txa
adc SB0+2
tax
tya
adc SB0+3
jmp stf0TAY
fcs30:
    lda SB0+33
beq fcs40
dec SB0+33
txa
adc SB0+4
tax
tya
adc SB0+5
jmp stf0TAY
fcs40:
    lda SB0+34
beq fcrep0
dec SB0+34
fcs40l1:
    txa
adc SB0+6
tax
tya
adc SB0+7
stf0TAY:
    tay
stf0:
    stx $D400
sty $D401
stx SB0+29
sty SB0+30
rts
fcrep0:
    jsr trnsferf0
jmp fcs10
//
//
MUSIC1:
    lda Z9
and #<(2)
beq jsound1
dec ZB
beq read1
jsound1:
    jmp SOUND1
ad3c1:
    lda #<(3)
adc1:
    clc
adc Z2
sta Z2
bcc read1
inc Z3
read1:
    ldy #<(0)
lda (Z2),Y
cmp #<(192)
bcc notctrl1
and #<(63)
tax
lda vt1,X
sta v1+1
lda vt1+1,X
sta v1+2
iny
lda (Z2),Y
tax
sta Z6
iny
lda (Z2),Y
sta Z7
v1:
    jmp $FFFF
js1:
    jmp st1
notctrl1:
    sta Z8
cmp #<(96)
bcc idr1
sbc #<(96)
idr1:
    cmp #<(Rest)
beq js1
adc DB1+73
gotnote1:
    tax
NOTE1:
    ldy #<(4)
n1sl2:
    lda #<(0)
sta $D409,Y
lda DB1+22,Y
sta $D409,Y
dey
bpl n1sl2
lda DB1+24
sta SB1+26
dln1:
    ldy HIFRQ,X
lda LOFRQ,X
sta SB1+29
sty SB1+30
sta $D407
sty $D408
dlp1:
    lda DB1+17
sta SB1+17
beq dlf1
ldy #<(9)
dlpl1:
    lda DB1+14,Y
sta SB1+14,Y
dey
bpl dlpl1
jsr trnsfrpl1
dlf1:
    ldx DB1+13
stx SB1+13
beq dld1
ldy #<(13)
dlfl1:
    lda DB1,Y
sta SB1,Y
dey
bpl dlfl1
jsr trnsferf1
dld1:
    ldx DB1+27
ldy DB1+28
stx SB1+27
sty SB1+28
st1:
    ldy #<(1)
lda (Z2),Y
ldx Z8
cpx #<(96)
bcs ddr1
tax
lda DB1+32,X
ddr1:
    sta ZB
lda #<(2)
adn1:
    clc
adc Z2
sta Z2
bcc dia1
inc Z3
dia1:
    jmp SOUND1
//
.label MC1 = *
retrut1:
    inc ZE
ldy ZE
cpy #<(8)
beq rc1
r1a:
    ldx DB1+49,Y
lda DB1+57,Y
jmp goto1
rc1:
    lda Z9
and #<(%11111101)
sta Z9
rts
//
for1:
    ldx ZE
clc
tya
adc Z2
sta DB1+49,X
lda Z3
adc #<(0)
sta DB1+57,X
lda Z6
sta DB1+65,X
dec ZE
tya
jmp adc1
//
next1:
    ldx ZE
dec DB1+66,X
beq n1a
inx
txa
tay
bpl r1a
n1a:
    inc ZE
lda #<(1)
jmp adc1
//
wrvol1:
    ldy #<(4)
ldx #<(28)
tr1:
    lda (Z6),Y
sta DB1,X
dex
dey
bpl tr1
jmp ad3c1
freq1:
    ldy #<(13)
ldx #<(13)
bne tr1
pulse1:
    ldy #<(09)
ldx #<(23)
bne tr1
wrdat1:
    ldy #<(28)
ldx #<(28)
bne tr1
//
goto1l:
    lda Z7
goto1:
    stx Z2
sta Z3
jmp read1
//
call1:
    lda #<(3)
c1a:
    ldy ZE
clc
adc Z2
sta DB1+49,Y
lda Z3
adc #<(0)
sta DB1+57,Y
dec ZE
jmp goto1l
//
callt1:
    iny
lda (Z2),Y
sta DB1+73
lda #<(4)
bne c1a
//
pokedb1:
    sta DB1,X
jmp ad3c1
//
pokesb1:
    sta SB1,X
jmp ad3c1
//
nosound1:
    rts
SOUND1:
    ldx SB1+28
beq nosound1
//
VC1:
    lda SB1+26
and #<(8)
beq adsr1
lda ZB
cmp SB1+27
bcs PL1
lda #<(00)
sta SB1+27
lda SB1+26
and #<(246)
sta SB1+26
bne trigrel1
adsr1:
    lda SB1+27
bne ad1
dec SB1+28
bne PL1
ldx #<(6)
cc1:
    sta $D407,X
dex
bpl cc1
rts
ad1:
    dec SB1+27
bne PL1
lda SB1+26
and #<(246)
trigrel1:
    sta $D40B
//
PL1:
    lda SB1+17
beq FC1
lda SB1+16
beq plcdel1
dec SB1+16
jmp FC1
plcdel1:
    clc
ldx SB1+35
ldy SB1+36
plcs01:
    lda SB1+37
beq plcs11
txa
adc SB1+18
tax
tya
adc SB1+19
tay
dec SB1+37
jmp stpl1
plcs11:
    lda SB1+38
beq plcrep1
txa
adc SB1+20
tax
tya
adc SB1+21
tay
dec SB1+38
jmp stpl1
plcrep1:
    lda SB1+17
and #<($81)
beq stpl1
bpl nplcopy1
jsr trnsfrpl1
jmp plcdel1
nplcopy1:
    jsr trnsfrpl1+12
jmp plcdel1
stpl1:
    stx SB1+35
sty SB1+36
stx $D409
sty $D40A
//
FC1:
    lda SB1+13
beq exit1
ldx SB1+29
ldy SB1+30
clc
lda SB1+12
beq fcs11+1
dec SB1+12
lda SB1+13
and #<(2)
bne fcs41l1
exit1:
    rts
fcs11:
    clc
lda SB1+31
beq fcs21
dec SB1+31
txa
adc SB1+0
tax
tya
adc SB1+1
jmp stf1TAY
fcs21:
    lda SB1+32
beq fcs31
dec SB1+32
txa
adc SB1+2
tax
tya
adc SB1+3
jmp stf1TAY
fcs31:
    lda SB1+33
beq fcrep1
dec SB1+33
txa
adc SB1+4
tax
tya
adc SB1+5
jmp stf1TAY
fcs41l1:
    txa
adc SB1+6
tax
tya
adc SB1+7
stf1TAY:
    tay
stf1:
    stx $D407
sty $D408
stx SB1+29
sty SB1+30
rx:
    rts
fcrep1:
    jsr trnsferf1
jmp fcs11
//
MUSICTEST:
    lda Z9
ora SB0+28
ora SB1+28
ora SB2+28
rts
//
REFRESH:
    jsr MUSIC0
jsr MUSIC1
jmp MUSIC2
//
MUSIC2:
    lda Z9
and #<(4)
beq jsound2
dec ZC
beq read2
jsound2:
    jmp SOUND2
ad3c2:
    lda #<(3)
adc2:
    clc
adc Z4
sta Z4
bcc read2
inc Z5
read2:
    ldy #<(0)
lda (Z4),Y
cmp #<(192)
bcc notctrl2
and #<(63)
tax
lda vt2,X
sta v2+1
lda vt2+1,X
sta v2+2
iny
lda (Z4),Y
tax
sta Z6
iny
lda (Z4),Y
sta Z7
v2:
    jmp $FFFF
js2:
    jmp st2
notctrl2:
    sta Z8
cmp #<(96)
bcc idr2
sbc #<(96)
idr2:
    cmp #<(Rest)
beq js2
adc DB2+73
gotnote2:
    tax
NOTE2:
    ldy #<(4)
n2sl2:
    lda #<(0)
sta $D410,Y
lda DB2+22,Y
sta $D410,Y
dey
bpl n2sl2
lda DB2+24
sta SB2+26
dln2:
    ldy HIFRQ,X
lda LOFRQ,X
sta SB2+29
sty SB2+30
sta $D40E
sty $D40F
dlp2:
    lda DB2+17
sta SB2+17
beq dlf2
ldy #<(9)
dlpl2:
    lda DB2+14,Y
sta SB2+14,Y
dey
bpl dlpl2
jsr trnsfrpl2
dlf2:
    ldx DB2+13
stx SB2+13
beq dld2
ldy #<(13)
dlfl2:
    lda DB2,Y
sta SB2,Y
dey
bpl dlfl2
txa
and #<(8)
beq nolm2
lda Z8
clc
adc DB2+73
sta SB2+10
sty SB2+12
nolm2:
    jsr trnsferf2
dld2:
    ldx DB2+27
ldy DB2+28
stx SB2+27
sty SB2+28
st2:
    ldy #<(1)
lda (Z4),Y
ldx Z8
cpx #<(96)
bcs ddr2
tax
lda DB2+32,X
ddr2:
    sta ZC
lda #<(2)
adn2:
    clc
adc Z4
sta Z4
bcc dia2
inc Z5
dia2:
    jmp SOUND2
//
.label MC2 = *
retrut2:
    inc ZF
ldy ZF
cpy #<(8)
beq rc2
r2a:
    ldx DB2+49,Y
lda DB2+57,Y
jmp goto2
rc2:
    lda Z9
and #<(%11111011)
sta Z9
rts
//
for2:
    ldx ZF
clc
tya
adc Z4
sta DB2+49,X
lda #<(0)
adc Z5
sta DB2+57,X
lda Z6
sta DB2+65,X
dec ZF
tya
jmp adc2
//
next2:
    ldx ZF
dec DB2+66,X
beq n2a
inx
txa
tay
bpl r2a
n2a:
    inc ZF
lda #<(1)
jmp adc2
//
wrvol2:
    ldy #<(4)
ldx #<(28)
tr2:
    lda (Z6),Y
sta DB2,X
dex
dey
bpl tr2
jmp ad3c2
wrdat2:
    ldy #<(28)
ldx #<(28)
bne tr2
freq2:
    ldy #<(13)
ldx #<(13)
bne tr2
chord2:
    ldy #<(09)
ldx #<(09)
bne tr2
//
gotot2:
    iny
lda (Z4),Y
sta DB2+73
//
goto2l:
    lda Z7
goto2:
    stx Z4
sta Z5
jmp read2
//
call2:
    lda #<(3)
c2a:
    ldy ZF
clc
adc Z4
sta DB2+49,Y
lda Z5
adc #<(0)
sta DB2+57,Y
dec ZF
jmp goto2l
//
callt2:
    iny
lda (Z4),Y
sta DB2+73
lda #<(4)
bne c2a
//
transp2:
    stx DB2+73
tya
jmp adc2
//
pokedb2:
    sta DB2,X
jmp ad3c2
//
pokesb2:
    sta SB2,X
jmp ad3c2
//
nosound2:
    rts
SOUND2:
    ldx SB2+28
beq nosound2
//
VC2:
    lda SB2+26
and #<(8)
beq adsr2
lda ZC
cmp SB2+27
bcs PL2
lda #<(00)
sta SB2+27
lda SB2+26
and #<(246)
sta SB2+26
bne trigrel2
adsr2:
    lda SB2+27
bne ad2
dec SB2+28
bne PL2
ldx #<(6)
cc2:
    sta $D40E,X
dex
bpl cc2
rts
ad2:
    dec SB2+27
bne PL2
lda SB2+26
and #<(246)
trigrel2:
    sta $D412
//
PL2:
    lda SB2+17
beq FC2
lda SB2+16
beq plcdel2
dec SB2+16
jmp FC2
plcdel2:
    clc
ldx SB2+35
ldy SB2+36
plcs02:
    lda SB2+37
beq plcs12
txa
adc SB2+18
tax
tya
adc SB2+19
tay
dec SB2+37
jmp stpl2
plcs12:
    lda SB2+38
beq plcrep2
txa
adc SB2+20
tax
tya
adc SB2+21
tay
dec SB2+38
jmp stpl2
plcrep2:
    lda SB2+17
and #<($81)
beq stpl2
bpl nplcopy2
jsr trnsfrpl2
jmp plcdel2
nplcopy2:
    jsr trnsfrpl2+12
jmp plcdel2
stpl2:
    stx SB2+35
sty SB2+36
stx $D410
sty $D411
//
FC2:
    lda SB2+13
beq exit2
and #<(8)
bne olm2
ldx SB2+29
ldy SB2+30
clc
lda SB2+12
beq fcs12+1
dec SB2+12
lda SB2+13
and #<(2)
bne fcs42l1
exit2:
    rts
olm2:
    ldx SB2+12
bpl no2
ldx SB2+11
no2:
    lda SB2+10
clc
adc SB2,X
dex
stx SB2+12
tay
ldx LOFRQ,Y
lda HIFRQ,Y
jmp stf2TAY
fcs12:
    clc
lda SB2+31
beq fcs22
dec SB2+31
txa
adc SB2+0
tax
tya
adc SB2+1
jmp stf2TAY
fcs22:
    lda SB2+32
beq fcs32
dec SB2+32
txa
adc SB2+2
tax
tya
adc SB2+3
jmp stf2TAY
fcs32:
    lda SB2+33
beq fcrep2
dec SB2+33
txa
adc SB2+4
tax
tya
adc SB2+5
jmp stf2TAY
fcs42l1:
    txa
adc SB2+6
tax
tya
adc SB2+7
stf2TAY:
    tay
stf2:
    stx $D40E
sty $D40F
stx SB2+29
sty SB2+30
rts
fcrep2:
    jsr trnsferf2
jmp fcs12
//
//
.label CE = *
.label TS = *
//
DB0:
    .word -8, 8, -8, -72
.byte <(3), <(6), <(3), <(0), <(30), <(5)
.byte <(20), <(20), <(0), <(5)
.word 20, -20, $800
.byte <(65), <($DD), <($CC), <(130), <(255)
.word 0, 0
.byte <(4), <(8), <(12), <(16), <(20), <(24), <(28)
.byte <(32), <(36), <(40), <(44), <(48), <(52)
.byte <(56), <(60), <(64)
.fill 25, 0
DB1:
    .word 30, -30, 30, 151
.byte <(3), <(6), <(3), <(0), <(50), <(7)
.byte <(30), <(30), <(0), <(5)
.word -30, 30, $B84
.byte <(65), <($88), <($CC), <(150), <(200)
.word 0, 0
.byte <(4), <(8), <(12), <(16), <(20), <(24), <(28)
.byte <(32), <(36), <(40), <(44), <(48), <(52)
.byte <(56), <(60), <(64)
.fill 25, 0
DB2:
    .word 30, -30, 30, 99
.byte <(3), <(6), <(3), <(0), <(50), <(7)
.byte <(30), <(30), <(0), <(5)
.word -30, 30, $B84
.byte <(65), <($88), <($CC), <(150), <(200)
.word 0, 0
.byte <(4), <(8), <(12), <(16), <(20), <(24), <(28)
.byte <(32), <(36), <(40), <(44), <(48), <(52)
.byte <(56), <(60), <(64)
.fill 25, 0
SB0:
    .fill 39, 0
SB1:
    .fill 39, 0
SB2:
    .fill 39, 0
TDL:
    .word CH0D0, CH2D0, CH1D0
.byte <(0), <(0), <(0), <(7), <(1), <(1), <(1), <(7), <(7), <(7)
HIFRQ:
    .byte <(1), <(1), <(1), <(1), <(1), <(1), <(1), <(1), <(1), <(1), <(1), <(2)
.byte <(2), <(2), <(2), <(2), <(2), <(2), <(3), <(3), <(3), <(3), <(3), <(4)
.byte <(4), <(4), <(4), <(5), <(5), <(5), <(6), <(6), <(6), <(7), <(7), <(8)
.byte <(8), <(9), <(9), <(10), <(10), <(11), <(12), <(12), <(13), <(14), <(15), <(16)
.byte <(17), <(18), <(19), <(20), <(21), <(22), <(24), <(25), <(27), <(28), <(30), <(32)
.byte <(34), <(36), <(38), <(40), <(43), <(45), <(48), <(51), <(54), <(57), <(61), <(64)
.byte <(68), <(72), <(76), <(81), <(86), <(91), <(96), <(102), <(108), <(115), <(122), <(129)
.byte <(137), <(145), <(153), <(163), <(172)
LOFRQ:
    .byte <(18), <(35), <(52), <(70), <(90), <(110), <(132), <(155), <(179), <(205), <(233), <(6)
.byte <(37), <(69), <(104), <(140), <(179), <(220), <(8), <(54), <(103), <(155), <(210), <(12)
.byte <(73), <(139), <(208), <(25), <(103), <(185), <(16), <(108), <(206), <(53), <(163), <(23)
.byte <(147), <(21), <(159), <(60), <(205), <(114), <(32), <(216), <(156), <(107), <(70), <(47)
.byte <(37), <(42), <(63), <(100), <(154), <(227), <(63), <(177), <(56), <(214), <(141), <(94)
.byte <(75), <(85), <(126), <(200), <(52), <(198), <(127), <(97), <(111), <(172), <(126), <(188)
.byte <(149), <(169), <(252), <(161), <(105), <(140), <(254), <(194), <(223), <(88), <(52), <(120)
.byte <(43), <(83), <(247), <(31), <(210)
vt0:
    .word retrut0
.word wrvol0
.word 0, freq0
.word pulse0
.word call0
.word transp0
.word callt0, pokedb0
.word 0, code0
.word pokesb0, chord0
.word for0, next0
vt2:
    .word retrut2
.word wrvol2
.word wrdat2, freq2
.word 2
.word call2
.word transp2
.word callt2, pokedb2
.word gotot2, 2
.word pokesb2, chord2
.word for2, next2
vt1:
    .word retrut1
.word wrvol1
.word wrdat1, freq1
.word pulse1
.word call1
.word 1
.word callt1, pokedb1
.word 1, 1
.word pokesb1, 1
.word for1, next1
.label TE = *
.label DS = *
//
BLOCK2:
    .word -8, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(10), <(5)
.fill 8, 0
.word $800
.byte <(33), <(0), <($99), <(5), <(40)
//
PULSE21:
    .byte <(10), <(255), <(0), <(5)
.word 200, -20, $400
//
VOL21:
    .byte <(33), <(0), <($C9), <(5), <(50)
VOL22:
    .byte <(33), <($33), <($CB), <(5), <(150)
VOL23:
    .byte <(33), <($BE), <($CD), <(200), <(255)
//
BLOCK0:
    .word -8, 8, -8, -72
.byte <(3), <(6), <(3), <(0), <(30), <(5)
BLOCK0Va:
    .byte <(65), <(1), <($E7), <(4), <(12)
//
VOL01:
    .byte <(67), <($EE), <($0F), <(5), <(50)
//
GUIT:
    .word 30, -30, 30, 0
.byte <(3), <(6), <(3), <(0), <(22), <(5)
GUITP:
    .byte <(20), <(100), <(3), <(5)
.word 70, 25, 100
GUITV:
    .byte <(65), <($83), <($CB), <(90), <(100)
//
UP00:
    .word 30, -30, 30, 140
.byte <(3), <(6), <(3), <(0), <(10), <(7)
UP01:
    .word 30, -30, 30, 16
.byte <(3), <(6), <(3), <(0), <(20), <(7)
BEND00:
    .word 0, 109, 0, -109
.byte <(3), <(3), <(2), <(3), <(0), <(5)
BEND01:
    .word 30, -30, 30, -308
.byte <(3), <(6), <(3), <(0), <(32), <(7)
UPFULL:
    .word 196, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(4)
DOWN0:
    .word -27, -1, -4, -3
.byte <(100), <(150), <(100), <(255)
.byte <(25), <(5)
DOWN1:
    .word 0, -3, -3, -22
.byte <(50), <(255), <(255), <(0), <(125), <(5)
//
FREQ01:
    .word 85, 0, -85, 0
.byte <(10), <(28), <(10), <(0), <(0), <(5)
FREQ2:
    .word 8, -8, 8, 0
.byte <(3), <(6), <(3), <(0), <(10), <(5)
//
PAUL:
    .word 20, -20, 20, 0
.byte <(3), <(6), <(3), <(0), <(15), <(5)
.byte <(25), <(25), <(30), <(5)
PAULP:
    .word 10, -10, $800
PAULV:
    .byte <(65), <($CC), <($9D), <(150), <(200)
//
TRIP11:
    .byte <(0), <(4), <(7), <(12), <(0), <(4), <(7), <(12)
.byte <(0), <(0) //RMajor
TRIP13:
    .byte <(0), <(3), <(8), <(12), <(0), <(3), <(8), <(12)
.byte <(0), <(0) //1Major
TRIP10a:
    .byte <(0), <(5), <(9), <(12), <(0), <(5), <(9), <(12)
.byte <(0), <(0), <(0), <(8), <(0), <(13) //2Major
TRIP12:
    .byte <(0), <(2), <(7), <(12), <(0), <(2), <(7), <(12)
.byte <(0), <(0) //1Susp4
TRIP14:
    .byte <(0), <(3), <(7), <(12), <(0), <(3), <(7), <(12)
.byte <(0), <(0) //RMinor
TRIP19:
    .byte <(0), <(5), <(8), <(12), <(0), <(5), <(8), <(12)
.byte <(0), <(0) //2Minor
TRIP17:
    .byte <(0), <(3), <(6), <(8), <(0), <(3), <(6), <(8), <(0), <(0)
// 1Seventh
TRIP18:
    .byte <(0), <(4), <(8), <(12), <(0), <(4), <(8), <(12)
.byte <(0), <(0) //1Maj+
//
S01a:
    .byte <(loop), <(8), <(0), <(1), <(Next)
.byte <(loop), <(4), <(0), <(2), <(Next), <(Ret)
S01z:
    .byte <(CT)
.word S01
.byte <(55)
.byte <(Call)
.word S01
.byte <(Transp), <(53)
S01:
    .byte <(Call)
.word S01a
S01b:
    .byte <(0), <(3), <(0), <(3), <(0), <(2), <(0), <(2), <(0), <(2)
.byte <(0), <(4), <(Ret)
//
S02:
    .byte <(Chord)
.word TRIP10a
.byte <(CT)
.word S13
.byte <(41)
.byte <(Chord)
.word TRIP11
.byte <(0), <(16), <(Rest), <(16)
.byte <(Chord)
.word TRIP12
.byte <(CT)
.word S13
.byte <(41)
.byte <(Chord)
.word TRIP13
.word Transp
.byte <(40), <(16), <(Rest), <(16), <(Ret)
//
CH0D0:
    .byte <(Rest+96), <(50)
.byte <(Code)
.word STARTMC
.byte <(loop), <(3), <(Rest+96), <(0)
.byte <(Next)
.byte <(Code)
.word MCFC1
.byte <(Rest+96), <(0)
.byte <(Rest+96), <(0)
.byte <(Code)
.word MCFC2
.byte <(Rest+96), <(0)
.byte <(55+96), <(168)
.byte <(DPoke), <(25), <($38)
.byte <(SPoke), <(29), <($B1)
.byte <(SPoke), <(30), <($19)
.byte <(SPoke), <(12), <(10)
.byte <(SPoke), <(13), <(7)
.byte <(Rest), <(2), <(53), <(4)
.byte <(Freq)
.word FREQ01
.byte <(56), <(12)
.byte <(Freq)
.word BLOCK0
.byte <(56), <(4), <(55), <(12), <(51), <(4)
.byte <(48+96), <(152)
.byte <(loop), <(2), <(43), <(2), <(46), <(2)
.byte <(Next), <(43), <(2)
.byte <(DPoke), <(27), <(50)
.byte <(48+96), <(128)
.byte <(DPoke), <(0), <(256-80)
.byte <(DPoke), <(8), <(255)
.byte <(DPoke), <(12), <(0)
.byte <(DPoke), <(26), <($A9)
.byte <(DPoke), <(27), <(10)
.byte <(50), <(1), <(50), <(1), <(50), <(1), <(50), <(1)
.byte <(50), <(2), <(44), <(2), <(42), <(2)
.byte <(44), <(4), <(44), <(2), <(44), <(2)
.byte <(42), <(4)
.byte <(Freq)
.word UPFULL
.byte <(Pulse)
.word GUITP
.byte <(Volume)
.word GUITV
.byte <(0), <(10)
.byte <(Freq)
.word GUIT
.byte <(58+96), <(128), <(57+96), <(128)
.byte <(55+96), <(192), <(55), <(8), <(57), <(8)
.byte <(58+96), <(128), <(57+96), <(80)
.byte <(Freq)
.word UP00
.byte <(57), <(10)
.byte <(Freq)
.word GUIT
.byte <(58), <(1), <(57), <(1), <(55+96), <(96)
.byte <(Freq)
.word UP01
.byte <(52), <(8)
.byte <(Freq)
.word BEND00
.byte <(52+96), <(80)
.byte <(Freq)
.word GUIT
.byte <(55), <(6), <(57), <(6), <(58+96), <(128)
.byte <(60+96), <(80), <(62), <(4), <(64), <(4)
.byte <(65), <(4), <(64+96), <(80), <(65), <(4)
.byte <(64), <(2), <(65), <(1), <(64), <(1), <(62), <(4)
.byte <(60+96), <(96), <(55), <(4), <(57), <(4)
.byte <(58+96), <(128), <(65+96), <(128)
.byte <(DPoke), <(27), <(200)
.byte <(67+96), <(224)
.byte <(Freq)
.word BEND01
.byte <(67), <(8)
.byte <(DPoke), <(13), <(0)
.byte <(Rest+96), <(0)
.byte <(Rest+96), <(0)
.byte <(Volume)
.word VOL01
.byte <(DPoke), <(17), <(0)
.byte <(DPoke), <(23), <(8)
.byte <(Transp), <(24)
.byte <(loop), <(64)
.byte <(Code)
.word YNCREMENT
.byte <(0), <(2), <(Next)
.byte <(Volume)
.word BLOCK0Va
.byte <(Call)
.word S01z
.byte <(CT)
.word S01
.byte <(54)
.byte <(Call)
.word S01z
.byte <(CT)
.word S01a
.byte <(55)
.byte <(CT)
.word S01b
.byte <(54)
.byte <(DPoke), <(24), <(65)
.byte <(Freq)
.word TRIP10a
.byte <(Call)
.word S02
.byte <(Call)
.word S02
.byte <(Volume)
.word BLOCK0Va
.byte <(DPoke), <(13), <(0), <(loop), <(4)
.byte <(loop), <(3)
.byte <(CT)
.word S01
.byte <(41)
.byte <(Next)
.byte <(CT)
.word S01
.byte <(40)
.byte <(Next)
.byte <(Volume)
.word PAULV
.byte <(DPoke), <(24), <(21)
.byte <(Pulse)
.word PAULP
.byte <(Freq)
.word DOWN0
.byte <(Rest+96), <(0)
.word Transp
.byte <(Rest+96), <(0)
.byte <(50+96), <(125)
.byte <(SPoke), <(29), <($B3)
.byte <(SPoke), <(30), <($08)
.byte <(Rest+96), <(200)
.byte <(SPoke), <(28), <(255)
.byte <(Rest+96), <(200)
.byte <(SPoke), <(28), <(100)
.byte <(Ret)
//
YNCREMENT:
    inc DB0+73
rts
MCFC1:
    ldx #<($38)
ldy #<($1B)
bne MCFCa
MCFC2:
    ldx #<($B1)
ldy #<($19)
MCFCa:
    stx $D400
sty $D401
rts
//
S11z:
    .byte <(Call)
.word S11
S11:
    .byte <(0), <(6), <(0), <(4), <(0), <(4), <(0), <(6)
.byte <(0), <(4), <(12), <(2), <(0), <(2), <(12), <(2)
.byte <(12), <(2), <(Ret)
//
S13:
    .byte <(Call)
.word S13a
.byte <(0), <(2), <(0), <(4), <(0), <(2), <(0), <(2), <(0), <(2)
.byte <(0), <(1), <(0), <(1), <(0), <(1), <(0), <(1)
.byte <(Ret)
S13a:
    .byte <(0), <(2), <(0), <(2), <(0), <(2), <(0), <(1), <(0), <(1)
.byte <(0), <(2), <(0), <(2), <(0), <(1), <(0), <(1), <(0), <(2)
.byte <(Ret)
//
S14:
    .byte <(Freq)
.word TRIP10a
.byte <(loop), <(4)
.byte <(Call)
.word S14a
.byte <(Next), <(Ret)
S14z:
    .byte <(Call)
.word S14a
S14a:
    .byte <(Chord)
.word TRIP10a
.byte <(CT)
.word S13
.byte <(41)
.byte <(Chord)
.word TRIP11
.byte <(Call)
.word S13
.byte <(Chord)
.word TRIP12
.byte <(Call)
.word S13
.byte <(Chord)
.word TRIP13
.byte <(JT)
.word S13
.byte <(40)
//
S17a:
    .byte <(0), <(1), <(0), <(1), <(0), <(4), <(0), <(4), <(0), <(4)
.byte <(0), <(1), <(0), <(1), <(Ret)
S17z:
    .byte <(Call)
.word S17
S17:
    .byte <(Call)
.word S17a
S17b:
    .byte <(0), <(2), <(0), <(2)
.byte <(0), <(2), <(0), <(2), <(0), <(4), <(0), <(1), <(0), <(1)
.byte <(0), <(1), <(0), <(1), <(Ret)
//
CH1D0:
    .byte <(0+96), <(50)
.byte <(Rest+96), <(0)
.byte <(WrDat)
.word BLOCK2
.byte <(Rest+96), <(0)
.byte <(loop), <(2)
.byte <(CT)
.word S11z
.byte <(36)
.byte <(CT)
.word S11z
.byte <(32)
.byte <(CT)
.word S11z
.byte <(29)
.byte <(Next)
.byte <(CT)
.word S11z
.byte <(36)
.byte <(Call)
.word S14
.byte <(Chord)
.word TRIP14
.byte <(CT)
.word S17
.byte <(55)
.byte <(Chord)
.word TRIP13
.byte <(Call)
.word S17
.byte <(Chord)
.word TRIP10a
.byte <(CT)
.word S17
.byte <(53)
.byte <(Chord)
.word TRIP13
.byte <(CT)
.word S17
.byte <(54)
.byte <(Chord)
.word TRIP14
.byte <(CT)
.word S17
.byte <(55)
.byte <(Chord)
.word TRIP13
.byte <(Call)
.word S17
.byte <(Chord)
.word TRIP10a
.byte <(CT)
.word S17
.byte <(53)
.byte <(Chord)
.word TRIP17
.byte <(CT)
.word S17
.byte <(54)
.byte <(Chord)
.word TRIP14
.byte <(CT)
.word S17
.byte <(55)
.byte <(Chord)
.word TRIP13
.byte <(Call)
.word S17
.byte <(Chord)
.word TRIP10a
.byte <(CT)
.word S17
.byte <(53)
.byte <(Chord)
.word TRIP18
.byte <(CT)
.word S17a
.byte <(54)
.byte <(Chord)
.word TRIP17
.byte <(Call)
.word S17b
.byte <(Chord)
.word TRIP14
.byte <(CT)
.word S17
.byte <(55)
.byte <(Chord)
.word TRIP13
.byte <(Call)
.word S17
.byte <(Chord)
.word TRIP10a
.byte <(CT)
.word S17
.byte <(53)
.byte <(Chord)
.word TRIP19
.byte <(CT)
.word S17a
.byte <(55)
.byte <(Chord)
.word TRIP13
.byte <(CT)
.word S17b
.byte <(54)
.byte <(Call)
.word S14z
.byte <(WrDat)
.word PAUL
.byte <(Rest+96), <(0)
.byte <(Rest+96), <(0)
.word Transp
.byte <(50+96), <(128)
.byte <(48+96), <(128)
.byte <(48+96), <(0)
.byte <(50+96), <(128)
.byte <(48+96), <(80)
.byte <(DPoke), <(16), <(0)
.byte <(46), <(4), <(45), <(4), <(46), <(4)
.byte <(48+96), <(80)
.byte <(43), <(4), <(48), <(4), <(50), <(4)
.byte <(52), <(12), <(53), <(4)
.byte <(55), <(4), <(57), <(4), <(58), <(4), <(60), <(4)
.byte <(58+96), <(128)
.byte <(57+96), <(128)
.byte <(55+96), <(0)
.byte <(50+96), <(128)
.byte <(48+96), <(128)
.byte <(48+96), <(128)
.byte <(50+96), <(128)
.byte <(Freq)
.word DOWN1
.byte <(48+96), <(25)
.byte <(SPoke), <(13), <(7)
.byte <(Rest+96), <(100)
.byte <(SPoke), <(29), <($93)
.byte <(SPoke), <(30), <(8)
.byte <(Rest+96), <(200)
.byte <(SPoke), <(28), <(255)
.byte <(Rest+96), <(200)
.byte <(SPoke), <(28), <(255)
.byte <(Ret)
//
S21:
    .byte <(5), <(4), <(5), <(2), <(5), <(2)
.byte <(5), <(2), <(5), <(4), <(5), <(4)
.byte <(0), <(2), <(3), <(2), <(5), <(2), <(8), <(2), <(7), <(2)
.byte <(5), <(2), <(3), <(2)
.byte <(Ret)
//
S22z:
    .byte <(Call)
.word S22
S22:
    .byte <(Call)
.word S22a
S22b:
    .byte <(0), <(4), <(0), <(1), <(0), <(1), <(0), <(2), <(0), <(2)
.byte <(12), <(2), <(0), <(2), <(0), <(2), <(0), <(2)
.byte <(Ret)
S22a:
    .byte <(0), <(1), <(0), <(1), <(0), <(2), <(0), <(2)
.byte <(0), <(2), <(12), <(2), <(0), <(4)
.byte <(Ret)
//
S23z:
    .byte <(Call)
.word S23
S23:
    .byte <(CT)
.word S22
.byte <(34)
.byte <(CT)
.word S22
.byte <(29)
.byte <(CT)
.word S22z
.byte <(36)
.byte <(Ret)
//
S24:
    .byte <(loop), <(4), <(5), <(4), <(0), <(4)
.byte <(Next), <(Ret)
S25:
    .byte <(loop), <(4), <(0), <(8), <(Next), <(Ret)
//
S26:
    .byte <(CT)
.word S22
.byte <(31)
.byte <(CT)
.word S22
.byte <(39)
.byte <(CT)
.word S22
.byte <(34)
.byte <(Ret)
//
CH2D0:
    .byte <(0+96), <(50)
.byte <(WrDat)
.word BLOCK2
.byte <(Rest+96), <(0)
.byte <(loop), <(14)
.byte <(CT)
.word S21
.byte <(31)
.byte <(Next)
.byte <(Volume)
.word VOL21
.byte <(Call)
.word S21
.byte <(Pulse)
.word PULSE21
.byte <(DPoke), <(24), <(65)
.byte <(05), <(2), <(17), <(1), <(17), <(1), <(17), <(2)
.byte <(17), <(2), <(17), <(2), <(05), <(6), <(17), <(4)
.byte <(05), <(4), <(17), <(2), <(05), <(2), <(04), <(4)
.byte <(DPoke), <(13), <(0)
.byte <(Call)
.word S23z
.byte <(Call)
.word S23z
.byte <(CT)
.word S22z
.byte <(31)
.byte <(CT)
.word S22
.byte <(29)
.byte <(CT)
.word S22
.byte <(30)
.byte <(CT)
.word S22z
.byte <(31)
.byte <(CT)
.word S22
.byte <(34)
.byte <(CT)
.word S22
.byte <(38)
.byte <(Call)
.word S26
.byte <(CT)
.word S22a
.byte <(38)
.byte <(CT)
.word S22b
.byte <(30)
.byte <(Call)
.word S26
.byte <(CT)
.word S22a
.byte <(36)
.byte <(CT)
.word S22b
.byte <(38)
.byte <(Call)
.word S23z
.byte <(loop), <(3)
.byte <(CT)
.word S24
.byte <(34-5)
.byte <(CT)
.word S24
.byte <(29-5)
.byte <(CT)
.word S24
.byte <(36-5)
.byte <(Call)
.word S24
.byte <(Next)
.byte <(Volume)
.word VOL22
.byte <(Freq)
.word FREQ2
.byte <(DPoke), <(17), <(0)
.byte <(CT)
.word S25
.byte <(34)
.byte <(CT)
.word S25
.byte <(29)
.byte <(CT)
.word S25
.byte <(36)
.byte <(CT)
.word S25
.byte <(24)
.byte <(CT)
.word S25
.byte <(34)
.byte <(CT)
.word S25
.byte <(29)
.byte <(CT)
.word S25
.byte <(32)
.byte <(CT)
.word S25
.byte <(34)
.byte <(Volume)
.word VOL23
.byte <(2+96), <(0), <(SPoke), <(28), <(255)
.byte <(Rest+96), <(254)
.byte <(SPoke), <(28), <(255), <(Ret)
//
.label MWK = DB0+65
STOPSTART:
    lda #<(0)
sta SB0+28
sta SB1+28
sta SB2+28
ldx #<($17)
resl:
    sta $D400,X
dex
bpl resl
ldx #<(15)
gttd:
    lda TDL,X
sta Z0,X
dex
bpl gttd
x5:
    ldx #<(REFRESH)
ldy #>REFRESH
stx MUS+1
sty MUS+2
rts
MCREFR:
    lda #<(0)
beq READ
READ:
    ldy MWK+0
lda Secret,Y
beq x5
inc MWK+0
lsr
tax
lda CodeTab-'A',X
sta MWK+1
and #<(3)
sta MWK+2
ldx #<(SH-READ)
bne x
SH:
    asl MWK+1
bcc sDIT
lda #<(6)
ldx #<(DAH-READ)
xF:
    ldy #<(33)
bne x4
sDIT:
    lda #<(2)
ldx #<(DIT-READ)
bne xF
SPC:
    dec MWK+3
bpl x1
dec MWK+2
bpl SH
lda #<(6)
sta MWK+3
ldx #<(GAP-READ)
bne x
GAP:
    dec MWK+3
bpl x1
bmi READ
DAH:
    dec MWK+3
bpl x1
bmi sSPC
DIT:
    dec MWK+3
bpl x1
sSPC:
    lda #<(2)
ldx #<(SPC-READ)
ldy #<(32)
x4:
    sta MWK+3
bne x2
STARTMC:
    lda #<($A0)
sta $D406
ldx #<($4B)
stx $D400
ldy #<($22)
sty $D401
ldx #<(MCREFR)
ldy #>MCREFR
stx MUS+1
sty MUS+2
lda #<(0)
tax
tay
sta MWK+0
sta $D405
sta SB0+28
x2:
    sty $D404
x:
    stx MCREFR+3
x1:
    jmp REFRESH
//
Secret:
    .byte <(2*'B'), <(2*'I'), <(2*'L'), <(2*'L')
.byte <(2*'B'), <(2*'A'), <(2*'R'), <(2*'N')
.byte <(2*'A')
.byte <(2*'D'), <(2*'A'), <(2*'V'), <(2*'I')
.byte <(2*'D'), <(2*'C'), <(2*'O'), <(2*'L')
.byte <(2*'L'), <(2*'I'), <(2*'E'), <(2*'R')
.byte <(2*'M'), <(2*'A'), <(2*'R'), <(2*'T')
.byte <(2*'I'), <(2*'N'), <(2*'G'), <(2*'A')
.byte <(2*'L'), <(2*'W'), <(2*'A'), <(2*'Y')
.byte <(2*'T'), <(2*'O'), <(2*'N'), <(2*'Y')
.byte <(2*'P'), <(2*'O'), <(2*'M'), <(2*'F')
.byte <(2*'R'), <(2*'E'), <(2*'T')
.byte <(2*'S'), <(2*'T'), <(2*'E'), <(2*'V')
.byte <(2*'E'), <(2*'W'), <(2*'A'), <(2*'H')
.byte <(2*'I'), <(2*'D')
.byte <(0)
//
CodeTab:
    .word $8341, $82A3, $2300
.word $03C2, $7310, $43A2
.word $81C1, $63E2, $42D3
.word $8002, $1322, $9362
.word $C3B3
//
DE:
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ The End! ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^