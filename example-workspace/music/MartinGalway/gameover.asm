
//     --------- "Game Over" Audio Source File (SID/65xx system) -----------

//   --------- Design, code, music & arrangements by Martin Galway -----------

//   -------------------- Work started 10th February 1987. -------------------

//     ------ (C) MARTIN GALWAY 18:15  Thursday 9th      July 1987. --------

//======================*===CODE ENTRY INFORMATION===*==========================

//  LETTER TUNE VALUE ITEM
//  ------ ---------- ----
//  B      1*7-2  *   Title screen
//  C      2*7-2  *   Game Over
//  D             *   Laser
//  E             *   Boomerang
//  F             *   Grenade
//  G             *   Grenade Explodes
//  H             *   Monster Thud
//  I             *   Alien Fires
//  J             *   Energy getting drained
//  K             *   Picks up a heart
//  L             *   Laser turret firing
//  M             *   Kangaroos Hop
//  N             *   Imps Appear
//  O             *   Lift Dings
//  P             *   Statue Eyes Hit


//Recommended screen Y-coordinates for the 200 Hz refresh on P.A.L.:
//          32         110        188         10(+256) gap=78
//Recommended screen Y-coordinates for the 200 Hz refresh on N.T.S.C.:
//          47         107        172           237    gap=65

//===========================*===SYSTEM VARIABLES===*===========================

.label ZER0 = $0010 //\
.label PC0 = ZER0+00
.label PC1 = ZER0+02
.label PC2 = ZER0+04
.label CLOCK0 = ZER0+06
.label CLOCK1 = ZER0+07
.label CLOCK2 = ZER0+08
.label SP0 = ZER0+09
.label SP1 = ZER0+10
.label SP2 = ZER0+11
.label TR0 = ZER0+12
.label TR1 = ZER0+13
.label TR2 = ZER0+14
.label IN = ZER0+15
.label S0PCURR = ZER0+17
.label S1PCURR = ZER0+19
.label S2PCURR = ZER0+21
.label S0FCURR = ZER0+23
.label S1FCURR = ZER0+25
.label S2FCURR = ZER0+27
.label OUT = ZER0+29 //this z.p. word to be used OUTSIDE INTERRUPTS ONLY!!!
.label Z8 = ZER0+31

.label COM = $C0
.label Sil = HiFrq-LoFrq-1 //@
.label Rest = $5F
.label R = $60
.label RestR = Rest+R
.label Ret = COM+0
.label Call = COM+2
.label Jmp = COM+4
.label CT = COM+6
.label JT = COM+8
.label Moke = COM+10
.label For = COM+12
.label Next = COM+14
.label SLoad = COM+16
.label FLoad = COM+18
.label Vlm = COM+20
.label Soke = COM+22
.label Code = COM+24
.label Transp = COM+26
.label DMoke = COM+28
.label DSoke = COM+30
.label Master = COM+32
.label Filter = COM+34
.label Disown = COM+36
.label Own = COM+38
.label MBendOff = COM+40
.label MBendOn = COM+42
.label Freq = COM+44
.label Trigger = COM+46

.label FMG0 = 0
.label FMG1 = 2
.label FMG2 = 4
.label FMG3 = 6
.label FMD0 = 8
.label FOLA = 8 // F.O.M. Offset List Address (new feature)
.label FMD1 = 9
.label CHS = 9
.label FMD2 = 10
.label FMD3 = 11
.label FMDLY = 12
.label FMC = 13
.label CFINIT = 14
.label PMD0 = 14
.label PMD1 = 15
.label PMDLY = 16
.label PMC = 17
.label PMG0 = 18
.label PMG1 = 20
.label PINIT = 22
.label VWF = 24
.label VADV = 25
.label VSRV = 26
.label VADSD = 27
.label VRD = 28

.label FOLDC = 4 // F.O.M. Duration Counter (new feature)
.label FBG = 6
.label FOLOD = 6 // F.O.M. Offset Duration (new feature)
.label CFMD0 = 8
.label CFMD1 = 9
.label CFMD2 = 10
.label FOLB = 10
.label CFMD3 = 11
.label FOLII = 11
.label FBD = 12
.label FOLCI = 12
.label CPMD0 = 14
.label CPMD1 = 15
.label FINIT = 24
.label VWFG = 26
.label VADSC = 27
.label VRC = 28
.label FMD0C = 29
.label FMD1C = 30
.label FMD2C = 31
.label FMD3C = 32
.label PMD0C = 33
.label PMD1C = 34
.label DEPTHOFSTACKS = 4

//=== P.A.L. FREQUENCY TABLE (NOT TO BE USED ON N.T.S.C.) : 1.019 MHz CLOCK ===

//BASE "A" VALUE FOR THIS OCTAVE IS 235. (EQUIVALENT TO N-03)

.label N00 = 279
.label N01 = 296
.label N02 = 314
.label N03 = 332
.label N04 = 352
.label N05 = 373
.label N06 = 395
.label N07 = 419
.label N08 = 444
.label N09 = 470
.label N10 = 498
.label N11 = 528
.label N12 = 559
.label N13 = 592
.label N14 = 627
.label N15 = 665
.label N16 = 704
.label N17 = 746
.label N18 = 790
.label N19 = 837
.label N20 = 887
.label N21 = 940
.label N22 = 996
.label N23 = 1055
.label N24 = 1118
.label N25 = 1184
.label N26 = 1255
.label N27 = 1330
.label N28 = 1408
.label N29 = 1492
.label N30 = 1581
.label N31 = 1675
.label N32 = 1774
.label N33 = 1880
.label N34 = 1992
.label N35 = 2110
.label N36 = 2236
.label N37 = 2369
.label N38 = 2509
.label N39 = 2659
.label N40 = 2817
.label N41 = 2984
.label N42 = 3162
.label N43 = 3350
.label N44 = 3549
.label N45 = 3760
.label N46 = 3984
.label N47 = 4220
.label N48 = 4471
.label N49 = 4737
.label N50 = 5019
.label N51 = 5317
.label N52 = 5634
.label N53 = 5969
.label N54 = 6324
.label N55 = 6700
.label N56 = 7098
.label N57 = 7520
.label N58 = 7967
.label N59 = 8441
.label N60 = 8943
.label N61 = 9475
.label N62 = 10038
.label N63 = 10635
.label N64 = 11267
.label N65 = 11937
.label N66 = 12647
.label N67 = 13399
.label N68 = 14195
.label N69 = 15040
.label N70 = 15934
.label N71 = 16881
.label N72 = 17886
.label N73 = 18949
.label N74 = 20076
.label N75 = 21270
.label N76 = 22534
.label N77 = 23875
.label N78 = 25294
.label N79 = 26798
.label N80 = 28391
.label N81 = 30080
.label N82 = 31869
.label N83 = 33764
.label N84 = 35771
.label N85 = 37898
.label N86 = 40151
.label N87 = 42540
.label N88 = 45069
.label N89 = 47749
.label N90 = 50588
.label N91 = 53596
.label N92 = 56783
.label N93 = 60160
.label NSil = 00000

.label SCREEN = $0400
.label ROW0 = SCREEN+0*40
.label SPEED = ROW0+33
.label YYY = ROW0+37
.label ROW1 = SCREEN+1*40
.label TIMER = ROW1+08
.label FASTER = ROW1+39
.label ROW2 = SCREEN+2*40
.label ROW3 = SCREEN+3*40
.label ROW4 = SCREEN+4*40
.label ROW5 = SCREEN+5*40
.label ROW6 = SCREEN+6*40
.label ROW7 = SCREEN+7*40
.label ROW8 = SCREEN+8*40
.label ROW9 = SCREEN+9*40
.label ROW10 = SCREEN+10*40
.label ROW11 = SCREEN+11*40
.label ROW12 = SCREEN+12*40
.label ROW13 = SCREEN+13*40
.label ROW14 = SCREEN+14*40
.label ROW15 = SCREEN+15*40
.label ROW16 = SCREEN+16*40
.label ROW17 = SCREEN+17*40
.label ROW18 = SCREEN+18*40
.label ROW19 = SCREEN+19*40
.label ROW20 = SCREEN+20*40
.label ROW21 = SCREEN+21*40
.label ROW22 = SCREEN+22*40
.label ROW23 = SCREEN+23*40
.label ROW24 = SCREEN+24*40
.label BDR = $D020
.label MREFCOLOUR = 1 //                                 White, for music refreshes
.label DREFCOLOUR = 0 //                       Desired colour for display refreshes

// === FILE CONTROL CHARACTERS ===

// \ PROGRAM ASSEMBLY MODE (DEVELOPMENT/MOBJ)
// @ SILENCE HANDLING ON/OFF

//======================************************================================
//======================*=== DRIVER PROGRAM ===*================================
//======================************************================================

* = $0800 //\

Start:
    sei
jsr InitScreen
jsr INITSOUND
jsr Title
ldx #<(DRUMDATA)
ldy #>DRUMDATA
lda #<(2)
jsr RIFF
jsr FastForward
jsr INITRASTERS
cli
jmp MAIN
lda #<(Q)
bne DLoop
ldy #<(10)
jsr Delay

DLoop:
    sei
lda #<(0)
sta BDR
jsr DREFRESH
jsr $EA87
jsr $F13E
beq nk
sta BDR
cf0:
    cmp #<(13)
bne cf1
inc RF
jmp nk
cf1:
    cmp #<('+')
bne cf2
jsr IncRefsp
jmp nk
cf2:
    cmp #<('-')
bne cf3
jsr DecRefsp
jmp nk
cf3:
    cmp #<('@')
bne cf4
ldx #<(1)
stx Refsp+1
dex
stx Refsp
jmp nk
cf4:
    cmp #<('*')
bne cf5
ldx #<(0)
stx Refsp+1
inx
stx Refsp
jmp nk
cf5:
    cmp #<('Z'+1)
bcs nk
cmp #<('A')
bcc nk
asl
tay
lda DVTABL-'A'*2,Y
sta DVEC+1
lda DVTABL-'A'*2+1,Y
sta DVEC+2
DVEC:
    jsr $DDDD
nk:
    jmp DLoop

DVTABL:
    .word INITSOUND, Title, GameOver
.word Laser, Boomerang, Grenade, GrenExplodes
.word MonsterThuds, AlienFires, EnergyDrain, PicksUpHeart
.word LaserTurret, KangaroosHop, ImpsAppear
.word LiftDings, StatueEyesHit, FaFo, FaFo
.word FaFo, FaFo, FaFo, FaFo
.word FaFo, FaFo, FaFo, FaFo

Title:
    jsr ResetCl
jsr StartCl
ldy #<(1*7-2)
jmp TUNE
GameOver:
    jsr ResetCl
jsr StartCl
ldy #<(2*7-2)
jmp TUNE

Laser:
    ldx #<(2)
lda #<(LASER)
ldy #>LASER
jmp EFFECT
Boomerang:
    ldx #<(1)
lda #<(BOOMERANG)
ldy #>BOOMERANG
jmp EFFECT
Grenade:
    ldx #<(2)
lda #<(GRENADE)
ldy #>GRENADE
jmp EFFECT
GrenExplodes:
    ldx #<(0)
lda #<(GRENEXPLODES)
ldy #>GRENEXPLODES
jmp EFFECT
MonsterThuds:
    ldx #<(1)
lda #<(MONSTERTHUDS)
ldy #>MONSTERTHUDS
jmp EFFECT
AlienFires:
    ldx #<(2)
lda #<(ALIENFIRES)
ldy #>ALIENFIRES
jmp EFFECT
EnergyDrain:
    ldx #<(0)
lda #<(ENERGYDRAIN)
ldy #>ENERGYDRAIN
jmp EFFECT
PicksUpHeart:
    ldx #<(1)
lda #<(PICKSUPHEART)
ldy #>PICKSUPHEART
jmp EFFECT
LaserTurret:
    ldx #<(2)
lda #<(LASERTURRET)
ldy #>LASERTURRET
jmp EFFECT
KangaroosHop:
    ldx #<(1)
lda #<(KANGAROOSHOP)
ldy #>KANGAROOSHOP
jmp EFFECT
ImpsAppear:
    ldx #<(2)
lda #<(IMPSAPPEAR)
ldy #>IMPSAPPEAR
jmp EFFECT
LiftDings:
    ldx #<(1)
lda #<(LIFTDINGS)
ldy #>LIFTDINGS
jmp EFFECT
StatueEyesHit:
    ldx #<(2)
lda #<(STATUEEYESHIT)
ldy #>STATUEEYESHIT
jmp EFFECT

HANG:
    inc BDR
jmp HANG

HANG0:
    ldx #<(0)
.byte <($2C)
HANG1:
    ldx #<(1)
.byte <($2C)
HANG2:
    ldx #<(2)
sei
lda #<(3)
HANGLOOP:
    sta BDR
stx BDR
jmp HANGLOOP

WAITCLOCK00:
    ldx $D011
bmi WAITCLOCK00
bpl WAITCLOCKa
WAITCLOCK80:
    ldx $D011
bpl WAITCLOCK80
WAITCLOCKa:
    cmp $D012
bne WAITCLOCKa
WAITCLOCKb:
    lda Refsp
clc
adc CREFSP
sta CREFSP
lda CREFSP+1
pha
adc Refsp+1
sta CREFSP+1
pla
cmp CREFSP+1
rts

FaFo:
    jsr f2
f2:
    jsr f3
f3:
    jsr f4
f4:
    jsr f5
f5:
    jsr f6
f6:
    jsr f7
f7:
    jsr f8
f8:
    jsr f9
f9:
    jsr f10
f10:
    jsr UpdateCl
inc BDR
jsr WAITCLOCKb
REFRESH:
    php
inc ClkAdd
plp
beq xit
inc BDR
jsr FILTER
//              JSR DRUMS
ldx #<(CH0VALUE)
beq R1x
jsr MUSIC0
jsr SOUND0
R1x:
    ldx #<(CH1VALUE)
beq R1y
jsr MUSIC1
jsr SOUND1
R1y:
    ldx #<(CH2VALUE)
beq xit
jsr MUSIC2
jsr SOUND2
xit:
    dec BDR
rts

ResetCl:
    lda #<('0')
ldx #<(5)
RCLoop:
    sta CD5,X
dex
bpl RCLoop
StopCl:
    lda #<(0)
.byte <($2C)
StartCl:
    lda #<(1)
sta ClkAdd
sc2:
    rts

DREFRESH:
    lda #<(32)
jsr WAITCLOCK00
jsr REFRESH
jsr RefScreen1
REF2:
    lda #<(110)
jsr WAITCLOCK00
jsr REFRESH
jsr RefScreen2
REF3:
    lda #<(188)
jsr WAITCLOCK00
jsr REFRESH
jsr RefScreen3
REF4:
    lda #<(10)
jsr WAITCLOCK80
jsr REFRESH
jsr RefScreen4
jmp UpdateCl

UpdateCl:
    lda #<(0)
ldx #<(CH0VALUE)
beq u1
ora MFL0
ora S0+VRC
u1:
    ldx #<(CH1VALUE)
beq u2
ora MFL1
ora S1+VRC
u2:
    ldx #<(CH2VALUE)
beq ua
ora MFL2
ora S2+VRC
ua:
    tax
beq StopCl
lda ClkAdd
cmp #<(4)
bcc sc2
lsr
ldx #<(0)
stx ClkAdd
clc
adc CD0
cmp #<('9'+1)
bcc ncu0
lda #<('0')
ncu0:
    sta CD0
bcc PrintCl
lda CD1
adc #<(0)
cmp #<('9'+1)
bcc ncu1
lda #<('0')
ncu1:
    sta CD1
bcc PrintCl
lda CD2
adc #<(0)
cmp #<('9'+1)
bcc ncu2
lda #<('0')
ncu2:
    sta CD2
bcc PrintCl
lda CD3
adc #<(0)
cmp #<('5'+1)
bcc ncu3
lda #<('0')
ncu3:
    sta CD3
bcc PrintCl
lda CD4
adc #<(0)
cmp #<('9'+1)
bcc ncu4
lda #<('0')
ncu4:
    sta CD4
bcc PrintCl
lda CD5
adc #<(0)
cmp #<('5'+1)
bcc ncu5
lda #<('0')
ncu5:
    sta CD5
PrintCl:
    ldx #<(1)
PCL:
    lda CD5,X
sta TIMER,X
lda CD3,X
sta TIMER+3,X
lda CD1,X
sta TIMER+6,X
dex
bpl PCL
lda #<('-')
sta TIMER+2
sta TIMER+5
udc2:
    rts

CD5:
    .fill 1, 0
CD4:
    .fill 1, 0
CD3:
    .fill 1, 0
CD2:
    .fill 1, 0
CD1:
    .fill 1, 0
CD0:
    .fill 1, 0
CG:
    .byte <(0)
ClkAdd:
    .byte <(0)
CREFSP:
    .word 0
Refsp:
    .word 0
xcstr:
    .text "0123456789ABCDEF"

IncRefsp:
    ldx Refsp
beq DR2
inx
bne DR1
inc Refsp+1
bne DR1
DecRefsp:
    ldx Refsp
dex
beq DR2
lda #<(0)
sta Refsp+1
DR1:
    stx Refsp
DR2:
    rts

FastForward:
    lda #<(QSOUND)
sta RF
lda #<(Q)
sta FASTER
Fast1:
    lda FASTER
beq Fast2
XXXLOOP:
    jsr FaFo //DEC COUNT:BNE XXXLOOP
dec FASTER
jmp Fast1
Fast2:
    ldx #<(CH0VALUE*1+CH1VALUE*2+CH2VALUE*4)
stx RF
rts
//COUNT         DFB 0

Delay:
    lda #<(100)
ldx #<(101)
delayloop1:
    cmp $D012
bne delayloop1
delayloop2:
    cpx $D012
bne delayloop2
dey
bne delayloop1
Fz:
    rts

InitScreen:
    ldx #<(256)
ldy #<(15)
stx CREFSP
stx CREFSP+1
is1:
    lda #<(32)
sta $400,X
sta $500,X
sta $600,X
sta $700,X
tya
sta $D800,X
sta $D900,X
sta $DA00,X
sta $DB00,X
dex
bne is1
dex //                  enable autorepeat on whole keyboard
stx 650
ldx #<(refsp)
stx Refsp
ldy #>refsp
sty Refsp+1
jsr PrintCl
lda #<(0)
sta BDR
rts
jsr RefScreen1
jsr RefScreen2
jsr RefScreen3
jmp RefScreen4

RefScreen1:
    lda #<(DREFCOLOUR)
sta BDR
ldx #<(32-1)
sh3:
    lda IDRT,X
sta ROW24,X
dex
bpl sh3
ldx #<(2)
.byte <($A9)
RF:
    .byte <($DF)
sh5:
    lsr
pha
bcc sh6
lda #<('Y')
.byte <($2C)
sh6:
    lda #<('N')
sta YYY,X
pla
dex
bpl sh5
ldx #<('0')
lda Refsp+1
beq sh10
inx
sh10:
    stx SPEED
lda Refsp
tay
lsr
lsr
lsr
lsr
tax
lda xcstr,X
sta SPEED+1
tya
and #<(15)
tax
lda xcstr,X
sta SPEED+2
ldx #<(Z8-ZER0)
sh1:
    lda ZER0,X
sta ROW0,X
dex
bpl sh1
lda #<(0)
sta BDR
rts

RefScreen2:
    lda #<(DREFCOLOUR)
sta BDR
ldx #<(D1-D0-1)
sh2:
    lda D0,X
sta ROW3,X
lda D1,X
sta ROW6,X
lda D2,X
sta ROW9,X
dex
bpl sh2
lda #<(0)
sta BDR
rts

RefScreen3:
    lda #<(DREFCOLOUR)
sta BDR
ldx #<(S1-S0-1)
sh4:
    lda S0,X
sta ROW15,X
lda S1,X
sta ROW17,X
lda S2,X
sta ROW19,X
dex
bpl sh4
lda #<(0)
sta BDR
rts

RefScreen4:
    lda #<(DREFCOLOUR)
sta BDR
lda FilterChannel
sta ROW24+33
ldx #<(5)
sh7:
    lda MFL0,X
sta ROW24+34,X
dex
bpl sh7
ldx #<(21)
sh8:
    lda CUT,X
sta ROW21,X
dex
bpl sh8
ldx #<(15)
sh9:
    lda CUTST,X
sta ROW12,X
dex
bpl sh9
lda #<(0)
sta BDR
rts

MAIN:
    jsr PLEY
jsr RefScreen1
jsr PLEY
jsr RefScreen2
jsr PLEY
jsr RefScreen3
jsr PLEY
jsr RefScreen4
jmp MAIN

INITRASTERS:
    lda #<($35)
sta $01
lda #<(10)
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
rts

//=== INTERRUPT ROUTINE ===

IRQ:
    pha
lda $D019
sta $D019
lda #<(10)
sta $D012
cld
tya
pha
txa
pha
//              LDA CURRDRM:ADD #drmsp:STA CURRDRM:BCC ndr
lda #<(0)
sta BDR
jsr MUSIC0
jsr MUSIC1
jsr MUSIC2
jsr SOUND0
jsr SOUND1
jsr SOUND2
jsr FILTER
jsr DRUMS
ndr:
    lda #<(12)
sta BDR
pla
tax
pla
tay
pla
rti

CURRDRM:
    .byte <(0)

//=======================*******************************========================
//=======================*=== END OF DRIVER PROGRAM ===*========================
//=======================*******************************========================
























SP: //=====================********************************=======================
//=======================*=== START OF MUSIC PROGRAM ===*=======================
//=======================********************************=======================

* = $1000

vt0:
    .word retsubrut0
.word call0
.word goto0
.word callt0
.word gotot0
.word mpoke0
.word for0
.word next0
.word HANG0 //sload0
.word fload0
.word volume0
.word spoke0
.word code0
.word transp0
.word dmpoke0
.word dspoke0
.word master0
.word filter0
.word HANG0 //disown0
.word HANG0 //own0
.word mbendoff0
.word mbendon0
.word freq0
.word trigger0

vt1:
    .word retsubrut1
.word call1
.word goto1
.word callt1
.word HANG1 //gotot1
.word mpoke1
.word for1
.word next1
.word HANG1 //sload1
.word fload1
.word volume1
.word spoke1
.word code1
.word transp1
.word dmpoke1
.word dspoke1
.word master1
.word filter1
.word HANG1 //disown1
.word HANG1 //own1
.word mbendoff1
.word mbendon1
.word freq1

vt2:
    .word retsubrut2
.word call2
.word goto2
.word callt2
.word HANG2 //gotot2
.word mpoke2
.word for2
.word next2
.word HANG2 //sload2
.word fload2
.word volume2
.word spoke2
.word code2
.word transp2
.word dmpoke2
.word dspoke2
.word master2
.word filter2
.word disown2
.word HANG2 //own2
.word mbendoff2
.word mbendon2
.word freq2

ST: //============================================================================

D418:
    .byte <(0) //                                     used by drum programs
D0:
    .fill 29, $DD
ST0L:
    .fill DEPTHOFSTACKS, $DD //                    stack (low bytes only)
ST0H:
    .fill DEPTHOFSTACKS, $DD //                   stack (high bytes only)
ST0C:
    .fill DEPTHOFSTACKS, $DD //                  stack(for/next counters)
D1:
    .fill 29, $DD
ST1L:
    .fill DEPTHOFSTACKS, $DD
ST1H:
    .fill DEPTHOFSTACKS, $DD
ST1C:
    .fill DEPTHOFSTACKS, $DD
D2:
    .fill 29, $DD
ST2L:
    .fill DEPTHOFSTACKS, $DD
ST2H:
    .fill DEPTHOFSTACKS, $DD
ST2C:
    .fill DEPTHOFSTACKS, $DD
CUTST:
    .fill 16, $DD
CUT:
    .fill 22, $DD
S0:
    .fill 35, $DD
S1:
    .fill 35, $DD
S2:
    .fill 35, $DD
FilterChannel:
    .byte <($DD)
FilterByte:
    .byte <($DD)
MFL0:
    .byte <($DD)
MFL1:
    .byte <($DD)
MFL2:
    .byte <($DD)
channel:
    .byte <($DD)
offset:
    .byte <($DD)
IDRT:
    .fill 32, $DD
DTAB:
    .byte <(D0-D0), <(D1-D0), <(D2-D0)
CHTAB:
    .byte <(0*7+2), <(1*7+2), <(2*7+2)
SBTAB:
    .byte <(S0+23-S0), <(S1+23-S0), <(S2+23-S0)
LoFrq:
    .byte <(N00), <(N01), <(N02), <(N03), <(N04), <(N05), <(N06), <(N07), <(N08), <(N09)
.byte <(N10), <(N11), <(N12), <(N13), <(N14), <(N15), <(N16), <(N17), <(N18), <(N19)
.byte <(N20), <(N21), <(N22), <(N23), <(N24), <(N25), <(N26), <(N27), <(N28), <(N29)
.byte <(N30), <(N31), <(N32), <(N33), <(N34), <(N35), <(N36), <(N37), <(N38), <(N39)
.byte <(N40), <(N41), <(N42), <(N43), <(N44), <(N45), <(N46), <(N47), <(N48), <(N49)
.byte <(N50), <(N51), <(N52), <(N53), <(N54), <(N55), <(N56), <(N57), <(N58), <(N59)
.byte <(N60), <(N61), <(N62), <(N63), <(N64), <(N65), <(N66), <(N67), <(N68), <(N69)
.byte <(N70), <(N71), <(N72), <(N73), <(N74), <(N75), <(N76), <(N77), <(N78), <(N79)
.byte <(N80), <(N81), <(N82), <(N83), <(N84), <(N85), <(N86), <(N87), <(N88), <(N89)
.byte <(NSil)
HiFrq:
    .byte >(N00), >(N01), >(N02), >(N03), >(N04), >(N05), >(N06), >(N07), >(N08), >(N09)
.byte >(N10), >(N11), >(N12), >(N13), >(N14), >(N15), >(N16), >(N17), >(N18), >(N19)
.byte >(N20), >(N21), >(N22), >(N23), >(N24), >(N25), >(N26), >(N27), >(N28), >(N29)
.byte >(N30), >(N31), >(N32), >(N33), >(N34), >(N35), >(N36), >(N37), >(N38), >(N39)
.byte >(N40), >(N41), >(N42), >(N43), >(N44), >(N45), >(N46), >(N47), >(N48), >(N49)
.byte >(N50), >(N51), >(N52), >(N53), >(N54), >(N55), >(N56), >(N57), >(N58), >(N59)
.byte >(N60), >(N61), >(N62), >(N63), >(N64), >(N65), >(N66), >(N67), >(N68), >(N69)
.byte >(N70), >(N71), >(N72), >(N73), >(N74), >(N75), >(N76), >(N77), >(N78), >(N79)
.byte >(N80), >(N81), >(N82), >(N83), >(N84), >(N85), >(N86), >(N87), >(N88), >(N89)
.byte <(NSil)

//==============================================================================

TUNE:
    lda TUNETABLE+1,Y
sta CalcDurations+1
ldx #<(2)
stx channel
ldx #<(4)
stx offset
dey
get_tune_data:
    lda TUNETABLE,Y
ora TUNETABLE+1,Y
beq leve_it_alone
ldx offset
lda TUNETABLE,Y
sta PC0,X
lda TUNETABLE+1,Y
sta PC0+1,X
sty OUT
ldx channel
ldy DTAB,X
lda #<(0)
sta TR0,X
sta D0+FMC,Y
sta D0+PMC,Y
lda #<(DEPTHOFSTACKS-1)
sta SP0,X
lda #<(1)
sta CLOCK0,X
sta MFL0,X
ldy OUT
//              STA SFL0,X;[
leve_it_alone:
    dey
dey
dec offset
dec offset
dec channel
bpl get_tune_data
NewDurations:
    clc
lda #<(0)
CalcDurations:
    adc #<($DD)
sta IDRT,X
inx
cpx #<(32)
bcc CalcDurations
lda #<(192) //        a duration of 64 beats instead of 31
sta IDRT+30
rts

transferpm0:
    ldx S0+PINIT
ldy S0+PINIT+1
transferpm0a:
    stx S0PCURR
sty S0PCURR+1
lda S0+CPMD0
sta S0+PMD0C
lda S0+CPMD1
sta S0+PMD1C
rts
transferpm1:
    ldx S1+PINIT
ldy S1+PINIT+1
transferpm1a:
    stx S1PCURR
sty S1PCURR+1
lda S1+CPMD0
sta S1+PMD0C
lda S1+CPMD1
sta S1+PMD1C
rts
transferpm2:
    ldx S2+PINIT
ldy S2+PINIT+1
transferpm2a:
    stx S2PCURR
sty S2PCURR+1
lda S2+CPMD0
sta S2+PMD0C
lda S2+CPMD1
sta S2+PMD1C
rts
transfercf:
    ldx CUT+14
ldy CUT+15
stx CUT+16
sty CUT+17
transfercfa:
    lda CUT+8
sta CUT+18
lda CUT+9
sta CUT+19
lda CUT+10
sta CUT+20
lda CUT+11
sta CUT+21
rts

EFFECT:
    sta OUT
sty OUT+1
stx channel
lda CHTAB,X
sta el2a+1
tay
lda #<(8)
sta $D402,Y
ldy #<(26)
ldx #<(4)
el2:
    lda (OUT),Y
el2a:
    sta $D4DD,X
dey
dex
bpl el2
ldy #<(29)
ldx el2+3
lda (OUT),Y
sta $D3FE,X
iny
lda (OUT),Y
sta $D3FF,X
ldy channel
ldx SBTAB,Y
ldy #<(30)
sta S0+2,X
dey
lda (OUT),Y
sta S0+1,X
dey
lda (OUT),Y
sta S0+5,X
dey
lda (OUT),Y
sta S0+4,X
ldy #<(24)
lda (OUT),Y
sta S0+3,X
ldy #<(23)
el3:
    lda (OUT),Y
sta S0+0,X
dex
dey
bpl el3
inx
bne ch1or2
lda S0+PMC
beq transferf0
jsr transferpm0
transferf0:
    ldx S0+FINIT
ldy S0+FINIT+1
stx S0FCURR
sty S0FCURR+1
transferf0a:
    lda S0+CFMD3
sta S0+FMD3C
lda S0+CFMD2
sta S0+FMD2C
lda S0+CFMD1
sta S0+FMD1C
lda S0+CFMD0
sta S0+FMD0C
rts
ch1or2:
    cpx #<($46)
beq ch2
lda S1+PMC
beq lll1
jsr transferpm1
lll1:
    lda S1+FMC
beq ex0
transferf1:
    ldx S1+FINIT
ldy S1+FINIT+1
stx S1FCURR
sty S1FCURR+1
transferf1a:
    lda S1+CFMD3
sta S1+FMD3C
lda S1+CFMD2
sta S1+FMD2C
lda S1+CFMD1
sta S1+FMD1C
lda S1+CFMD0
sta S1+FMD0C
ex0:
    rts
ch2:
    lda S2+PMC
beq lll2
jsr transferpm2
lll2:
    lda S2+FMC
beq ex0
transferf2:
    ldx S2+FINIT
ldy S2+FINIT+1
stx S2FCURR
sty S2FCURR+1
transferf2a:
    lda S2+CFMD3
sta S2+FMD3C
lda S2+CFMD2
sta S2+FMD2C
lda S2+CFMD1
sta S2+FMD1C
lda S2+CFMD0
sta S2+FMD0C
rts

INITSOUND:
    jsr ResetCl //\
lda #<($97)
sta $DD00
ldx #<($17)
ResetLoop:
    lda #<(8)
sta $D400,X
lda #<(0)
sta $D400,X
dex
bpl ResetLoop
sta S0+VRC
sta S1+VRC
sta S2+VRC
sta CUT+FMC
sta MFL0
sta MFL1
sta MFL2
stx FilterChannel
ldx #<(15)
stx $D418
sta D418
rts

//=========================*=== MUSIC CONTROL ===*==============================

MC0:
callt0:
    lda (PC0),Y
sta TR0
iny
lda #<(4)
.byte <($2C)
call0:
    lda #<(3)
ldx SP0
clc
adc PC0
sta ST0L,X
lda #<(0)
adc PC0+1
sta ST0H,X
dec SP0
lda (PC0),Y
tax
iny
lda (PC0),Y
stx PC0
sta PC0+1
jmp read_byte0
code0:
    lda #>add3c0-1
pha
lda #<(add3c0-1)
pha
lda (PC0),Y
sta IN
iny
lda (PC0),Y
sta IN+1
jmp (IN)
dmpoke0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
sta D0,X
iny
lda (PC0),Y
sta D0+1,X
lda #<(4)
jmp addc0
dspoke0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
sta S0,X
iny
lda (PC0),Y
sta S0+1,X
lda #<(4)
jmp addc0
filter0:
    lda (PC0),Y
sta filt0loop+1
iny
lda (PC0),Y
sta filt0loop+2
ldx #<(15)
filt0loop:
    lda $DDDD,X
sta CUTST,X
dex
bpl filt0loop
jmp add3c0
fload0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
sta fload0loop+1
iny
lda (PC0),Y
sta fload0loop+2
fload0loop:
    lda $DDDD,X
sta D0,X
dex
bpl fload0loop
lda #<(4)
jmp addc0
for0:
    ldx SP0
lda #<(2)
clc
adc PC0
sta ST0L,X
lda #<(0)
adc PC0+1
sta ST0H,X
lda (PC0),Y
sta ST0C,X
dec SP0
lda #<(2)
jmp addc0
freq0:
    lda (PC0),Y
sta frqpoke0+1
iny
lda (PC0),Y
sta frqpoke0+2
ldx #<(13)
frqpoke0:
    lda $DDDD,X
sta D0,X
dex
bpl frqpoke0
jmp add3c0
gotot0:
    lda (PC0),Y
sta TR0
iny
goto0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
stx PC0
sta PC0+1
jmp read_byte0
master0a:
    ldy #<(%11110001)
sty $D417
master0b:
    stx FilterChannel
lda #<(1)
jmp addc0
master0:
    ldx #<(0)
beq master0a
mbendoff0:
    lda #<(5)
.byte <($2C)
mbendon0:
    lda #<(7)
sta D0+FMC
tya
jmp addc0
mpoke0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
sta D0,X
jmp add3c0
next0:
    ldx SP0
dec ST0C+1,X
beq n0a
ldy ST0L+1,X
lda ST0H+1,X
sty PC0
sta PC0+1
jmp read_byte0
n0a:
    inc SP0
tya
jmp addc0
retsubrut0:
    ldy SP0
cpy #<(DEPTHOFSTACKS-1)
beq rc0
inc SP0
ldx ST0L+1,Y
lda ST0H+1,Y
stx PC0
sta PC0+1
jmp read_byte0
rc0:
    dec MFL0
rts
spoke0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
sta S0,X
jmp add3c0
transp0:
    lda (PC0),Y
sta TR0
lda #<(2)
jmp addc0
trigger0:
    lda trig0a
eor #<($B1)
sta trig0a
sta trig1a
sta trig2a
lda trig0b
eor #<($60)
sta trig0b
sta trig1b
sta trig2b
lda #<(1)
jmp addc0
volume0:
    lda (PC0),Y
sta IN
iny
lda (PC0),Y
sta IN+1
ldy #<(4)
vo0:
    lda (IN),Y
sta D0+VWF,Y
dey
bpl vo0
jmp add3c0

MC1:
callt1:
    lda (PC1),Y
sta TR1
iny
lda #<(4)
.byte <($2C)
call1:
    lda #<(3)
ldx SP1
clc
adc PC1
sta ST1L,X
lda #<(0)
adc PC1+1
sta ST1H,X
dec SP1
lda (PC1),Y
tax
iny
lda (PC1),Y
stx PC1
sta PC1+1
jmp read_byte1
code1:
    lda #>add3c1-1
pha
lda #<(add3c1-1)
pha
lda (PC1),Y
sta IN
iny
lda (PC1),Y
sta IN+1
jmp (IN)
dmpoke1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
sta D1,X
iny
lda (PC1),Y
sta D1+1,X
lda #<(4)
jmp addc1
dspoke1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
sta S1,X
iny
lda (PC1),Y
sta S1+1,X
lda #<(4)
jmp addc1
filter1:
    lda (PC1),Y
sta filt1loop+1
iny
lda (PC1),Y
sta filt1loop+2
ldx #<(15)
filt1loop:
    lda $DDDD,X
sta CUTST,X
dex
bpl filt1loop
jmp add3c1
fload1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
sta fload1loop+1
iny
lda (PC1),Y
sta fload1loop+2
fload1loop:
    lda $DDDD,X
sta D1,X
dex
bpl fload1loop
lda #<(4)
jmp addc1
for1:
    ldx SP1
lda #<(2)
clc
adc PC1
sta ST1L,X
lda #<(0)
adc PC1+1
sta ST1H,X
lda (PC1),Y
sta ST1C,X
dec SP1
lda #<(2)
jmp addc1
freq1:
    lda (PC1),Y
sta frqpoke1+1
iny
lda (PC1),Y
sta frqpoke1+2
ldx #<(13)
frqpoke1:
    lda $DDDD,X
sta D1,X
dex
bpl frqpoke1
jmp add3c1
goto1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
stx PC1
sta PC1+1
jmp read_byte1
master1a:
    ldy #<(%11110010)
sty $D417
master1b:
    stx FilterChannel
lda #<(1)
jmp addc1
master1:
    ldx #<(1)
bne master1a
mbendoff1:
    lda #<(5)
.byte <($2C)
mbendon1:
    lda #<(7)
sta D1+FMC
tya
jmp addc1
mpoke1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
sta D1,X
jmp add3c1
next1:
    ldx SP1
dec ST1C+1,X
beq n1a
ldy ST1L+1,X
lda ST1H+1,X
sty PC1
sta PC1+1
jmp read_byte1
n1a:
    inc SP1
tya
jmp addc1
retsubrut1:
    ldy SP1
cpy #<(DEPTHOFSTACKS-1)
beq rc1
inc SP1
ldx ST1L+1,Y
lda ST1H+1,Y
stx PC1
sta PC1+1
jmp read_byte1
rc1:
    dec MFL1
rts
transp1:
    lda (PC1),Y
sta TR1
lda #<(2)
jmp addc1
spoke1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
sta S1,X
jmp add3c1
volume1:
    lda (PC1),Y
sta IN
iny
lda (PC1),Y
sta IN+1
ldy #<(4)
vo1:
    lda (IN),Y
sta D1+VWF,Y
dey
bpl vo1
jmp add3c1

MC2:
callt2:
    lda (PC2),Y
sta TR2
iny
lda #<(4)
.byte <($2C)
call2:
    lda #<(3)
ldx SP2
clc
adc PC2
sta ST2L,X
lda #<(0)
adc PC2+1
sta ST2H,X
dec SP2
lda (PC2),Y
tax
iny
lda (PC2),Y
stx PC2
sta PC2+1
jmp read_byte2
code2:
    lda #>add3c2-1
pha
lda #<(add3c2-1)
pha
lda (PC2),Y
sta IN
iny
lda (PC2),Y
sta IN+1
jmp (IN)
dmpoke2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
sta D2,X
iny
lda (PC2),Y
sta D2+1,X
lda #<(4)
jmp addc2
dspoke2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
sta S2,X
iny
lda (PC2),Y
sta S2+1,X
lda #<(4)
jmp addc2
filter2:
    lda (PC2),Y
sta filt2loop+1
iny
lda (PC2),Y
sta filt2loop+2
ldx #<(15)
filt2loop:
    lda $DDDD,X
sta CUTST,X
dex
bpl filt2loop
jmp add3c2
fload2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
sta fload2loop+1
iny
lda (PC2),Y
sta fload2loop+2
fload2loop:
    lda $DDDD,X
sta D2,X
dex
bpl fload2loop
lda #<(4)
jmp addc2
for2:
    ldx SP2
lda #<(2)
clc
adc PC2
sta ST2L,X
lda #<(0)
adc PC2+1
sta ST2H,X
lda (PC2),Y
sta ST2C,X
dec SP2
lda #<(2)
jmp addc2
freq2:
    lda (PC2),Y
sta frqpoke2+1
iny
lda (PC2),Y
sta frqpoke2+2
ldx #<(13)
frqpoke2:
    lda $DDDD,X
sta D2,X
dex
bpl frqpoke2
jmp add3c2
goto2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
stx PC2
sta PC2+1
jmp read_byte2
disown2:
    dey
sty CUT+FMC
sty D418
ldx #<(3)
ldy #<(%11110000)
.byte <($2C)
master2a:
    ldy #<(%11110100)
sty $D417
master2b:
    stx FilterChannel
lda #<(1)
jmp addc2
master2:
    lda #<(%00010000)
sta D418
lda #<($1F)
sta $D418
ldx #<(2)
bne master2a
mbendoff2:
    lda #<(5)
.byte <($2C)
mbendon2:
    lda #<(7)
sta D2+FMC
tya
jmp addc2
mpoke2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
sta D2,X
jmp add3c2
next2:
    ldx SP2
dec ST2C+1,X
beq n2a
ldy ST2L+1,X
lda ST2H+1,X
sty PC2
sta PC2+1
jmp read_byte2
n2a:
    inc SP2
tya
jmp addc2
retsubrut2:
    ldy SP2
cpy #<(DEPTHOFSTACKS-1)
beq rc2
inc SP2
ldx ST2L+1,Y
lda ST2H+1,Y
stx PC2
sta PC2+1
jmp read_byte2
rc2:
    dec MFL2
rts
spoke2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
sta S2,X
jmp add3c2
transp2:
    lda (PC2),Y
sta TR2
lda #<(2)
jmp addc2
volume2:
    lda (PC2),Y
sta IN
iny
lda (PC2),Y
sta IN+1
ldy #<(4)
vo2:
    lda (IN),Y
sta D2+VWF,Y
dey
bpl vo2
jmp add3c2

//=====================*=== MUSIC & SOUND REFRESH ===*==========================

FILTER:
    lda CUT+FMC
beq cxit
ldx CUT+16
ldy CUT+17
clc
lda CUT+FMDLY
beq cms0+1
dec CUT+FMDLY
lda CUT+FMC
and #<(2)
bne cms3a
cxit:
    rts
cms0:
    clc
lda CUT+18
beq cms1
dec CUT+18
txa
adc CUT+FMG0
tax
tya
adc CUT+FMG0+1
jmp stcTAY
cms1:
    lda CUT+19
beq cms2
dec CUT+19
txa
adc CUT+FMG1
tax
tya
adc CUT+FMG1+1
jmp stcTAY
cms2:
    lda CUT+20
beq cms3
dec CUT+20
txa
adc CUT+FMG2
tax
tya
adc CUT+FMG2+1
jmp stcTAY
cms3:
    lda CUT+21
beq cmrep
dec CUT+21
cms3a:
    txa
adc CUT+FMG3
tax
tya
adc CUT+FMG3+1
stcTAY:
    tay
stc:
    stx CUT+16
sty CUT+17
pokecutofffrq:
    txa
and #<(7)
sta $D415
tya
stx FilterByte
lsr
ror FilterByte
lsr
ror FilterByte
lsr
lda FilterByte
ror
sta $D416
rts
cmrep:
    lda CUT+FMC
and #<($81)
beq stc
bpl nocfcopy
jsr transfercf
jmp cms0
nocfcopy:
    jsr transfercfa
jmp cms0

StartFilter:
    ldx #<(7)
SFL:
    lda CUTST+0,X
sta CUT+0,X
lda CUTST+8,X
sta CUT+8,X
dex
bpl SFL
jsr transfercf
jmp pokecutofffrq

MUSIC0:
    lda MFL0
beq mx0
dec CLOCK0
beq read_byte0
mx0:
    rts
crossedover0a:
    inc PC0+1
bne read_byte0
add3c0:
    lda #<(3)
addc0:
    clc
    adc PC0
sta PC0
bcs crossedover0a
read_byte0:
    ldy #<(0)
lda (PC0),Y
cmp #<(COM)
bcc not_control0
iny
adc #<(vt0-COM-1)
v0:
    sta v0+4
jmp (vt0)
js0:
    jmp st0
not_control0:
    sta Z8
cmp #<(R)
bcc in_du_re_0
sbc #<(R)
in_du_re_0:
    cmp #<(Rest) //@
beq js0
cmp #<(Sil)
beq got_note0
adc TR0
got_note0:
    tax //\
lda RF
and #<(1)
beq js0
NOTE0:
    lda #<(8)
trig0a:
    sta $D404
lda FilterChannel
bne nf0
stx IN
jsr StartFilter
ldx IN
nf0:
    ldy HiFrq,X
lda LoFrq,X
sta S0+FINIT
sty S0+FINIT+1
sta $D400
sty $D401
ldx D0+PINIT
ldy D0+PINIT+1
stx $D402
sty $D403
trig0b:
    bit pasttrig0
lda D0+VADV
sta $D405
lda D0+VSRV
sta $D406
lda D0+VWF
sta S0+VWFG
and #<(%11110111)
sta $D404

pasttrig0:
    jsr transferpm0a //LDX #PINIT+1
dll0: //          LDA D0,X:STA S0,X:DEX:BPL dll0:LDA S0+FMC

dlpw0:
    lda D0+PMC
sta S0+PMC
beq dlfrq0
stx S0+PINIT
sty S0+PINIT+1
stx S0PCURR
sty S0PCURR+1
lda D0+PMG1+1
sta S0+PMG1+1
lda D0+PMG1
sta S0+PMG1
lda D0+PMG0+1
sta S0+PMG0+1
lda D0+PMG0
sta S0+PMG0
lda D0+PMDLY
sta S0+PMDLY
ldx D0+PMD0
ldy D0+PMD1
stx S0+CPMD0
stx S0+PMD0C
sty S0+PMD1C
sty S0+CPMD1

dlfrq0:
    lda D0+FMC
sta S0+FMC
beq dldur0
ldx D0+12
stx S0+12
ldx D0+11
stx S0+11
ldx D0+10
stx S0+10
ldx D0+9
stx S0+9
ldx D0+8
stx S0+8
ldx D0+7
stx S0+7
ldx D0+6
stx S0+6
ldx D0+5
stx S0+5
ldx D0+4
stx S0+4
ldx D0+3
stx S0+3
ldx D0+2
stx S0+2
ldx D0+1
stx S0+1
ldx D0+0
stx S0+0

and #<(8)
beq no_of_li_mo0
lda Z8
cmp #<(R)
bcc in_du_re0a
sbc #<(R-1)
in_du_re0a:
    adc TR0
sta S0+FOLB
bne dldur0
no_of_li_mo0:
    jsr transferf0
dldur0:
    ldx D0+VADSD
ldy D0+VRD
stx S0+VADSC
sty S0+VRC
st0:
    ldy #<(1)
lda (PC0),Y
ldx Z8
cpx #<(R)
bcs di_du_re0
tax
lda IDRT-1,X
di_du_re0:
    sta CLOCK0
lda #<(2)
addn0:
    clc
    adc PC0
sta PC0
bcs crossedover0b
rts
crossedover0b:
    inc PC0+1
rts

MUSIC1:
    lda MFL1
beq mx1
dec CLOCK1
beq read_byte1
mx1:
    rts
crossedover1a:
    inc PC1+1
bne read_byte1
add3c1:
    lda #<(3)
addc1:
    clc
    adc PC1
sta PC1
bcs crossedover1a
read_byte1:
    ldy #<(0)
lda (PC1),Y
cmp #<(COM)
bcc not_ctrl1
iny
adc #<(vt1-COM-1)
v1:
    sta v1+4
jmp (vt1)
js1:
    jmp st1
not_ctrl1:
    sta Z8
cmp #<(R)
bcc in_du_re1
sbc #<(R)
in_du_re1:
    cmp #<(Rest) //@
beq js1
cmp #<(Sil)
beq got_note1
adc TR1
got_note1:
    tax //\
lda RF
and #<(2)
beq js1
NOTE1:
    lda #<(8)
trig1a:
    sta $D40B
ntb1:
    lda FilterChannel
cmp #<(1)
bne nf1
stx IN
jsr StartFilter
ldx IN
nf1:
    ldy HiFrq,X
lda LoFrq,X
sta S1+FINIT
sty S1+FINIT+1
sta $D407
sty $D408
ldx D1+PINIT
ldy D1+PINIT+1
stx $D409
sty $D40A
trig1b:
    bit pasttrig1
lda D1+VADV
sta $D40C
lda D1+VSRV
sta $D40D
lda D1+VWF
sta S1+VWFG
and #<(%11110111)
sta $D40B

pasttrig1:
    jsr transferpm1a //LDX #PINIT+1
dll1: //          LDA D1,X:STA S1,X:DEX:BPL dll1:LDA S1+FMC

dlpw1:
    lda D1+PMC
sta S1+PMC
beq dlfrq1
stx S1+PINIT
sty S1+PINIT+1
stx S1PCURR
sty S1PCURR+1
lda D1+PMG1+1
sta S1+PMG1+1
ldx D1+PMG1
stx S1+PMG1
lda D1+PMG0+1
sta S1+PMG0+1
lda D1+PMG0
sta S1+PMG0
lda D1+PMDLY
sta S1+PMDLY
ldx D1+PMD0
ldy D1+PMD1
stx S1+CPMD0
stx S1+PMD0C
sty S1+CPMD1
sty S1+PMD1C

dlfrq1:
    lda D1+FMC
sta S1+FMC
beq dldur1
ldx D1+12
stx S1+12
ldx D1+11
stx S1+11
ldx D1+10
stx S1+10
ldx D1+9
stx S1+9
ldx D1+8
stx S1+8
ldx D1+7
stx S1+7
ldx D1+6
stx S1+6
ldx D1+5
stx S1+5
ldx D1+4
stx S1+4
ldx D1+3
stx S1+3
ldx D1+2
stx S1+2
ldx D1+1
stx S1+1
ldx D1+0
stx S1+0

and #<(8)
beq no_of_li_mo1
lda Z8
cmp #<(R)
bcc in_du_re1a
sbc #<(R-1)
in_du_re1a:
    adc TR1
sta S1+FOLB
bne dldur1
no_of_li_mo1:
    jsr transferf1
dldur1:
    ldx D1+VADSD
ldy D1+VRD
stx S1+VADSC
sty S1+VRC
st1:
    ldy #<(1)
lda (PC1),Y
ldx Z8
cpx #<(R)
bcs di_du_re1
tax
lda IDRT-1,X
di_du_re1:
    sta CLOCK1
lda #<(2)
addn1:
    clc
    adc PC1
sta PC1
bcs crossedover1b
rts
crossedover1b:
    inc PC1+1
rts

MUSIC2:
    lda MFL2
beq mx2
dec CLOCK2
beq read_byte2
mx2:
    rts
crossedover2a:
    inc PC2+1
bne read_byte2
add3c2:
    lda #<(3)
addc2:
    clc
    adc PC2
sta PC2
bcs crossedover2a
read_byte2:
    ldy #<(0)
lda (PC2),Y
cmp #<(COM)
bcc not_ctrl2
iny
adc #<(vt2-COM-1)
v2:
    sta v2+4
jmp (vt2)
js2:
    jmp st2
not_ctrl2:
    sta Z8
cmp #<(R)
bcc in_du_re2
sbc #<(R)
in_du_re2:
    cmp #<(Rest) //@
beq js2
cmp #<(Sil)
beq got_note2
adc TR2
got_note2:
    tax //\
lda RF
and #<(4)
beq js2
NOTE2:
    lda #<(8)
trig2a:
    sta $D412
ntb2:
    lda FilterChannel
cmp #<(2)
bne nf2
stx IN
jsr StartFilter
ldx IN
nf2:
    ldy HiFrq,X
lda LoFrq,X
sta S2+FINIT
sty S2+FINIT+1
sta $D40E
sty $D40F
ldx D2+PINIT
ldy D2+PINIT+1
stx $D410
sty $D411
trig2b:
    bit pasttrig2
lda D2+VADV
sta $D413
lda D2+VSRV
sta $D414
lda D2+VWF
sta S2+VWFG
and #<(%11110111)
sta $D412

pasttrig2:
    jsr transferpm2a //LDX #PINIT+1
dll2: //          LDA D2,X:STA S2,X:DEX:BPL dll2:LDA S2+FMC

dlpw2:
    lda D2+PMC
sta S2+PMC
beq dlfrq2
stx S2+PINIT
sty S2+PINIT+1
stx S2PCURR
sty S2PCURR+1
lda D2+PMG1+1
sta S2+PMG1+1
lda D2+PMG1
sta S2+PMG1
lda D2+PMG0+1
sta S2+PMG0+1
lda D2+PMG0
sta S2+PMG0
lda D2+PMDLY
sta S2+PMDLY
ldx D2+PMD0
ldy D2+PMD1
stx S2+CPMD0
stx S2+PMD0C
sty S2+CPMD1
sty S2+PMD1C

dlfrq2:
    lda D2+FMC
sta S2+FMC
beq dldur2
ldx D2+12
stx S2+12
ldx D2+11
stx S2+11
ldx D2+10
stx S2+10
ldx D2+9
stx S2+9
ldx D2+8
stx S2+8
ldx D2+7
stx S2+7
ldx D2+6
stx S2+6
ldx D2+5
stx S2+5
ldx D2+4
stx S2+4
ldx D2+3
stx S2+3
ldx D2+2
stx S2+2
ldx D2+1
stx S2+1
ldx D2+0
stx S2+0

and #<(8)
beq no_of_li_mo2
lda Z8
cmp #<(R)
bcc in_du_re2a
sbc #<(R-1)
in_du_re2a:
    adc TR2
sta S2+FOLB
bne dldur2
no_of_li_mo2:
    jsr transferf2
dldur2:
    ldx D2+VADSD
ldy D2+VRD
stx S2+VADSC
sty S2+VRC
st2:
    ldy #<(1)
lda (PC2),Y
ldx Z8
cpx #<(R)
bcs di_du_re2
tax
lda IDRT-1,X
di_du_re2:
    sta CLOCK2
lda #<(2)
addn2:
    clc
    adc PC2
sta PC2
bcs crossedover2b
rts
crossedover2b:
    inc PC2+1
nosound0:
    rts

SOUND0:
    ldx S0+VRC
beq nosound0
lda S0+VWFG
and #<(8)
beq adsr0
lda CLOCK0
cmp S0+VADSC
bcs PM0
lda #<(0)
sta S0+VADSC
lda S0+VWFG
and #<(%11110110)
sta S0+VWFG
bne trigrel0
adsr0:
    lda S0+VADSC
bne ad0
ldy S0+VRC
iny
beq PM0
dec S0+VRC
bne PM0
ldx #<(6)
cc0:
    sta $D400,X //STX SFL0;[
dex
bpl cc0
CheckFilter:
    cmp FilterChannel
bne nosound0
inx
stx CUT+FMC
rts
ad0:
    ldy S0+VADSC
iny
beq PM0
dec S0+VADSC
bne PM0
lda S0+VWFG
and #<(246)
trigrel0:
    sta $D404
PM0:
    lda S0+PMC
beq FM0
lda S0FCURR //@
ora S0FCURR+1
beq FM0
lda S0+PMDLY
beq pmdel0
dec S0+PMDLY
jmp FM0
pmdel0:
    clc
ldx S0PCURR
ldy S0PCURR+1
pms00:
    lda S0+PMD0C
beq pms10
dec S0+PMD0C
txa
adc S0+PMG0
tax
tya
adc S0+PMG0+1
tay
jmp stpm0
pms10:
    lda S0+PMD1C
beq pmrep0
dec S0+PMD1C
txa
adc S0+PMG1
tax
tya
adc S0+PMG1+1
tay
jmp stpm0
pmrep0:
    lda S0+PMC
and #<($81)
beq stpm0
bpl nopmcopy0
jsr transferpm0
jmp pmdel0
nopmcopy0:
    jsr transferpm0a
jmp pmdel0
stpm0:
    stx S0PCURR
sty S0PCURR+1
stx $D402
sty $D403
FM0:
    lda S0+FMC
beq xit0
and #<(8) //]
bne olm0
lda S0FCURR //@
ora S0FCURR+1
beq xit0
ldx S0FCURR
ldy S0FCURR+1
clc
lda S0+FMDLY
beq fcs10+1
dec S0+FMDLY
lda S0+FMC
and #<(2)
bne fcs40l1
xit0:
    rts
olm0:
    dec S0+FOLDC //]
bne xit0
ldy S0+FOLOD
sty S0+FOLDC
ldy S0+FOLCI
bpl no0
ldy S0+FOLII
no0:
    ldx S0+FOLA
stx IN
ldx S0+FOLA+1
stx IN+1
lda S0+FOLB
clc
adc (IN),Y
dey
sty S0+FOLCI
tay
POKEFRQ0:
    ldx LoFrq,Y
lda HiFrq,Y
stx $D400
sta $D401
rts
fcs10:
    clc
lda S0+FMD0C
beq fcs20
dec S0+FMD0C
txa
adc S0+FMG0
tax
tya
adc S0+FMG0+1
jmp stf0TAY
fcs20:
    lda S0+FMD1C
beq fcs30
dec S0+FMD1C
txa
adc S0+FMG1
tax
tya
adc S0+FMG1+1
jmp stf0TAY
fcs30:
    lda S0+FMD2C
beq fcs40
dec S0+FMD2C
txa
adc S0+FMG2
tax
tya
adc S0+FMG2+1
jmp stf0TAY
fcs40:
    lda S0+FMD3C
beq fcrep0
dec S0+FMD3C
fcs40l1:
    txa
adc S0+FMG3
tax
tya
adc S0+FMG3+1
stf0TAY:
    tay
stf0:
    stx $D400
sty $D401
stx S0FCURR
sty S0FCURR+1
nosound1:
    rts
fcrep0:
    lda S0+FMC
and #<($81)
beq stf0
bpl nofrqcopy0
jsr transferf0
jmp fcs10
nofrqcopy0:
    jsr transferf0a
jmp fcs10

SOUND1:
    ldx S1+VRC
beq nosound1
lda S1+VWFG
and #<(8)
beq adsr1
lda CLOCK1
cmp S1+VADSC
bcs PM1
lda #<(0)
sta S1+VADSC
lda S1+VWFG
and #<(%11110110)
sta S1+VWFG
bne trigrel1
adsr1:
    lda S1+VADSC
bne ad1
ldy S1+VRC
iny
beq PM1
dec S1+VRC
bne PM1
ldx #<(6)
cc1:
    sta $D407,X //STX SFL1;[
dex
bpl cc1
lda #<(1)
jmp CheckFilter
ad1:
    ldy S1+VADSC
iny
beq PM1
dec S1+VADSC
bne PM1
lda S1+VWFG
and #<(246)
trigrel1:
    sta $D40B
PM1:
    lda S1+PMC
beq FM1
lda S1FCURR //@
ora S1FCURR+1
beq FM1
lda S1+PMDLY
beq pmdel1
dec S1+PMDLY
jmp FM1
pmdel1:
    clc
ldx S1PCURR
ldy S1PCURR+1
pms01:
    lda S1+PMD0C
beq pms11
txa
adc S1+PMG0
tax
tya
adc S1+PMG0+1
tay
dec S1+PMD0C
jmp stpm1
pms11:
    lda S1+PMD1C
beq pmrep1
txa
adc S1+PMG1
tax
tya
adc S1+PMG1+1
tay
dec S1+PMD1C
jmp stpm1
pmrep1:
    lda S1+PMC
and #<($81)
beq stpm1
bpl nopmcopy1
jsr transferpm1
jmp pmdel1
nopmcopy1:
    jsr transferpm1a
jmp pmdel1
stpm1:
    stx S1PCURR
sty S1PCURR+1
stx $D409
sty $D40A
FM1:
    lda S1+FMC
beq xit1
and #<(8) //]
bne olm1
lda S1FCURR //@
ora S1FCURR+1
beq xit1
ldx S1FCURR
ldy S1FCURR+1
clc
lda S1+FMDLY
beq fcs11+1
dec S1+FMDLY
lda S1+FMC
and #<(2)
bne fcs41l1
xit1:
    rts
olm1:
    dec S1+FOLDC //]
bne xit1
ldy S1+FOLOD
sty S1+FOLDC
ldy S1+FOLCI
bpl no1
ldy S1+FOLII
no1:
    ldx S1+FOLA
stx IN
ldx S1+FOLA+1
stx IN+1
lda S1+FOLB
clc
adc (IN),Y
dey
sty S1+FOLCI
tay
POKEFRQ1:
    ldx LoFrq,Y
lda HiFrq,Y
stx $D407
sta $D408
rts
fcs11:
    clc
lda S1+FMD0C
beq fcs21
dec S1+FMD0C
txa
adc S1+FMG0
tax
tya
adc S1+FMG0+1
jmp stf1TAY
fcs21:
    lda S1+FMD1C
beq fcs31
dec S1+FMD1C
txa
adc S1+FMG1
tax
tya
adc S1+FMG1+1
jmp stf1TAY
fcs31:
    lda S1+FMD2C
beq fcs41
dec S1+FMD2C
txa
adc S1+FMG2
tax
tya
adc S1+FMG2+1
jmp stf1TAY
fcs41:
    lda S1+FMD3C
beq fcrep1
dec S1+FMD3C
fcs41l1:
    txa
adc S1+FMG3
tax
tya
adc S1+FMG3+1
stf1TAY:
    tay
stf1:
    stx $D407
sty $D408
stx S1FCURR
sty S1FCURR+1
nosound2:
    rts
fcrep1:
    lda S1+FMC
and #<($81)
beq stf1
bpl nofrqcopy1
jsr transferf1
jmp fcs11
nofrqcopy1:
    jsr transferf1a
jmp fcs11

SOUND2:
    ldx S2+VRC
beq nosound2
lda S2+VWFG
and #<(8)
beq adsr2
lda CLOCK2
cmp S2+VADSC
bcs PM2
lda #<(0)
sta S2+VADSC
lda S2+VWFG
and #<(%11110110)
sta S2+VWFG
bne trigrel2
adsr2:
    lda S2+VADSC
bne ad2
ldy S2+VRC
iny
beq PM2
dec S2+VRC
bne PM2
ldx #<(6)
cc2:
    sta $D40E,X //STX SFL2;[
dex
bpl cc2
lda #<(2)
jmp CheckFilter
ad2:
    ldy S2+VADSC
iny
beq PM2
dec S2+VADSC
bne PM2
lda S2+VWFG
and #<(246)
trigrel2:
    sta $D412
PM2:
    lda S2+PMC
beq FM2
lda S2FCURR //@
ora S2FCURR+1
beq FM2
lda S2+PMDLY
beq pmdel2
dec S2+PMDLY
jmp FM2
pmdel2:
    clc
ldx S2PCURR
ldy S2PCURR+1
pms02:
    lda S2+PMD0C
beq pms12
dec S2+PMD0C
txa
adc S2+PMG0
tax
tya
adc S2+PMG0+1
tay
jmp stpm2
pms12:
    lda S2+PMD1C
beq pmrep2
dec S2+PMD1C
txa
adc S2+PMG1
tax
tya
adc S2+PMG1+1
tay
jmp stpm2
pmrep2:
    lda S2+PMC
and #<($81)
beq stpm2
bpl nopmcopy2
jsr transferpm2
jmp pmdel2
nopmcopy2:
    jsr transferpm2a
jmp pmdel2
stpm2:
    stx S2PCURR
sty S2PCURR+1
stx $D410
sty $D411
FM2:
    lda S2+FMC
beq xit2
and #<(8) //]
bne olm2
lda S2FCURR //@
ora S2FCURR+1
beq xit2
ldx S2FCURR
ldy S2FCURR+1
clc
lda S2+FMDLY
beq fcs12+1
dec S2+FMDLY
lda S2+FMC
and #<(2)
bne fcs42l1
xit2:
    rts
olm2:
    dec S2+FOLDC //]
bne xit2
ldy S2+FOLOD
sty S2+FOLDC
ldy S2+FOLCI
bpl no2
ldy S2+FOLII
no2:
    ldx S2+FOLA
stx IN
ldx S2+FOLA+1
stx IN+1
lda S2+FOLB
clc
adc (IN),Y
dey
sty S2+FOLCI
tay
POKEFRQ2:
    ldx LoFrq,Y
lda HiFrq,Y
stx $D40E
sta $D40F
rts
fcs12:
    clc
lda S2+FMD0C
beq fcs22
dec S2+FMD0C
txa
adc S2+FMG0
tax
tya
adc S2+FMG0+1
jmp stf2TAY
fcs22:
    lda S2+FMD1C
beq fcs32
dec S2+FMD1C
txa
adc S2+FMG1
tax
tya
adc S2+FMG1+1
jmp stf2TAY
fcs32:
    lda S2+FMD2C
beq fcs42
dec S2+FMD2C
txa
adc S2+FMG2
tax
tya
adc S2+FMG2+1
jmp stf2TAY
fcs42:
    lda S2+FMD3C
beq fcrep2
dec S2+FMD3C
fcs42l1:
    txa
adc S2+FMG3
tax
tya
adc S2+FMG3+1
stf2TAY:
    tay
stf2:
    stx $D40E
sty $D40F
stx S2FCURR
sty S2FCURR+1
rts
fcrep2:
    lda S2+FMC
and #<($81)
beq stf2
bpl nofrqcopy2
jsr transferf2
jmp fcs12
nofrqcopy2:
    jsr transferf2a
jmp fcs12

MUSICTEST:
    lda MFL0
ora MFL1
ora MFL2
ora S0+VRC
ora S1+VRC
ora S2+VRC
rts

//==============================================================================

//Game Over percussion program starts here

.label NMI = $0107
.label StacksDepth = 4

.label bass = $81
.label snare = $82
.label tomhi = $83
.label cowbell = $84
.label tomlo = $85
.label hihat = $86
.label Drest = $87
.label tube4 = $88
.label Dcowbell = $89

.label ZERO = $0050
.label seqPC = ZERO+0 //2
.label seqCLK = ZERO+2 //1
.label seqSP = ZERO+3 //1
.label synwksp = ZERO+4 //1

PLEY:
    lda DRUMFLAG
beq exit
lda #<(0)
sta DRUMFLAG
sta synwksp
sta BDR
DRMvc:
    jmp $DDDD
DRMret:
    lda #<(15)
ora D418
sta $D418
lda #<(12)
sta BDR
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
bcc nodadd
inc seqPC+1
nodadd:
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
jmp DRMret

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
jmp DRMret

TOMlow:
    ldy #<(5)
Y1:
    ldx #<(25)
Y2:
    lda TOMloTABLE,Y
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
jmp DRMret

TUBE4:
    ldy #<(5)
O1:
    ldx #<(55)
O2:
    lda TUBE4TABLE,Y
O3:
    sec
    sbc #<(1)
bne O3
lda synwksp
clc
adc #<(13)
sta synwksp
and #<(15)
sta $D418
dex
bne O2
dey
bpl O1
jmp DRMret

TOMhiTABLE:
    .byte <(32), <(16), <(8), <(4), <(2), <(1)
TOMloTABLE:
    .byte <(35), <(20), <(12), <(9), <(6), <(3)
TUBE4TABLE:
    .byte <(46), <(23), <(12), <(6), <(3), <(1)
HIHATTABLE:
    .byte <(60), <(10), <(40), <(10), <(20), <(10)
DRUMCONTROLS:
    .byte <($20), <($40), <($60), <($49), <($4C) //JSR, RTI, RTS, EOR & JMP!
CNTRLVCSl:
    .byte <(DRUMJSR), <(DRUMNEXT), <(DESTK), <(DRUMFoR), <(DRUMJMP)
CNTRLVCSh:
    .byte >(DRUMJSR), >(DRUMNEXT), >(DESTK), >(DRUMFoR), >(DRUMJMP)
VCTRSlow:
    .byte <(BASSDRUM), <(SNAREDRUM), <(TOMhig), <(COWBELL), <(TOMlow), <(HIHAT), <(DRMret), <(TUBE4)
.byte <(DCOWBELL)
VCTRShigh:
    .byte >(BASSDRUM), >(SNAREDRUM), >(TOMhig), >(COWBELL), >(TOMlow), >(HIHAT), >(DRMret), >(TUBE4)
.byte >(DCOWBELL)

DRUMFLAG:
    .byte <(0)
STKLOW:
    .fill StacksDepth, 0
STKHIGH:
    .fill StacksDepth, 0
STKCNT:
    .fill StacksDepth, 0

//===================== TITLE SCREEN DRUM DATA =================================

.label D = 3

DTL4:
    .byte <(tomlo), <(2), <(tomlo), <(4*D-2)
rts
DTL2:
    .byte <(tomlo), <(2), <(tomlo), <(2*D-2)
rts
DTH2:
    .byte <(tomhi), <(2), <(tomhi), <(2*D-2)
rts
DT42:
    .byte <(tube4), <(2), <(tube4), <(2*D-2)
rts
DHH2:
    .byte <(hihat), <(2), <(hihat), <(2*D-2)
rts
DCB2:
    .byte <(cowbell), <(2*D), <(cowbell), <(2*D)
rts
DBD2:
    .byte <(bass), <(2*D), <(bass), <(2*D)
rts
DSN2:
    .byte <(snare), <(2*D), <(snare), <(2*D)
rts
THT2:
    .byte <(tomhi), <(2*D), <(hihat), <(2*D), <(tomhi), <(2*D)
rts
TDS0:
    eor #<(6)
jsr DCB2
.byte <(tomhi), <(2*D), <(cowbell), <(2*D), <(snare), <(2*D), <(cowbell), <(2*D), <(tomhi), <(2*D)
.byte <(cowbell), <(2*D)
rti
rts
TDS1:
    .byte <(bass), <(2*D), <(cowbell), <(2*D), <(bass), <(2*D)
jsr DCB2
.byte <(bass), <(2*D), <(tomhi), <(2*D)
jsr DBD2
jsr DBD2
jsr DCB2
jsr DBD2
.byte <(cowbell), <(2*D)
rts
TDS2:
    jsr TDS0
jsr DCB2
.byte <(tomhi), <(2*D), <(cowbell), <(2*D), <(snare), <(2*D), <(bass), <(2*D), <(tomhi), <(2*D), <(bass), <(2*D)
.byte <(cowbell), <(2*D), <(bass), <(2*D), <(tomhi), <(2*D), <(cowbell), <(2*D), <(bass), <(8*D)
TDS2a:
    jsr TDS0
jsr DCB2
.byte <(tomhi), <(2*D), <(cowbell), <(2*D), <(snare), <(2*D), <(tube4), <(2*D), <(tomhi), <(2*D), <(tube4), <(2*D)
.byte <(cowbell), <(2*D), <(tube4), <(2*D), <(tomhi), <(2*D), <(cowbell), <(2*D), <(tube4), <(8*D)
rts
TDS3:
    .byte <(bass), <(14*D)
jsr DTL2
jsr DTL4
jsr DTL4
.byte <(Drest), <(2*D)
jsr DTL4
jsr DTL2
jsr DTL4
.byte <(Drest), <(10*D)
jsr DTL2
jsr DTL4
jmp DTL4
TDS4:
    eor #<(16)
.byte <(cowbell), <(2*D), <(cowbell), <(2*D)
jsr DTH2
.byte <(cowbell), <(2*D)
rti
rts
TDS5:
    .byte <(cowbell), <(2*D), <(tomhi), <(4*D), <(tomhi), <(2*D)
rts

DRUMDATA:
    eor #<(64)
.byte <(Drest), <(15)
rti
.byte <(Drest), <(8)
jsr TDS4
jsr TDS2
eor #<(2)
jsr TDS1
jsr DT42
.byte <(cowbell), <(2*D), <(tomhi), <(2*D)
jsr DT42
jsr DCB2
jsr DT42
jsr DT42
.byte <(cowbell), <(2*D)
jsr DT42
.byte <(tomhi), <(2*D), <(cowbell), <(2*D)
jsr DT42
.byte <(cowbell), <(2*D), <(snare), <(2*D), <(cowbell), <(2*D)
jsr TDS1
jsr DT42
.byte <(cowbell), <(2*D), <(tomhi), <(2*D)
jsr DT42
jsr DCB2
jsr DT42
jsr DT42
.byte <(cowbell), <(2*D), <(snare), <(2*D), <(tomhi), <(2*D), <(cowbell), <(2*D), <(snare), <(2*D)
.byte <(cowbell), <(2*D), <(tomhi), <(2*D), <(cowbell), <(2*D)
rti
jsr TDS2
eor #<(2)
jsr TDS3
jsr DTL2
jsr DTL4
jsr DTL2
jsr TDS3
.byte <(snare), <(2*D)
jsr DTL4
jsr DTL2
rti
.byte <(bass), <(64*D), <(Drest), <(64*D), <(Drest), <(64*D), <(Drest), <(32*D), <(bass), <(4*D), <(snare), <(2*D)
jsr DCB2
.byte <(snare), <(2*D)
jsr DTH2
.byte <(cowbell), <(2*D), <(snare), <(2*D), <(cowbell), <(2*D), <(snare), <(2*D), <(cowbell), <(2*D)
jsr DSN2
.byte <(snare), <(4*D), <(tomhi), <(2), <(tomhi), <(2), <(tomhi), <(6*D-4), <(cowbell), <(2), <(cowbell), <(2)
.byte <(cowbell), <(6*D-4), <(tomlo), <(2), <(tomlo), <(2), <(tomlo), <(6*D-4), <(snare), <(2), <(snare), <(2)
.byte <(snare), <(6*D-4), <(tube4), <(2), <(tube4), <(2), <(tube4), <(8*D-4)
jsr TDS0
jsr DCB2
.byte <(bass), <(2*D), <(cowbell), <(2*D), <(snare), <(2*D), <(cowbell), <(2*D), <(bass), <(2*D)
.byte <(cowbell), <(2*D)
jsr DBD2
.byte <(tomhi), <(2*D), <(bass), <(2*D), <(bass), <(8*D)
jsr TDS2a
eor #<(2)
eor #<(7)
.byte <(Dcowbell), <(8*D)
rti
jsr TDS5
eor #<(6)
.byte <(Dcowbell), <(8*D)
rti
jsr TDS5
jsr TDS5
rti
eor #<(2)
eor #<(3)
.byte <(Dcowbell), <(2*D)
jsr THT2
rti
eor #<(4)
.byte <(Dcowbell), <(8*D)
rti
jsr TDS5
eor #<(3)
.byte <(Dcowbell), <(2*D)
jsr THT2
rti
eor #<(3)
.byte <(Dcowbell), <(8*D)
rti
jsr TDS5
jsr TDS5
rti
eor #<(4)
eor #<(7)
.byte <(Dcowbell), <(2*D)
jsr THT2
rti
jsr TDS5
eor #<(6)
.byte <(Dcowbell), <(2*D)
jsr THT2
rti
jsr TDS5
jsr TDS5
rti
eor #<(2)
eor #<(7)
.byte <(bass), <(2*D)
jsr THT2
rti
jsr TDS5
eor #<(6)
.byte <(bass), <(2*D)
jsr THT2
rti
jsr TDS5
jsr TDS5
rti
eor #<(2)
eor #<(3)
.byte <(bass), <(2*D)
jsr THT2
.byte <(snare), <(2*D)
jsr THT2
rti
jsr TDS5
jsr TDS5
eor #<(6)
.byte <(bass), <(2*D)
jsr DTH2
jsr DHH2
jsr DTH2
rti
jsr TDS5
jsr TDS5
rti
eor #<(4)
eor #<(7)
.byte <(bass), <(2*D)
jsr THT2
.byte <(snare), <(2*D)
jsr THT2
rti
.byte <(bass), <(2*D), <(tomhi), <(2*D), <(hihat), <(2*D)
jsr DSN2
.byte <(tomhi), <(2*D)
jsr DSN2
rti

eor #<(2)
eor #<(3)
.byte <(bass), <(2*D), <(tomhi), <(2*D), <(cowbell), <(2*D), <(tomhi), <(2*D), <(snare), <(2*D), <(tomhi), <(2*D)
.byte <(cowbell), <(2*D), <(tomhi), <(2*D), <(bass), <(2*D), <(cowbell), <(2*D), <(hihat), <(2*D)
.byte <(cowbell), <(2*D), <(snare), <(2*D)
jsr DCB2
.byte <(tomhi), <(2*D)
rti
.byte <(bass), <(2*D), <(tomhi), <(2*D), <(cowbell), <(2*D), <(tomhi), <(2*D), <(snare), <(2*D), <(tomhi), <(2*D)
.byte <(cowbell), <(2*D), <(tomhi), <(2*D), <(bass), <(2*D), <(cowbell), <(2*D), <(hihat), <(2*D)
jsr DSN2
.byte <(cowbell), <(2*D)
jsr DSN2
rti

DX:
    eor #<(2)
eor #<(3)
.byte <(bass), <(4*D), <(cowbell), <(4*D), <(snare), <(4*D)
jsr DCB2
.byte <(bass), <(2*D), <(cowbell), <(4*D), <(cowbell), <(2*D)
.byte <(snare), <(2*D), <(cowbell), <(2*D), <(cowbell), <(4*D)
rti
.byte <(bass), <(4*D)
jsr DCB2
.byte <(snare), <(4*D)
jsr DCB2
.byte <(bass), <(2*D)
.byte <(cowbell), <(4*D)
jsr DSN2
.byte <(cowbell), <(2*D)
jsr DSN2
rti

eor #<(18)
.byte <(Drest), <(32*D)
rti
.byte <(Drest), <(1)
jmp DRUMDATA

//========================== BASS DRUM ROUTINE =================================

BASSDRUM:
    ldx #<(0)
BD1:
    lda ROCKBASS+256*0,X
lsr
lsr
lsr
lsr
jsr DBD
lda ROCKBASS+256*0,X
nop
nop
nop
and #<(15)
jsr DBD
inx
bne BD1
jmp DRMret

DBD:
    sta $D418
ldy #<(16)
DBD1:
    dey
bpl DBD1
rts

ROCKBASS:
    .byte <($00), <($00), <($00), <($00), <($23), <($56), <($7A), <($AE) //256 bytes, speed 20
.byte <($BE), <($EE), <($EE), <($FE), <($ED), <($DB), <($AA), <($77)
.byte <($65), <($44), <($44), <($33), <($44), <($46), <($66), <($77)
.byte <($78), <($77), <($76), <($55), <($43), <($20), <($00), <($00)
.byte <($00), <($00), <($00), <($02), <($22), <($44), <($56), <($66)
.byte <($78), <($88), <($8A), <($AA), <($AA), <($AA), <($AA), <($AA)
.byte <($AA), <($88), <($76), <($66), <($55), <($56), <($32), <($22)
.byte <($20), <($20), <($00), <($00), <($02), <($02), <($02), <($22)
.byte <($34), <($34), <($56), <($56), <($66), <($66), <($56), <($66)
.byte <($66), <($66), <($77), <($78), <($AA), <($AB), <($AA), <($EA)
.byte <($BB), <($BD), <($BB), <($A8), <($A6), <($63), <($62), <($32)
.byte <($33), <($22), <($22), <($10), <($22), <($22), <($42), <($43)
.byte <($54), <($55), <($66), <($64), <($46), <($65), <($65), <($65)
.byte <($66), <($66), <($76), <($78), <($8A), <($7A), <($88), <($97)
.byte <($77), <($76), <($66), <($62), <($42), <($22), <($02), <($22)
.byte <($22), <($23), <($33), <($45), <($66), <($56), <($77), <($78)
.byte <($8A), <($8A), <($AA), <($AA), <($AA), <($AA), <($A8), <($88)
.byte <($77), <($66), <($65), <($64), <($43), <($32), <($20), <($00)
.byte <($00), <($00), <($00), <($23), <($34), <($67), <($7A), <($AB)
.byte <($BB), <($BD), <($BB), <($EB), <($DB), <($DB), <($BA), <($BA)
.byte <($A7), <($87), <($76), <($65), <($33), <($22), <($22), <($22)
.byte <($22), <($22), <($22), <($22), <($12), <($22), <($21), <($22)
.byte <($32), <($22), <($44), <($66), <($67), <($88), <($AA), <($AA)
.byte <($AA), <($BA), <($AB), <($AA), <($AA), <($AA), <($AA), <($AA)
.byte <($A8), <($A7), <($9A), <($77), <($A7), <($76), <($66), <($44)
.byte <($43), <($24), <($22), <($22), <($22), <($02), <($22), <($33)
.byte <($35), <($55), <($66), <($76), <($67), <($77), <($47), <($65)
.byte <($77), <($A6), <($97), <($A8), <($AA), <($AA), <($BB), <($AA)
.byte <($9A), <($98), <($A7), <($77), <($67), <($76), <($77), <($67)
.byte <($67), <($68), <($67), <($67), <($06), <($53), <($22), <($42)
.byte <($33), <($12), <($22), <($22), <($03), <($22), <($23), <($44)
.byte <($55), <($77), <($A8), <($AB), <($BB), <($BE), <($DE), <($DD)

//========================= SNARE DRUM ROUTINE =================================

SNAREDRUM:
    ldx #<(0)
SN1:
    lda ROCKSNARE+256*0,X
lsr
lsr
lsr
lsr
jsr DSN
lda ROCKSNARE+256*0,X
nop
nop
nop
and #<(15)
jsr DSN
inx
bne SN1
SN2:
    lda ROCKSNARE+256*1,X
lsr
lsr
lsr
lsr
jsr DSN
lda ROCKSNARE+256*1,X
nop
nop
nop
and #<(15)
jsr DSN
inx
bne SN2
SN1A:
    lda ROCKSNARE+256*0,X
lsr
lsr
lsr
lsr
jsr DSN
lda ROCKSNARE+256*0,X
nop
nop
nop
and #<(15)
jsr DSN
inx
bne SN1A
SN2A:
    lda ROCKSNARE+256*1,X
lsr
lsr
lsr
lsr
jsr DSN
lda ROCKSNARE+256*1,X
nop
nop
nop
and #<(15)
jsr DSN
inx
bne SN2A
jmp DRMret

DSN:
    sta $D418
ldy #<(3)
DSN1:
    dey
bpl DSN1
rts

ROCKSNARE:
    .byte <($47), <($78), <($87), <($88), <($88), <($88), <($87), <($80) //512 bytes, speed 8
.byte <($24), <($33), <($34), <($27), <($80), <($05), <($E2), <($F0)
.byte <($FB), <($AF), <($FF), <($FF), <($FF), <($FF), <($FD), <($CB)
.byte <($A8), <($95), <($95), <($54), <($57), <($14), <($73), <($14)
.byte <($23), <($10), <($00), <($00), <($00), <($00), <($00), <($00)
.byte <($00), <($11), <($24), <($56), <($AA), <($DF), <($FF), <($FF)
.byte <($FF), <($FF), <($FF), <($FF), <($FF), <($FF), <($FF), <($FF)
.byte <($FE), <($FF), <($BD), <($B8), <($75), <($53), <($11), <($00)
.byte <($00), <($00), <($00), <($00), <($00), <($00), <($00), <($00)
.byte <($00), <($00), <($91), <($49), <($7F), <($CF), <($FF), <($FF)
.byte <($FF), <($FF), <($FF), <($FF), <($F9), <($FD), <($AA), <($CC)
.byte <($7B), <($AC), <($AA), <($69), <($49), <($46), <($E4), <($A7)
.byte <($68), <($53), <($24), <($11), <($30), <($20), <($10), <($10)
.byte <($10), <($36), <($39), <($28), <($64), <($D8), <($B8), <($F4)
.byte <($B6), <($B8), <($58), <($88), <($78), <($9B), <($AD), <($CC)
.byte <($EE), <($CD), <($EF), <($BE), <($9F), <($B9), <($CD), <($8C)
.byte <($BB), <($B8), <($86), <($B6), <($87), <($78), <($46), <($31)
.byte <($93), <($62), <($70), <($27), <($52), <($15), <($55), <($47)
.byte <($20), <($57), <($33), <($02), <($4A), <($67), <($3A), <($97)
.byte <($4A), <($89), <($7F), <($9F), <($FD), <($DF), <($DF), <($FE)
.byte <($EF), <($DF), <($DF), <($DD), <($DA), <($8E), <($96), <($68)
.byte <($61), <($34), <($71), <($12), <($72), <($43), <($40), <($30)
.byte <($05), <($00), <($01), <($01), <($03), <($18), <($34), <($15)
.byte <($46), <($69), <($A7), <($C8), <($9A), <($BB), <($AE), <($DD)
.byte <($FF), <($DF), <($DA), <($FC), <($FC), <($EB), <($DA), <($AA)
.byte <($8C), <($B9), <($69), <($5B), <($75), <($A2), <($92), <($34)
.byte <($45), <($42), <($80), <($00), <($10), <($61), <($35), <($37)
.byte <($35), <($77), <($56), <($56), <($66), <($D5), <($87), <($A9)
.byte <($97), <($D8), <($B9), <($B9), <($F8), <($DA), <($8C), <($BE)
.byte <($8F), <($7A), <($8E), <($9C), <($AB), <($CA), <($AB), <($CD)
.byte <($7C), <($89), <($47), <($92), <($61), <($36), <($36), <($24)
.byte <($02), <($43), <($54), <($24), <($68), <($55), <($67), <($56)
.byte <($57), <($99), <($07), <($77), <($77), <($77), <($72), <($9A)
.byte <($8F), <($27), <($08), <($A1), <($72), <($50), <($1F), <($76)
.byte <($85), <($C6), <($40), <($76), <($7B), <($AF), <($7D), <($FE)
.byte <($7B), <($D6), <($07), <($51), <($07), <($57), <($BE), <($B8)
.byte <($5B), <($89), <($A3), <($87), <($BC), <($8C), <($50), <($68)
.byte <($B5), <($A5), <($46), <($7B), <($66), <($79), <($A7), <($88)
.byte <($85), <($A2), <($53), <($58), <($89), <($7A), <($9C), <($77)
.byte <($66), <($A9), <($63), <($65), <($47), <($8B), <($8A), <($A8)
.byte <($68), <($86), <($36), <($47), <($75), <($38), <($89), <($78)
.byte <($B7), <($99), <($95), <($96), <($66), <($37), <($88), <($56)
.byte <($86), <($96), <($96), <($8A), <($98), <($99), <($87), <($88)
.byte <($66), <($67), <($98), <($88), <($67), <($99), <($78), <($79)
.byte <($79), <($A8), <($88), <($88), <($98), <($78), <($68), <($88)
.byte <($98), <($9A), <($88), <($87), <($78), <($86), <($76), <($86)
.byte <($56), <($86), <($79), <($78), <($97), <($99), <($98), <($8B)
.byte <($78), <($86), <($79), <($77), <($87), <($CA), <($78), <($87)
.byte <($76), <($86), <($77), <($76), <($67), <($88), <($77), <($89)
.byte <($88), <($77), <($77), <($87), <($77), <($86), <($78), <($77)
.byte <($78), <($78), <($98), <($96), <($88), <($88), <($77), <($78)
.byte <($77), <($78), <($87), <($77), <($77), <($77), <($88), <($78)
.byte <($88), <($87), <($87), <($77), <($77), <($65), <($68), <($88)
.byte <($88), <($89), <($88), <($87), <($67), <($87), <($78), <($67)
.byte <($77), <($78), <($88), <($77), <($87), <($87), <($88), <($78)
.byte <($88), <($77), <($78), <($78), <($87), <($87), <($87), <($77)
.byte <($77), <($78), <($78), <($77), <($88), <($88), <($88), <($87)
.byte <($78), <($77), <($77), <($77), <($88), <($87), <($88), <($88)
.byte <($88), <($78), <($87), <($87), <($77), <($77), <($77), <($77)
.byte <($78), <($87), <($88), <($88), <($87), <($88), <($88), <($88)
.byte <($78), <($78), <($77), <($77), <($78), <($87), <($87), <($77)
.byte <($77), <($88), <($88), <($88), <($77), <($78), <($77), <($77)
.byte <($87), <($87), <($88), <($78), <($78), <($88), <($88), <($88)
.byte <($77), <($77), <($77), <($77), <($77), <($78), <($77), <($77)

//=========================== COWBELL ROUTINE ==================================

DCOWBELL:
    jsr BELL
COWBELL:
    jsr BELL
jmp DRMret

BELL:
    ldx #<(0)
CB1:
    lda ROCKCOWBELL+256*0,X
lsr
lsr
lsr
lsr
jsr DCB
lda ROCKCOWBELL+256*0,X
nop
nop
nop
and #<(15)
jsr DCB
inx
bne CB1
rts

DCB:
    sta $D418
ldy #<(15)
DCB1:
    dey
bpl DCB1
rts

ROCKCOWBELL:
    .byte <($77), <($74), <($4A), <($0A), <($04), <($D3), <($7C), <($F4) //256 bytes, speed 15
.byte <($4F), <($56), <($97), <($CB), <($4A), <($A7), <($67), <($36)
.byte <($40), <($BC), <($CC), <($ED), <($AA), <($34), <($42), <($5E)
.byte <($CC), <($97), <($A6), <($52), <($03), <($48), <($AB), <($AC)
.byte <($BB), <($73), <($02), <($43), <($AC), <($BE), <($FA), <($B5)
.byte <($01), <($24), <($8B), <($CF), <($FD), <($B7), <($20), <($10)
.byte <($56), <($9E), <($EE), <($CA), <($73), <($00), <($03), <($AC)
.byte <($FF), <($FB), <($B6), <($00), <($01), <($6A), <($CF), <($EC)
.byte <($D9), <($51), <($00), <($35), <($BF), <($FE), <($DC), <($93)
.byte <($00), <($03), <($9C), <($EF), <($FD), <($E6), <($00), <($01)
.byte <($67), <($CF), <($EF), <($EA), <($51), <($00), <($24), <($9D)
.byte <($EF), <($FC), <($A4), <($00), <($02), <($69), <($FF), <($FE)
.byte <($B6), <($40), <($00), <($36), <($BF), <($FF), <($EA), <($84)
.byte <($00), <($02), <($9C), <($EF), <($FC), <($A7), <($20), <($00)
.byte <($5A), <($DF), <($FD), <($D9), <($62), <($00), <($36), <($BC)
.byte <($DF), <($EC), <($94), <($00), <($02), <($7B), <($CF), <($FC)
.byte <($B7), <($21), <($01), <($57), <($BE), <($EF), <($D9), <($62)
.byte <($00), <($24), <($8C), <($DF), <($EB), <($95), <($12), <($01)
.byte <($69), <($DF), <($EC), <($B7), <($52), <($00), <($47), <($AE)
.byte <($DD), <($DA), <($74), <($11), <($24), <($9B), <($DE), <($DB)
.byte <($96), <($31), <($02), <($69), <($BE), <($DC), <($C8), <($53)
.byte <($02), <($56), <($9C), <($CD), <($DA), <($74), <($12), <($34)
.byte <($8A), <($CD), <($DB), <($96), <($32), <($24), <($68), <($BD)
.byte <($CC), <($B7), <($53), <($23), <($56), <($9C), <($DD), <($C8)
.byte <($75), <($23), <($34), <($8A), <($CD), <($CA), <($96), <($42)
.byte <($24), <($69), <($BD), <($CB), <($A7), <($54), <($23), <($56)
.byte <($AB), <($CD), <($B9), <($75), <($22), <($36), <($9A), <($BC)
.byte <($CA), <($96), <($33), <($35), <($78), <($AC), <($CC), <($A7)
.byte <($53), <($33), <($57), <($9B), <($CC), <($B8), <($74), <($24)
.byte <($46), <($99), <($BC), <($CA), <($85), <($43), <($45), <($78)
.byte <($77), <($77), <($77), <($77), <($77), <($77), <($77), <($77)
.byte <($77), <($77), <($77), <($77), <($77), <($77), <($77), <($77)

EP: //======================******************************========================
//========================*=== END OF MUSIC PROGRAM ===*========================
//========================******************************========================
























//=========================********************=================================
//=========================*=== MUSIC DATA ===*=================================
SD: //=======================********************=================================

TUNETABLE:
    .word TITLE0, TITLE1, TITLE2
.byte <(3)
.word GAMEOVER0, GAMEOVER1, GAMEOVER2
.byte <(3)

//========================= TITLE SCREEN SID DATA ==============================

TF10:
    .word -30, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(13), <(4)
TV10:
    .byte <(41), <($99), <($FD), <(2), <(254)
TV11:
    .byte <(21), <($0C), <($C6), <(3), <(3)
TD11:
    .word 39, -39, 39, 0
.byte <(2), <(5), <(3), <(0), <(12), <(5)
.byte <(50), <(250), <(0), <(5)
.word 20, -8, $0400
.byte <(65), <($09), <($ED), <(100), <(254)
TD12:
    .word 15, -15, 15, 0
.byte <(2), <(5), <(3), <(0), <(9), <(5)
.byte <(150), <(250), <(0), <(5)
.word 20, -20, $0800
.byte <(65), <($03), <($99), <(5), <(50)
TS10:
    .byte <(DSoke), <(FMDLY)
.word 255+256*7
.byte <(DSoke), <(FBG)
.word -20
.byte <(Rest), <(4), <(Ret)
TS11:
    .byte <(58), <(6)
TS11a:
    .byte <(70), <(6), <(65), <(4), <(63), <(4), <(65), <(4), <(62), <(8), <(Ret)
TX10:
    lda #<(0)
sta S0+VRC
sta $D404
lda #<(11500)
sta $D400
lda #>11500
sta $D401
rts

TITLE1:
    .byte <(RestR), <(2)
.byte <(Call)
.word TS00
.byte <(MBendOff)
.byte <(RestR), <(1)
.byte <(Rest), <(32)
.byte <(Rest), <(16)
.byte <(45), <(31)
.byte <(44), <(31)
.byte <(43), <(31)
.byte <(Moke), <(VADSD), <(50)
.byte <(41), <(31)
.byte <(FLoad), <(VRC)
.word TD20
.byte <(Rest), <(31)
.byte <(For), <(4)
.byte <(CT), <(-12)
.word TS20
.byte <(Next)
.byte <(FLoad), <(PINIT+1)
.word TD01
.byte <(For), <(2)
.byte <(Vlm)
.word TV01
.byte <(58), <(31), <(Rest), <(24)
.byte <(Call)
.word TS10
.byte <(Vlm)
.word TV02
.byte <(Rest), <(4)
.byte <(67), <(12)
.byte <(Call)
.word TS10
.byte <(63), <(12)
.byte <(Call)
.word TS10
.byte <(Next)
.byte <(FLoad), <(VRC)
.word TD20
.byte <(For), <(4)
.byte <(CT), <(-12)
.word TS20
.byte <(Next)
.byte <(Moke), <(VRD), <(255), <(Moke), <(VSRV), <($CE)
.byte <(67), <(31)
.byte <(59), <(31)
.byte <(55), <(31)
.byte <(47), <(31)
.byte <(Vlm)
.word TV10
.byte <(Moke), <(PMC), <(0)
.byte <(58), <(24), <(Rest), <(8), <(57), <(12), <(Rest), <(4), <(55), <(12), <(Rest), <(4)
.byte <(Moke), <(VSRV), <($ED), <(Moke), <(VRD), <(254)
.byte <(50), <(31)
.byte <(Vlm)
.word TV10
.byte <(62), <(24), <(Rest), <(8), <(60), <(12), <(Rest), <(4), <(57), <(12), <(Rest), <(4)
.byte <(Moke), <(VSRV), <($ED), <(Moke), <(VRD), <(254)
.byte <(59), <(31)
.byte <(FLoad), <(VRC)
.word TD11
.byte <(45), <(6), <(48), <(6), <(53), <(6), <(57), <(6), <(60), <(8), <(62), <(32)
.byte <(FLoad), <(VRC)
.word TD04
.byte <(Transp), <(0)
.byte <(Moke), <(FMDLY), <(2)
.byte <(For), <(23), <(Rest), <(32), <(Next)
.byte <(63), <(32)
.byte <(DMoke), <(PINIT)
.word $0800
.byte <(For), <(11), <(Rest), <(31), <(Next)
.byte <(Moke), <(VADV), <($AF), <(Soke), <(VADSD), <(70), <(Rest), <(32)
.byte <(53), <(31)
.byte <(For), <(6*2-1), <(Rest), <(16), <(Next)
.byte <(Call)
.word TS05
.byte <(Moke), <(FMC), <(0), <(Moke), <(PMC), <(0), <(Vlm)
.word TV11
.byte <(Code)
.word TX10
.byte <(For), <(48)
.byte <(55), <(2), <(47), <(2), <(51), <(2), <(43), <(2), <(50), <(2), <(45), <(2), <(54), <(2), <(46), <(2)
.byte <(Next)
.byte <(FLoad), <(VRC)
.word TD12
.byte <(For), <(16)
.byte <(Call)
.word TS11
.byte <(Next)
.byte <(Moke), <(VSRV), <($5E)
.byte <(For), <(8)
.byte <(Call)
.word TS11
.byte <(Next)
.byte <(Rest), <(32), <(Rest), <(32), <(Jmp)
.word TITLE1


TC20:
    .word 10, -10, 10, -10
.byte <(8), <(16), <(8), <(0), <(50), <(7)
.word 900
TD20:
    .word 30, -30, 30, 0
.byte <(2), <(5), <(3), <(0), <(15), <(5)
.byte <(25), <(250), <(0), <(5)
.word 50, -10, $0400
.byte <(73), <($09), <($D6), <(2), <(10)
TC21:
    .word 10, -10, 10, -100
.byte <(8), <(16), <(8), <(0), <(10), <(7)
.word 1100
TD21:
    .word 30, -30, 30, 0
.byte <(2), <(5), <(3), <(0), <(15), <(5)
.byte <(1), <(250), <(1), <(4)
.word $400, 50, $0100
.byte <(65), <($09), <($E6), <(20), <(8)
TS20:
    .byte <(31), <(6), <(43), <(6), <(31), <(4), <(34), <(4), <(38), <(4), <(41), <(2), <(38), <(2), <(34), <(2), <(35), <(2)
.byte <(36), <(12), <(Rest), <(20), <(Ret)
TS21:
    .byte <(22), <(6), <(22), <(2), <(22), <(2), <(10), <(4), <(22), <(4), <(34), <(2), <(22), <(4), <(22), <(2), <(10), <(2), <(20), <(4), <(Ret)
TS22:
    .byte <(CT), <(12)
.word TS21
.byte <(Rest), <(18), <(5), <(6), <(8), <(4), <(9), <(4)
.byte <(Call)
.word TS21
.byte <(Rest), <(10), <(20), <(6), <(8), <(6), <(8), <(2), <(20), <(4), <(8), <(4)
.byte <(CT), <(8)
.word TS21
.byte <(Rest), <(18), <(20), <(6), <(15), <(4), <(15), <(4)
.byte <(Call)
.word TS21
.byte <(Rest), <(32)
.byte <(Ret)

TITLE2:
    .byte <(Disown)
.byte <(Rest), <(1)
.byte <(Call)
.word TS00
.byte <(MBendOff)
.byte <(Rest), <(32)
.byte <(Rest), <(16)
.byte <(48), <(31)
.byte <(47), <(31)
.byte <(46), <(31)
.byte <(Moke), <(VADSD), <(50)
.byte <(45), <(31)
.byte <(FLoad), <(VRC)
.word TD20
.byte <(Filter)
.word TC20
.byte <(Rest), <(31)
.byte <(Master)
.byte <(For), <(4)
.byte <(Call)
.word TS20
.byte <(Next)
.byte <(FLoad), <(VRC)
.word TD00
.byte <(Moke), <(FMC), <(0), <(Moke), <(VADV), <($AA)
.byte <(19), <(32)
.byte <(FLoad), <(VRC)
.word TD20
.byte <(For), <(7), <(Rest), <(32), <(Next)
.byte <(For), <(4)
.byte <(Call)
.word TS20
.byte <(Next)
.byte <(Moke), <(VRD), <(255), <(Moke), <(VSRV), <($CE)
.byte <(58), <(31)
.byte <(55), <(31)
.byte <(46), <(31)
.byte <(43), <(32)
.byte <(FLoad), <(VRC)
.word TD21
.byte <(Filter)
.word TC21
.byte <(Rest), <(32)
.byte <(For), <(2)
.byte <(CT), <(0)
.word TS21
.byte <(Call)
.word TS21
.byte <(CT), <(-3)
.word TS21
.byte <(Call)
.word TS21
.byte <(Next)
.byte <(Transp), <(0)
.byte <(FLoad), <(VRC)
.word TD11
.byte <(Disown)
.byte <(41), <(6), <(45), <(6), <(48), <(6), <(53), <(6), <(57), <(8), <(58), <(32)
.byte <(FLoad), <(VRC)
.word TD04
.byte <(Transp), <(0)
.byte <(Moke), <(FMDLY), <(4)
.byte <(For), <(31), <(Rest), <(32), <(Next)
.byte <(60), <(32)
.byte <(DMoke), <(PINIT)
.word $0800
.byte <(For), <(11), <(Rest), <(31), <(Next)
.byte <(Moke), <(VADV), <($AF), <(Soke), <(VADSD), <(70)
.byte <(FLoad), <(VRC)
.word TD11
.byte <(Freq)
.word TF10
.byte <(Rest), <(24)
.byte <(36), <(8)
.byte <(FLoad), <(VRC)
.word TD21
.byte <(Moke), <(VSRV), <($F6)
.byte <(Filter)
.word TC21
.byte <(Master)
.byte <(For), <(2)
.byte <(CT), <(12)
.word TS21
.byte <(Rest), <(32)
.byte <(Next)
.byte <(For), <(2)
.byte <(CT), <(8)
.word TS21
.byte <(Rest), <(32)
.byte <(Next)
.byte <(Moke), <(VSRV), <($E6)
.byte <(Call)
.word TS22
.byte <(Call)
.word TS22
.byte <(Moke), <(VRD), <(128), <(Moke), <(VSRV), <($EE)
.byte <(For), <(3)
.byte <(Call)
.word TS22
.byte <(Next)
.byte <(Rest), <(32), <(Rest), <(32), <(Transp), <(0), <(Jmp)
.word TITLE2


TD00:
    .word 25, -25, 25, 54
.byte <(2), <(5), <(3), <(0), <(20), <(7)
.byte <(25), <(250), <(0), <(5)
.word 100, -10, $0400
.byte <(65), <($29), <($C9), <(255), <(40)
TD01:
    .word 45, -45, 45, 0
.byte <(2), <(5), <(3), <(0), <(30), <(5)
.fill 8, 0
.word $500
TV01:
    .byte <(%00101001), <($A9), <($EF), <(10), <(254)
TF02:
    .word 183, 0, -183, 0
.byte <(8), <(8), <(8), <(0), <(10), <(4)
TV02:
    .byte <(%00100001), <($48), <($DA), <(100), <(50)
TF03:
    .word 70, 0, -136, 0
.byte <(8), <(10), <(8), <(0), <(0), <(4)
OHMYGOD:
    .word 85, -85, 85, 121
.byte <(2), <(4), <(2), <(0), <(96), <(7)
.byte <(25), <(255), <(0), <(5)
.word 150, -30, $0080
.byte <(65), <($09), <($E9), <(255), <(40)
TD04:
    .word 35, -35, 35, 0
.byte <(3), <(6), <(3), <(0), <(20), <(5)
.byte <(255), <(255), <(0), <(5)
.word 1, 1, $0000
.byte <(65), <($FF), <($CA), <(255), <(20)
TS00:
    .byte <(FLoad), <(VRC)
.word TD00
.byte <(60+R), <(10*3-2), <(MBendOff), <(60+R), <(4), <(62+R), <(4), <(60), <(12)
.byte <(57), <(6), <(55), <(6), <(53), <(4), <(55), <(2), <(57), <(4), <(53), <(2)
.byte <(For), <(6), <(50+R), <(3), <(48+R), <(3), <(45+R), <(5), <(Next)
.byte <(MBendOn), <(DMoke), <(FBG)
.word 27
.byte <(48), <(12), <(Ret)
TS01:
    .byte <(50), <(1), <(58), <(1), <(50), <(1)
.byte <(Code)
.word TX02
.byte <(55), <(1), <(50), <(1), <(58), <(1), <(50), <(1)
.byte <(Code)
.word TX02
.byte <(Ret)
TS03:
    .byte <(50), <(1), <(58), <(1), <(50), <(1)
.byte <(Code)
.word TX04
.byte <(55), <(1), <(50), <(1), <(58), <(1), <(50), <(1)
.byte <(Code)
.word TX04
.byte <(Ret)
TS02:
    .byte <(50), <(1), <(55), <(1), <(50), <(1)
.byte <(Code)
.word TX02
.byte <(53), <(1), <(50), <(1), <(55), <(1), <(50), <(1)
.byte <(Code)
.word TX02
.byte <(Ret)
TS04:
    .byte <(50), <(1), <(55), <(1), <(50), <(1)
.byte <(Code)
.word TX04
.byte <(53), <(1), <(50), <(1), <(55), <(1), <(50), <(1)
.byte <(Code)
.word TX04
.byte <(Ret)
TS05:
    .byte <(DSoke), <(FMDLY)
.word 255+256*7
.byte <(DSoke), <(FMG3)
.word 60
.byte <(Soke), <(VADSC), <(16*3), <(Rest), <(16), <(Ret)
TX00:
    lda #<(0)
sta S0+FBG+0
sta S0+FBG+1
lda #<(8*3)
sta S0+FMDLY
ldy #<(65)
jmp POKEFRQ0
TX01:
    lda D0+PINIT+0
clc
adc #<(240)
sta D0+PINIT+0
lda D0+PINIT+1
adc #>240
sta D0+PINIT+1
rts
TX02:
    lda SToRE+0
clc
adc #<(210)
sta SToRE+0
ora #<($880)
sta D0+PINIT+0
lda SToRE+1
adc #>200
sta SToRE+1
ora #>$880
sta D0+PINIT+1
rts
TX04:
    lda SToRE+0
sec
sbc #<(210)
sta SToRE+0
ora #<($880)
sta D0+PINIT+0
lda SToRE+1
sbc #>200
sta SToRE+1
ora #>$880
sta D0+PINIT+1
rts
TX03:
    lda #<(0)
sta SToRE
sta SToRE+1
rts
SToRE:
    .word $D3DD

TITLE0:
    .byte <(Call)
.word TS00
.byte <(Rest+R), <(1*3) //+1
.byte <(For), <(6), <(Rest), <(30), <(Rest), <(10), <(Next)
.byte <(Soke), <(VADSD), <(50)
.byte <(FLoad), <(VRC)
.word TD20
.byte <(For), <(4), <(Rest), <(31), <(Next)
.byte <(For), <(2)
.byte <(34), <(6), <(46), <(6), <(34), <(4), <(38), <(4), <(41), <(4), <(45), <(2), <(41), <(2), <(38), <(2), <(39), <(2)
.byte <(40), <(12), <(Rest), <(20)
.byte <(Next)
.byte <(FLoad), <(PINIT+1)
.word TD01
.byte <(For), <(2)
.byte <(Vlm)
.word TV01
.byte <(55), <(31), <(Rest), <(24)
.byte <(Call)
.word TS10
.byte <(Vlm)
.word TV02
.byte <(Rest), <(4)
.byte <(63), <(12)
.byte <(Call)
.word TS10
.byte <(60), <(12)
.byte <(Call)
.word TS10
.byte <(Next)
.byte <(Sil), <(31), <(Rest), <(32)
.byte <(FLoad), <(VRC)
.word OHMYGOD
.byte <(0), <(32)
.byte <(Code)
.word TX00
.byte <(Rest), <(8)
.byte <(Soke), <(FMDLY), <(8*3)
.byte <(DSoke), <(FBG)
.word 60
.byte <(MBendOff)
.byte <(Rest), <(10)
.byte <(Soke), <(PMD1C), <(1)
.byte <(Rest), <(18)
.byte <(DSoke), <(FMDLY)
.word 24+256*7
.byte <(DSoke), <(FBG)
.word -60
.byte <(Rest+R), <(8*3+1)
.byte <(For), <(10), <(65+R), <(3)
.byte <(Code)
.word TX01
.byte <(62+R), <(3)
.byte <(Code)
.word TX01
.byte <(Next)
.byte <(Freq)
.word TF02
.byte <(Moke), <(PMC), <(4), <(DMoke), <(PINIT)
.word $0080
.byte <(Moke), <(VADSD), <(254)
.byte <(65), <(16)
.byte <(Freq)
.word TF03
.byte <(61), <(12)
.byte <(FLoad), <(FMD2)
.word OHMYGOD
.byte <(DMoke), <(FMDLY)
.word 20+256*5
.byte <(58), <(2), <(60), <(2)
.byte <(MBendOn), <(DMoke), <(FBG)
.word 56
.byte <(60), <(24)
.byte <(MBendOn), <(DMoke), <(FBG)
.word -150
.byte <(50+R), <(8*3-1)
.byte <(Moke), <(FMC), <(0)
.byte <(For), <(4)
.byte <(Code)
.word TX03
.byte <(74), <(1), <(Call)
.word TS01
.byte <(72), <(1), <(Call)
.word TS01
.byte <(70), <(1), <(Call)
.word TS01
.byte <(69), <(1), <(Call)
.word TS03
.byte <(62), <(1), <(Call)
.word TS03
.byte <(60), <(1), <(Call)
.word TS03
.byte <(58), <(1), <(Call)
.word TS01
.byte <(57), <(1), <(Call)
.word TS01
.byte <(74), <(1), <(Call)
.word TS02
.byte <(73), <(1), <(Call)
.word TS04
.byte <(71), <(1), <(Call)
.word TS04
.byte <(69), <(1), <(Call)
.word TS04
.byte <(62), <(1), <(Call)
.word TS02
.byte <(61), <(1), <(Call)
.word TS02
.byte <(59), <(1), <(Call)
.word TS02
.byte <(57), <(1), <(Call)
.word TS04
.byte <(Next)
.byte <(FLoad), <(VRC)
.word TD11
.byte <(48), <(6), <(53), <(6), <(57), <(6), <(60), <(6), <(65), <(8), <(67), <(32)
.byte <(FLoad), <(VRC)
.word TD04
.byte <(For), <(15), <(Rest), <(32), <(Next)
.byte <(67), <(32)
.byte <(DMoke), <(PINIT)
.word $0800
.byte <(For), <(11), <(Rest), <(31), <(Next)
.byte <(Moke), <(VADV), <($AF), <(Soke), <(VADSD), <(70), <(Rest), <(32), <(56), <(31)
.byte <(For), <(14*2-1), <(Rest), <(16), <(Next)
.byte <(Call)
.word TS05
.byte <(FLoad), <(VRC)
.word TD12
.byte <(Moke), <(VSRV), <($59)
.byte <(For), <(24*8+2), <(Rest), <(32/8), <(Next)
.byte <(For), <(16), <(Call)
.word TS11
.byte <(Next), <(Moke), <(VSRV), <($5E), <(58), <(6), <(Trigger)
.byte <(Call)
.word TS11a
.byte <(For), <(7), <(Call)
.word TS11
.byte <(Next), <(Trigger)
.byte <(Rest), <(32), <(Rest), <(24), <(Jmp)
.word TITLE0

//====================== GAME OVER SCREEN SID DATA =============================

GOV00:
    .byte <(65), <($06), <($D8), <(8), <(10)

GAMEOVER0:
    .byte <(FLoad), <(VRC)
.word TD11
.byte <(64), <(6), <(62), <(6), <(59), <(4), <(57), <(2), <(53), <(1), <(54), <(1), <(55), <(2)
.byte <(52), <(8), <(50), <(6), <(47), <(4), <(45), <(2), <(41), <(1), <(42), <(1), <(43), <(2)
.byte <(40), <(8), <(38), <(6), <(35), <(4), <(33), <(2), <(29), <(1), <(30), <(1), <(31), <(4), <(40), <(10)
.byte <(Vlm)
.word GOV00
.byte <(40), <(4), <(Ret)


GAMEOVER1:
    .byte <(FLoad), <(VRC)
.word TD11
.byte <(Rest), <(24)
.byte <(64), <(6), <(62), <(6), <(59), <(4), <(57), <(2), <(53), <(1), <(54), <(1), <(55), <(2)
.byte <(52), <(8), <(50), <(6), <(47), <(4), <(45), <(2), <(41), <(1), <(42), <(1), <(43), <(4), <(44), <(10)
.byte <(Vlm)
.word GOV00
.byte <(44), <(4), <(Ret)


GAMEOVER2:
    .byte <(FLoad), <(VRC)
.word TD11
.byte <(Rest), <(24), <(Rest), <(24)
.byte <(64), <(6), <(62), <(6), <(59), <(4), <(57), <(2), <(53), <(1), <(54), <(1), <(55), <(4), <(47), <(10)
.byte <(Vlm)
.word GOV00
.byte <(47), <(4), <(Ret)

//==============================================================================

LASER:
    .word 39000, -3900, 59000, 19000
.byte <(5), <(5), <(5), <(5), <(0), <(5)
.fill 10, 0
.byte <(33), <($03), <($87), <(18), <(5)
.word 33000
BOOMERANG:
    .word 2000, -17000, 2000, 0
.byte <(10), <(1), <(255), <(0), <(0), <(4)
.fill 10, 0
.byte <(33), <($03), <($C7), <(25), <(5)
.word 7000
GRENADE:
    .word -1000, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($99), <($E9), <(20), <(20)
.word 50000
GRENEXPLODES:
    .word -100, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(4)
.fill 10, 0
.byte <(129), <($03), <($9D), <(20), <(2)
.word 3000
MONSTERTHUDS:
    .word -7, 0, 0, 330
.byte <(20), <(0), <(0), <(0), <(5), <(129)
.byte <(20), <(0), <(3), <(129)
.word 110, 0, $0800
.byte <(65), <($03), <($99), <(20), <(20)
.word 1000
ALIENFIRES:
    .word -900, -1800, 1000, 0
.byte <(5), <(5), <(255), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($09), <($89), <(10), <(15)
.word 25000
ENERGYDRAIN:
    .fill 14, 0
.fill 10, 0
.byte <(129), <($95), <($89), <(11), <(15)
.word 2500
PICKSUPHEART:
    .word -1200, 0, 0, 0
.byte <(9), <(0), <(0), <(0), <(0), <(129)
.fill 10, 0
.byte <(33), <($03), <($CA), <(5), <(40)
.word 40000
LASERTURRET:
    .word -1800, -3600, 2000, 0
.byte <(3), <(3), <(255), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($05), <($87), <(5), <(7)
.word 25000
KANGAROOSHOP:
    .word 4000, 0, 0, 0
.byte <(1), <(2), <(0), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($03), <($C7), <(25), <(5)
.word 4000
IMPSAPPEAR:
    .word 39000, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($A3), <($82), <(30), <(1)
.word 33000
LIFTDINGS:
    .word 59, -59, 59, 0
.byte <(2), <(5), <(3), <(0), <(9), <(5)
.byte <(50), <(250), <(0), <(5)
.word 20, -8, $0400
.byte <(65), <($05), <($89), <(20), <(35)
.word 10000
STATUEEYESHIT:
    .word 500, 0, 0, 0
.byte <(6), <(0), <(0), <(0), <(0), <(129)
.byte <(50), <(250), <(0), <(5)
.word 150, -8, $0400
.byte <(65), <($04), <($99), <(10), <(10)
.word 30000

ED: //============================================================================

.label SIZE = *-$1000
.label DAMAGE = SIZE-8*1024
.label GAP = 8*1024-SIZE
.label CH0VALUE = 1
.label CH1VALUE = 1
.label CH2VALUE = 1
.label QSOUND = %000
.label Q = 0 //80
.label refsp = $0040
.label drmsp = $0080

//^^^^^^^^^^^^^^^ This is the end of the source file... (or is it?) ^^^^^^^^^^^^