
//     =========== "Arkanoid" Audio Source File (SID/65xx system) ==========

//   ==================== Code & design by Martin Galway =====================

// =================== Compositions by Martin Galway & Taito ===================

//   =================== Work started 23rd   January 1987. ===================

//     ==== (C) OCEAN SOFTWARE LTD 12:12    Friday  6th  February 1987. ====

//======================*===CODE ENTRY INFORMATION===*==========================

//  ROUTINE       INSIDE INTERRUPTS?
//  -------       ------------------
//
//  InitSound     OUT
//  Sound0        IN
//  Sound1        IN
//  Sound2        IN
//  Music0        IN
//  Music1        IN
//  Music2        IN
//  MusicTest     IN
//  RefFilter     IN
//  Effect        OUT
//  Tune          OUT

//  TAITO LETTER TUNE VALUE SPEED SOUND
//  ----- ------ ---------- ----- -----
//  03    B *                     Bat-ball bounce/ball leaving bat (catch mode)
//  04    C *                     Ball hitting a brick & knocking it away
//  05    D
//  07    E
//  09    F *                     Expansion
//  0A    G *    1*7-2      100Hz Opening sequence
//  0B    H *    2*7-2      100Hz Next screen/Next life
//  0C    I      3*7-2      100Hz Last screen intro ?
//  0D    J      4*7-2            ?
//  0E    K *    5*7-2      100Hz Game Over
//  0F    L *    6*7-2       50Hz Enter Name
//  10    M *    7*7-2      100Hz Extra Life
//  11    N *                     Laser Fire
//  13    O *                     Opening sequence sound effect
//  14    P *                     Alien exploding
//  16    Q *                     Ball hitting a brick but NOT knocking it away
//  17    R      8*7-2      100Hz Triumph ?
//  18    S *                     Breakthrough
//  19    T *                     Bat catching the ball (catch mode)
//  1A    U *                     Vaus exploding
//  1B    V                       Ball hitting head on last screen
//  1C    W                       Head exploding on last screen
//        X *    9*7-2       50Hz Title sequence

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
.label Noise = COM+44
.label Square = COM+46
.label Freq = COM+48
.label Hang = COM+50
.label MokeF6 = COM+52
.label Moke86 = COM+54

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
.label DEPTHOFSTACKS = 8

//***** "OFFSET LIST" FM DATA STRUCTURE ***
//0&1 RESERVED - MUST BE 0
//2&3 RESERVED - MUST BE 0
//4&5 INITIAL SINGLE OFFSET DURATION COUNTER VALUE - USUALLY 1
//6&7 MAXIMUM-EVER SINGLE OFFSET DURATION - 1-255
//8&9 ADDRESS OF OFFSET LIST (LIST IS READ THROUGH END-FIRST, GOING BACKWARDS)
//10  RESERVED - MUST BE 0
//11  MAXIMUM OFFSET LIST INDEX 0-255
//12  RESERVED - MUST BE 0
//13  FM CONTROL - ANY VALUE THAT HAS BIT 3 SET (E.G. 8)

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

//=== N.T.S.C. FREQUENCY TABLE (NOT TO BE USED ON P.A.L.) : 1 MHz CLOCK RATE ===

//BASE "A" VALUE FOR THIS OCTAVE IS 231. (EQUIVALENT TO N-03)

//N00           EQU 274
//N01           EQU 291
//N02           EQU 308
//N03           EQU 326
//N04           EQU 346
//N05           EQU 366
//N06           EQU 388
//N07           EQU 411
//N08           EQU 435
//N09           EQU 461
//N10           EQU 489
//N11           EQU 518
//N12           EQU 548
//N13           EQU 581
//N14           EQU 616
//N15           EQU 652
//N16           EQU 691
//N17           EQU 732
//N18           EQU 776
//N19           EQU 822
//N20           EQU 871
//N21           EQU 923
//N22           EQU 978
//N23           EQU 1036
//N24           EQU 1097
//N25           EQU 1163
//N26           EQU 1232
//N27           EQU 1305
//N28           EQU 1383
//N29           EQU 1465
//N30           EQU 1552
//N31           EQU 1644
//N32           EQU 1742
//N33           EQU 1845
//N34           EQU 1966
//N35           EQU 2071
//N36           EQU 2195
//N37           EQU 2325
//N38           EQU 2463
//N39           EQU 2620
//N40           EQU 2765
//N41           EQU 2930
//N42           EQU 3104
//N43           EQU 3288
//N44           EQU 3484
//N45           EQU 3691
//N46           EQU 3910
//N47           EQU 4143
//N48           EQU 4389
//N49           EQU 4650
//N50           EQU 4927
//N51           EQU 5220
//N52           EQU 5530
//N53           EQU 5859
//N54           EQU 6207
//N55           EQU 6577
//N56           EQU 6968
//N57           EQU 7382
//N58           EQU 7821
//N59           EQU 8286
//N60           EQU 8779
//N61           EQU 9301
//N62           EQU 9854
//N63           EQU 10440
//N64           EQU 11060
//N65           EQU 11718
//N66           EQU 12415
//N67           EQU 13153
//N68           EQU 13935
//N69           EQU 14764
//N70           EQU 15742
//N71           EQU 16572
//N72           EQU 17557
//N73           EQU 18601
//N74           EQU 19708
//N75           EQU 20897
//N76           EQU 22121
//N77           EQU 23436
//N78           EQU 24730
//N79           EQU 26306
//N80           EQU 27871
//N81           EQU 29528
//N82           EQU 31284
//N83           EQU 33144
//N84           EQU 35115
//N85           EQU 37203
//N86           EQU 39145
//N87           EQU 41759
//N88           EQU 44242
//N89           EQU 46873
//N90           EQU 49660
//N91           EQU 52613
//N92           EQU 55741
//N93           EQU 59056

.label NSil = 00000 //                Silence (the same at both clock speeds)

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
.label SID = $D400
.label D418 = $3FFF
.label BDR = $D020
.label MREFCOLOUR = 1 //                                 White, for music refreshes
.label DREFCOLOUR = 0 //                       Desired colour for display refreshes

// === FILE CONTROL CHARACTERS ===

// \ PROGRAM ASSEMBLY MODE (DEVELOPMENT/MOBJ)
// @ SILENCE HANDLING ON/OFF
// [ SOUND EFFECT HANDLING ON/OFF

//======================************************================================
//======================*=== DRIVER PROGRAM ===*================================
//======================************************================================

* = $0803 //\

Start:
    sei
jsr InitScreen
//              JMP $4000
jsr INITSOUND
jsr FastForward
lda #<(Q)
bne DLoop
ldy #<(10)
jsr Delay
jsr Vaus

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
    .word INITSOUND, Bounce, Hit, FaFo //AD
.word FaFo, Expansion, OpeningSequen, NextScreen, FaFo //EI
.word FaFo, GameOver, EnterName, ExtraLife, Laser, OpenFX, Alien, Brick //JQ
.word FaFo, Breakthrough, Catch, Vaus, Head, Explosion //RW
.word Title, FaFo, FaFo //XZ

Bounce:
    ldx #<(0)
lda #<(BOUNCE0)
ldy #>BOUNCE0
jsr EFFECT
ldx #<(1)
lda #<(BOUNCE1)
ldy #>BOUNCE1
jsr EFFECT
ldx #<(2)
lda #<(BOUNCE2)
ldy #>BOUNCE2
jmp EFFECT
Hit:
    ldx #<(0)
lda #<(HIT0)
ldy #>HIT0
jsr EFFECT
ldx #<(1)
lda #<(HIT1)
ldy #>HIT1
jsr EFFECT
ldx #<(2)
lda #<(HIT2)
ldy #>HIT2
jmp EFFECT
Expansion:
    ldx #<(0)
lda #<(EXPANSION0)
ldy #>EXPANSION0
jsr EFFECT
ldx #<(1)
lda #<(EXPANSION1)
ldy #>EXPANSION1
jsr EFFECT
ldx #<(2)
lda #<(EXPANSION2)
ldy #>EXPANSION2
jmp EFFECT
Laser:
    ldx #<(0)
lda #<(LASER0)
ldy #>LASER0
jsr EFFECT
ldx #<(1)
lda #<(LASER1)
ldy #>LASER1
jsr EFFECT
ldx #<(2)
lda #<(LASER2)
ldy #>LASER2
jmp EFFECT
Brick:
    ldx #<(0)
lda #<(BRICK0)
ldy #>BRICK0
jsr EFFECT
ldx #<(1)
lda #<(BRICK1)
ldy #>BRICK1
jsr EFFECT
ldx #<(2)
lda #<(BRICK2)
ldy #>BRICK2
jmp EFFECT
Alien:
    ldx #<(0)
lda #<(ALIEN0)
ldy #>ALIEN0
jsr EFFECT
ldx #<(1)
lda #<(ALIEN1)
ldy #>ALIEN1
jsr EFFECT
ldx #<(2)
lda #<(ALIEN2)
ldy #>ALIEN2
jmp EFFECT
Breakthrough:
    ldx #<(0)
lda #<(BREAKTHROUGH0)
ldy #>BREAKTHROUGH0
jsr EFFECT
ldx #<(1)
lda #<(BREAKTHROUGH1)
ldy #>BREAKTHROUGH1
jsr EFFECT
ldx #<(2)
lda #<(BREAKTHROUGH2)
ldy #>BREAKTHROUGH2
jmp EFFECT
Catch:
    ldx #<(0)
lda #<(CATCH0)
ldy #>CATCH0
jsr EFFECT
ldx #<(1)
lda #<(CATCH1)
ldy #>CATCH1
jsr EFFECT
ldx #<(2)
lda #<(CATCH2)
ldy #>CATCH2
jmp EFFECT
OpenFX:
    ldx #<(0)
lda #<(OPENFX0)
ldy #>OPENFX0
jsr EFFECT
ldx #<(1)
lda #<(OPENFX1)
ldy #>OPENFX1
jsr EFFECT
ldx #<(2)
lda #<(OPENFX2)
ldy #>OPENFX2
jmp EFFECT
Vaus:
    ldx #<(2)
lda #<(VAUS2)
ldy #>VAUS2
jsr EFFECT
ldx #<(1)
lda #<(VAUS1)
ldy #>VAUS1
jsr EFFECT
ldx #<(0)
lda #<(VAUS0)
ldy #>VAUS0
jmp EFFECT
Head:
    ldx #<(2)
lda #<(HEAD2)
ldy #>HEAD2
jsr EFFECT
ldx #<(1)
lda #<(HEAD1)
ldy #>HEAD1
jsr EFFECT
ldx #<(0)
lda #<(HEAD0)
ldy #>HEAD0
jmp EFFECT
Explosion:
    ldx #<(1)
lda #<(EXPLOSION1)
ldy #>EXPLOSION1
jsr EFFECT
ldx #<(0)
lda #<(EXPLOSION0)
ldy #>EXPLOSION0
jsr EFFECT
ldx #<(2)
lda #<(EXPLOSION2)
ldy #>EXPLOSION2
jmp EFFECT

OpeningSequen:
    jsr ResetCl
jsr StartCl
ldy #<(1*7-2)
jmp TUNE
NextScreen:
    jsr ResetCl
jsr StartCl
ldy #<(2*7-2)
jmp TUNE
GameOver:
    jsr ResetCl
jsr StartCl
ldy #<(5*7-2)
jmp TUNE
EnterName:
    jsr ResetCl
jsr StartCl
ldy #<(6*7-2)
jmp TUNE
ExtraLife:
    jsr ResetCl
jsr StartCl
ldy #<(7*7-2)
jmp TUNE
Title:
    jsr ResetCl
jsr StartCl
ldy #<(9*7-2)
jmp TUNE

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
//              INC BDR:JSR SOUND2:JSR FILTER;JSR SOUND0:JSR SOUND1
//              DEC BDR
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
    lda #<(57)
jsr WAITCLOCK00
jsr REFRESH
jsr RefScreen1
REF2:
    lda #<(117)
jsr WAITCLOCK00
jsr REFRESH
jsr RefScreen2
REF3:
    lda #<(172)
jsr WAITCLOCK00
jsr REFRESH
jsr RefScreen3
REF4:
    lda #<(237)
jsr WAITCLOCK00
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
    .byte <('0')
CD4:
    .byte <('0')
CD3:
    .byte <('0')
CD2:
    .byte <('0')
CD1:
    .byte <('0')
CD0:
    .byte <('0')
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
    lda #<(0)
sta RF
lda #<(Q)
sta FASTER
Fast1:
    lda FASTER
beq Fast2
jsr FaFo
dec FASTER
jmp Fast1
Fast2:
    ldx #<(CH0VALUE*1+CH1VALUE*2+CH2VALUE*4)
stx RF
rts

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

//=======================*******************************========================
//=======================*=== END OF DRIVER PROGRAM ===*========================
//=======================*******************************========================















SP: //=====================********************************=======================
//=======================*=== START OF MUSIC PROGRAM ===*=======================
//=======================********************************=======================

.label SIZE = EOVT2-$2000

* = $3F00

JUMPS:
    jmp INITSOUND
jmp MUSICTEST
jmp TUNE
jmp EFFECT
jmp FILTER
jmp SOUND0
jmp SOUND1
jmp SOUND2
jmp MUSIC0
jmp MUSIC1
jmp MUSIC2
jmp RefScreen1
jmp RefScreen2
jmp RefScreen3
jmp RefScreen4

vt0:
    .word retsubrut0
.word call0
.word goto0
.word callt0
.word HANG0 //gotot0
.word mpoke0
.word for0
.word next0
.word HANG0 //sload0
.word fload0
.word volume0
.word spoke0
.word HANG0 //code0
.word HANG0 //transp0
.word HANG0 //dmpoke0
.word dspoke0
.word HANG0 //master0
.word HANG0 //filter0
.word HANG0 //disown0
.word HANG0 //own0
.word HANG0 //mbendoff0
.word HANG0 //mbendon0
.word HANG0 //noise0
.word HANG0 //square0
.word freq0

vt1:
    .word retsubrut1
.word call1
.word goto1
.word HANG1 //callt1
.word HANG1 //gotot1
.word mpoke1
.word for1
.word next1
.word HANG1 //sload1
.word fload1
.word volume1
.word spoke1
.word HANG1 //code1
.word HANG1 //transp1
.word dmpoke1
.word dspoke1
.word HANG1 //master1
.word HANG1 //filter1
.word HANG1 //disown1
.word HANG1 //own1
.word HANG1 //mbendoff1
.word HANG1 //mbendon1
.word HANG1 //noise1
.word HANG1 //square1
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
.word HANG2 //spoke2
.word code2
.word HANG2 //transp2
.word dmpoke2
.word dspoke2
.word master2
.word filter2
.word HANG2 //disown2
.word HANG2 //own2
.word HANG2 //mbendoff2
.word HANG2 //mbendon2
.word HANG2 //noise2
.word HANG2 //square2
.word freq2

EOVT2:
    * = $2000

BOUNCE0:
    .word 8250, 0, -8250, 0
.byte <(1), <(2), <(1), <(1), <(1), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 8250
BOUNCE1:
    .word -8250, 0, 8250, 0
.byte <(1), <(1), <(1), <(2), <(1), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 16600
BOUNCE2:
    .word 8350, 0, -8350, 0
.byte <(1), <(1), <(1), <(1), <(2), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 16700
HIT0:
    .word 6175, 0, -6175, 0
.byte <(1), <(2), <(1), <(1), <(1), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 12350
HIT1:
    .word -12450, 0, 12450, 0
.byte <(1), <(1), <(1), <(2), <(1), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 24900
HIT2:
    .word 12550, 0, -12550, 0
.byte <(1), <(1), <(1), <(1), <(2), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 25100
EXPANSION0:
    .word 4, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(4)
.fill 8, 0
.word $0800
.byte <(65), <($00), <($F0), <(50), <(1)
.word 800
EXPANSION1:
    .word 4, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(4)
.fill 8, 0
.word $0800
.byte <(65), <($00), <($F0), <(50), <(1)
.word 810
EXPANSION2:
    .word 4, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(0), <(4)
.fill 8, 0
.word $0800
.byte <(65), <($00), <($F0), <(50), <(1)
.word 820
LASER0:
    .word -10000, -1000, -100, 0
.byte <(4), <(5), <(10), <(0), <(0), <(133)
.fill 8, 0
.word $0800
.byte <(65), <($09), <($B9), <(30), <(50)
.word 50000
LASER1:
    .word -10000, -1000, -100, 5500
.byte <(4), <(5), <(10), <(0), <(10), <(135)
.fill 8, 0
.word $0800
.byte <(67), <($09), <($B9), <(30), <(50)
.word 1
LASER2:
    .word -10000, -1000, -100, 3000
.byte <(4), <(5), <(10), <(0), <(20), <(135)
.fill 8, 0
.word $0800
.byte <(65), <($09), <($B9), <(30), <(50)
.word 1
BRICK0:
    .word 16500, 0, -16500, 0
.byte <(1), <(2), <(1), <(1), <(1), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 16500
BRICK1:
    .word -16500, 0, 16500, 0
.byte <(1), <(1), <(1), <(2), <(1), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 16600
BRICK2:
    .word 16700, 0, -16700, 0
.byte <(1), <(1), <(1), <(1), <(2), <(5)
.fill 10, 0
.byte <(33), <($03), <($8A), <(15), <(90)
.word 33400
ALIEN0:
    .word 1250, -13000, 0, 0
.byte <(9), <(1), <(0), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($15), <($9B), <(20), <(70)
.word 8250
ALIEN1:
    .word -2250, 19000, 0, 0
.byte <(9), <(1), <(1), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($15), <($9B), <(20), <(70)
.word 16600
ALIEN2:
    .word 3350, -27000, 0, 0
.byte <(7), <(1), <(0), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($15), <($9B), <(20), <(70)
.word 16700
BREAKTHROUGH0:
    .word -6000, -35, 10, 0
.byte <(10), <(80), <(255), <(0), <(0), <(4)
.byte <(255), <(0), <(0), <(0)
.word 8, 0, $0800
.byte <(65), <($19), <($BB), <(40), <(200)
.word 63500
BREAKTHROUGH1:
    .word -6000, -35, 10, 0
.byte <(10), <(80), <(255), <(0), <(4), <(4)
.byte <(255), <(0), <(0), <(0)
.word 8, 0, $0800
.byte <(65), <($19), <($BB), <(40), <(200)
.word 64000
BREAKTHROUGH2:
    .word -6000, -35, 10, 0
.byte <(10), <(80), <(255), <(0), <(8), <(4)
.byte <(255), <(0), <(0), <(0)
.word 8, 0, $0800
.byte <(65), <($19), <($BB), <(40), <(200)
.word 64500
CATCH0:
    .word 8250, 0, -8250, 0
.byte <(1), <(2), <(1), <(1), <(1), <(5)
.fill 10, 0
.byte <(33), <($02), <($A6), <(5), <(8)
.word 8250
CATCH1:
    .word -8250, 0, 8250, 0
.byte <(1), <(1), <(1), <(2), <(1), <(5)
.fill 10, 0
.byte <(33), <($02), <($A6), <(5), <(8)
.word 16600
CATCH2:
    .word 8350, 0, -8350, 0
.byte <(1), <(1), <(1), <(1), <(2), <(5)
.fill 10, 0
.byte <(33), <($02), <($A6), <(5), <(8)
.word 16700
OPENFX0:
    .word 1250, -11000, 0, 0
.byte <(10), <(1), <(0), <(0), <(1), <(5)
.fill 10, 0
.byte <(33), <($15), <($9B), <(20), <(140)
.word 8250
OPENFX1:
    .word -2250, 21000, 0, 0
.byte <(9), <(1), <(0), <(0), <(2), <(5)
.fill 10, 0
.byte <(33), <($15), <($9B), <(20), <(140)
.word 16600
OPENFX2:
    .word 3350, -26000, 0, 0
.byte <(8), <(1), <(0), <(0), <(3), <(5)
.fill 10, 0
.byte <(33), <($15), <($9B), <(20), <(140)
.word 16700
VAUS0:
    .word -6000, -50, 62000, 0
.byte <(10), <(40), <(1), <(0), <(0), <(5)
.byte <(255), <(0), <(0), <(0)
.word 8, 0, $0800
.byte <(65), <($19), <($BB), <(40), <(140)
.word 62001
VAUS1:
    .word -6000, -50, 62000, 0
.byte <(10), <(40), <(1), <(0), <(2), <(5)
.byte <(255), <(0), <(0), <(0)
.word 8, 0, $0800
.byte <(65), <($19), <($BB), <(40), <(140)
.word 63001
VAUS2:
    .word -6000, -50, 62000, 0
.byte <(10), <(40), <(1), <(0), <(4), <(5)
.byte <(255), <(0), <(0), <(0)
.word 8, 0, $0800
.byte <(65), <($19), <($BB), <(40), <(140)
.word 64001
HEAD0:
    .word 1250, -13000, 0, 0
.byte <(9), <(1), <(1), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($15), <($9A), <(10), <(60)
.word 8250
HEAD1:
    .word -2250, 19000, 0, 0
.byte <(9), <(1), <(1), <(0), <(5), <(5)
.fill 10, 0
.byte <(33), <($15), <($9A), <(10), <(60)
.word 16600
HEAD2:
    .word 3350, -27000, 0, 0
.byte <(7), <(1), <(1), <(0), <(0), <(5)
.fill 10, 0
.byte <(33), <($15), <($9A), <(10), <(60)
.word 16700
EXPLOSION0:
    .word -1250, 11000, 1000, -11000
.byte <(10), <(1), <(10), <(1), <(1), <(5)
.fill 8, 0
.word $0800
.byte <(65), <($CC), <($FC), <(254), <(254)
.word 10000
EXPLOSION1:
    .word 2250, -21000, 0, 0
.byte <(9), <(1), <(0), <(0), <(2), <(5)
.fill 8, 0
.word $0800
.byte <(65), <($CC), <($FC), <(254), <(254)
.word 22222
EXPLOSION2:
    .word -3350, 26000, 0, 0
.byte <(8), <(1), <(0), <(0), <(3), <(5)
.fill 8, 0
.word $0800
.byte <(65), <($CC), <($FC), <(254), <(254)
.word 34567

EOS:
    * = $3E00

* = EOS

ST: //============================================================================

D0:
    .fill 29, $DD
ST0L:
    .fill DEPTHOFSTACKS, $DD //                     stack (low bytes only)
ST0H:
    .fill DEPTHOFSTACKS, $DD //                    stack (high bytes only)
ST0C:
    .fill DEPTHOFSTACKS, $DD //                   stack(for/next counters)
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
KnackerBits:
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
CHTAB:
    .byte <($D402+0*7-$D400), <($D402+1*7-$D400), <($D402+2*7-$D400)
DTAB:
    .byte <(D0-D0), <(D1-D0), <(D2-D0)
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
//              DFL N80,N81,N82,N83,N84,N85,N86,N87,N88,N89
//              DFL N90,N91,N92,N93
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
//              DFH N80,N81,N82,N83,N84,N85,N86,N87,N88,N89
//              DFH N90,N91,N92,N93
.byte >(NSil)

//==============================================================================

jsr MUSIC0 //This useless routine is intended
jsr MUSIC1
jsr MUSIC2
jsr SOUND0 //to put hackers off, and MUST NOT
jsr SOUND1
jsr SOUND2
jsr FILTER //                  be used under ANY circumstances!
rts

TUNE:
    lda TUNETABLE+1,Y
sta KnackerBits
and #<(15)
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
rts

INITSOUND:
    jsr ResetCl //\
lda #<($97)
sta $DD00
ldx #<($16)
ResetLoop:
    lda #<(8)
sta $D400,X
lda #<(0)
sta $D400,X
dex
bpl ResetLoop
//              STX SFL0:STX SFL1:STX SFL2;[
sta S0+VRC
sta S1+VRC
sta S2+VRC
sta CUT+FMC
sta MFL0
sta MFL1
sta MFL2
stx FilterChannel
lda #<(%11110000)
sta $D417
lda #<(%00001111)
sta D418
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
lda #<(%00000000)
sta $D417
lda #<(%00001111) //      filters are "off" during the game!
sta $D418
//              LDA #0:STA SFL0,X
lda CHTAB,X
sta el2a+1
lda #<(8)
ldy CHTAB,X
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
lda S2+CFMD3
sta S2+FMD3C
lda S2+CFMD2
sta S2+FMD2C
lda S2+CFMD1
sta S2+FMD1C
lda S2+CFMD0
sta S2+FMD0C
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
//code0         LDA ^add3c0-1:PHA:LDA #add3c0-1:PHA:LDA (PC0),Y:STA IN:INY
//              LDA (PC0),Y:STA IN+1:JMP (IN)
//dmpoke0        LDA (PC0),Y:TAX:INY:LDA (PC0),Y:STA D0,X:INY:LDA (PC0),Y
//              STA D0+1,X:LDA #4:JMP addc0
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
//filter0       LDA (PC0),Y:STA filt0loop+1:INY:LDA (PC0),Y:STA filt0loop+2
//              LDX #15
//filt0loop     LDA $DDDD,X:STA CUTST,X:DEX:BPL filt0loop:JMP add3c0
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
//gotot0        LDA (PC0),Y:STA TR0:INY
goto0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
stx PC0
sta PC0+1
jmp read_byte0
//disown0       DEY:STY CUT+FMC:LDX #3:LDY #%11110000:DFB $2C
//master0a      LDY #%11110001:STY $D417
//master0b      STX FilterChannel:LDA #1:JMP addc0
//own0          LDX #0:BNE master0b
//master0       LDX #0:BEQ master0a
//mbendoff0     LDA #5:DFB $2C
//mbendon0      LDA #7:STA D0+FMC:TYA:JMP addc0
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
//sload0        LDA (PC0),Y:TAX:INY:LDA (PC0),Y:STA Z8:INY:LDA (PC0),Y:STA IN
//              INY:LDA (PC0),Y:STA IN+1:LDY Z8
//sload0loop    LDA (IN),Y:STA D0,X:DEX:DEY:BPL sload0loop:LDA #5:JMP addc0
spoke0:
    lda (PC0),Y
tax
iny
lda (PC0),Y
sta S0,X
jmp add3c0
//transp0       LDA (PC0),Y:STA TR0:LDA #2:JMP addc0
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
//square0       LDA #65OR 8:DFB $2C
//noise0        LDA #129OR 8:STA D0+VWF:LDA #1:JMP addc0

MC1:
//callt1        LDA (PC1),Y:STA TR1:INY:LDA #4:DFB $2C
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
//code1         LDA ^add3c1-1:PHA:LDA #add3c1-1:PHA:LDA (PC1),Y:STA IN:INY
//              LDA (PC1),Y:STA IN+1:JMP (IN)
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
//filter1       LDA (PC1),Y:STA filt1loop+1:INY:LDA (PC1),Y:STA filt1loop+2
//              LDX #15
//filt1loop     LDA $DDDD,X:STA CUTST,X:DEX:BPL filt1loop:JMP add3c1
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
//gotot1        LDA (PC1),Y:STA TR1:INY
goto1:
    lda (PC1),Y
tax
iny
lda (PC1),Y
stx PC1
sta PC1+1
jmp read_byte1
//disown1       DEY:STY CUT+FMC:LDX #3:LDY #%11110000:DFB $2C
//master1a      LDY #%11110010:STY $D417
//master1b      STX FilterChannel:LDA #1:JMP addc1
//own1          LDX #1:BNE master1b
//master1       LDX #1:BNE master1a
//mbendoff1     LDA #5:DFB $2C
//mbendon1      LDA #7:STA D1+FMC:TYA:JMP addc1
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
//sload1        LDA (PC1),Y:TAX:INY:LDA (PC1),Y:STA Z8:INY:LDA (PC1),Y:STA IN
//              INY:LDA (PC1),Y:STA IN+1:LDY Z8
//sload1loop    LDA (IN),Y:STA D1,X:DEX:DEY:BPL sload1loop:LDA #5:JMP addc1
//transp1       LDA (PC1),Y:STA TR1:LDA #2:JMP addc1
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
//gotot2        LDA (PC2),Y:STA TR2:INY
goto2:
    lda (PC2),Y
tax
iny
lda (PC2),Y
stx PC2
sta PC2+1
jmp read_byte2
//disown2       DEY:STY CUT+FMC:LDX #2:LDY #%11110000:DFB $2C
master2a:
    ldy #<(%11110100)
sty $D417
master2b:
    stx FilterChannel
ldx #<(%00011111) //the low-pass filter always gets selected
stx $D418
lda #<(1)
jmp addc2
//own2          LDX #2:BNE master2b
master2:
    ldx #<(2)
bne master2a
//mbendoff2     LDA #5:DFB $2C
//mbendon2      LDA #7:STA D2+FMC:TYA:JMP addc2
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
//              INY:STY SP2
//sload2        LDA (PC2),Y:TAX:INY:LDA (PC2),Y:STA Z8:INY:LDA (PC2),Y:STA IN
//              INY:LDA (PC2),Y:STA IN+1:LDY Z8
//sload2loop    LDA (IN),Y:STA D2,X:DEX:DEY:BPL sload2loop:LDA #5:JMP addc2
//spoke2        LDA (PC2),Y:TAX:INY:LDA (PC2),Y:STA S2,X:JMP add3c2
//transp2       LDA (PC2),Y:STA TR2:LDA #2:JMP addc2
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
bcc not_ctrl0
iny
adc #<(vt0-COM-1)
v0:
    sta v0+4
jmp (vt0)
js0:
    jmp st0
not_ctrl0:
    sta Z8
cmp #<(R)
bcc in_du_re0
sbc #<(R)
in_du_re0:
    cmp #<(Rest) //CMP #Sil:BEQ got.note0;@
beq js0
adc TR0
got_note0:
    tax //\
lda RF
and #<(1)
beq js0
NOTE0:
//              LDA SFL0:BEQ js0;[
lda #<(8)
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
lda D0+VADV
sta $D405
lda D0+VSRV
sta $D406
lda D0+VWF
sta S0+VWFG
and #<(%11110111)
sta $D404

//              LDX #PINIT+1
dll0: //          LDA D0,X:STA S0,X:DEX:BPL dll0:JSR transferpm0a:LDA S0+FMC

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
sty S0+CPMD1
sty S0+PMD1C

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
    cmp #<(Rest) //CMP #Sil:BEQ got.note1;@
beq js1
adc TR1
got_note1:
    tax //\
lda RF
and #<(2)
beq js1
NOTE1:
//              LDA SFL1:BEQ js1;[
lda #<(8)
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
lda D1+VADV
sta $D40C
lda D1+VSRV
sta $D40D
lda D1+VWF
sta S1+VWFG
and #<(%11110111)
sta $D40B

//              LDX #PINIT+1
dll1: //          LDA D1,X:STA S1,X:DEX:BPL dll1:JSR transferpm1a:LDA S1+FMC

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
//              LDA SFL2:BEQ js2;[
lda #<(8)
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
lda D2+VADV
sta $D413
lda D2+VSRV
sta $D414
lda D2+VWF
sta S2+VWFG
and #<(%11110111)
sta $D412

//              LDX #PINIT+1
dll2: //          LDA D2,X:STA S2,X:DEX:BPL dll2:JSR transferpm2a:LDA S2+FMC

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
//              LDA S0FCURR:ORA S0FCURR+1:BEQ FM0;@
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
//              AND #8:BNE olm0;]
//              LDA S0FCURR:ORA S0FCURR+1:BEQ xit0;@
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
//olm0          DEC S0+FOLDC:BNE xit0:LDY S0+FOLOD:STY S0+FOLDC:LDY S0+FOLCI;]
//              BPL no0:LDY S0+FOLII
//no0           LDX S0+FOLA:STX IN:LDX S0+FOLA+1:STX IN+1:LDA S0+FOLB:ADD (IN),Y
//              DEY:STY S0+FOLCI:TAY
//POKEFRQ0      LDX LoFrq,Y:LDA HiFrq,Y:STX $D400:STA $D401:RTS
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
    jsr transferf0+10
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
//              LDA S1FCURR:ORA S1FCURR+1:BEQ FM1;@
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
dec S1+PMD0C
txa
adc S1+PMG0
tax
tya
adc S1+PMG0+1
tay
jmp stpm1
pms11:
    lda S1+PMD1C
beq pmrep1
dec S1+PMD1C
txa
adc S1+PMG1
tax
tya
adc S1+PMG1+1
tay
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
//              LDA S1FCURR:ORA S1FCURR+1:BEQ xit1;@
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
    jsr transferf1+10
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
//              AND #8:BNE olm2;]
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
//olm2          DEC S2+FOLDC:BNE xit2:LDY S2+FOLOD:STY S2+FOLDC:LDY S2+FOLCI;]
//              BPL no2:LDY S2+FOLII
//no2           LDX S2+FOLA:STX IN:LDX S2+FOLA+1:STX IN+1:LDA S2+FOLB:ADD (IN),Y
//              DEY:STY S2+FOLCI:TAY
//POKEFRQ2      LDX LoFrq,Y:LDA HiFrq,Y:STX $D40E:STA $D40F:RTS
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
    jsr transferf2+10
jmp fcs12

MUSICTEST:
    lda MFL0
ora MFL1
ora MFL2
ora S0+VRC
ora S1+VRC
ora S2+VRC
rts

TUNETABLE:

EP: //======================******************************========================
//========================*=== END OF MUSIC PROGRAM ===*========================
//========================******************************========================
























//=========================********************=================================
//=========================*=== MUSIC DATA ===*=================================
SD: //=======================********************=================================

.word OPENINGSEQUE0, OPENINGSEQUE1, OPENINGSEQUE2
.byte <(9)
.word NEXTSCREEN0, NEXTSCREEN1, NEXTSCREEN2
.byte <(11)
.word $DDDD, $DDDD, $DDDD
.byte <($DD)
.word $DDDD, $DDDD, $DDDD
.byte <($DD)
.word OVER0, OVER1, OVER2
.byte <(13)
.word eNTER0, eNTER1, eNTER2
.byte <(3)
.word EXTRA0, EXTRA1, EXTRA2
.byte <(10)
.word $DDDD, $DDDD, $DDDD
.byte <($DD)
.word TITLE0, TITLE1, TITLE2
.byte <(4)

//======================== TITLE SCREEN MUSIC DATA =============================

TD00:
    .word 20, -20, 20, 0
.byte <(3), <(6), <(3), <(0), <(30), <(5)
.byte <(50), <(50), <(10), <(5)
.word 10, -10, $0800
.byte <(65), <($14), <($C8), <(255), <(250)
TD01:
    .word 35, -35, 35, 0
.byte <(3), <(5), <(2), <(0), <(10), <(5)
.fill 10, 0
.byte <(%00011001), <($A4), <($F9), <(20), <(254)

TITLE0:
    .byte <(FLoad), <(VRC)
.word TD00
.byte <(Rest), <(32)
.byte <(29), <(32)
.byte <(For), <(3), <(Rest), <(32), <(Next)
.byte <(31), <(32)
.byte <(For), <(3), <(Rest), <(32), <(Next)
.byte <(DSoke), <(FMDLY)
.word 32*4+256*7
.byte <(DSoke), <(FBG)
.word 60
.byte <(CT), <(-12)
.word TS20
.byte <(Moke), <(VSRV), <($8D)
.byte <(CT), <(0)
.word TS20a
.byte <(Soke), <(VADSD), <(1)
.byte <(FLoad), <(VRC)
.word TD01
.byte <(For), <(4), <(Rest), <(32), <(Next)
.byte <(For), <(4), <(67), <(16), <(66), <(16), <(64), <(16), <(62), <(16), <(60), <(16), <(59), <(16), <(57), <(16), <(55), <(16), <(Next)
.byte <(For), <(21), <(Rest), <(16), <(Next), <(Jmp)
.word TITLE0

TD10:
    .word 20, -20, 20, 0
.byte <(3), <(6), <(3), <(0), <(10), <(5)
.byte <(50), <(50), <(20), <(5)
.word 10, -10, $0800
.byte <(65), <($14), <($C4), <(255), <(5)
TL10:
    .byte <(0), <(3), <(9), <(12)
TL11:
    .byte <(0), <(3), <(7), <(12)
TL12:
    .byte <(0), <(5), <(11), <(12)
TL13:
    .byte <(0), <(5), <(9), <(12)
TD11:
    .word 0, 0, 1, 1, TL10
.byte <(0), <(3), <(0), <(8)
.byte <(50), <(50), <(20), <(0)
.word 10, -10, $0800
.byte <(65), <($00), <($F6), <(5), <(5)

TITLE1:
    .byte <(FLoad), <(VRC)
.word TD10
.byte <(Rest), <(32), <(29), <(32)
.byte <(For), <(3), <(Rest), <(32), <(Next)
.byte <(31), <(32)
.byte <(For), <(3), <(Rest), <(32), <(Next)
.byte <(DSoke), <(FMDLY)
.word 32*4+256*7
.byte <(DSoke), <(FBG)
.word 40
.byte <(FLoad), <(VRC)
.word TD11
.byte <(Rest), <(32)
.byte <(For), <(2), <(DMoke), <(FOLA)
.word TL10
.byte <(For), <(16), <(57), <(2), <(Next)
.byte <(DMoke), <(FOLA)
.word TL11
.byte <(For), <(16), <(57), <(2), <(Next)
.byte <(DMoke), <(FOLA)
.word TL12
.byte <(For), <(16), <(55), <(2), <(Next)
.byte <(DMoke), <(FOLA)
.word TL13
.byte <(For), <(16), <(55), <(2), <(Next), <(Next)
.byte <(For), <(7), <(DMoke), <(FOLA)
.word TL10
.byte <(For), <(3), <(Moke), <(FMC), <(8), <(57), <(2), <(Moke), <(FMC), <(0), <(57), <(2), <(Next), <(69), <(2)
.byte <(Moke), <(FMC), <(8), <(57), <(2), <(Moke), <(FMC), <(0), <(69), <(2)
.byte <(Moke), <(FMC), <(8), <(57), <(2), <(Moke), <(FMC), <(0), <(57), <(2), <(69), <(2)
.byte <(Moke), <(FMC), <(8), <(57), <(2), <(Moke), <(FMC), <(0), <(57), <(2), <(57), <(2), <(57), <(2)
.byte <(DMoke), <(FOLA)
.word TL11
.byte <(Moke), <(FMC), <(8), <(57), <(2), <(Moke), <(FMC), <(0), <(57), <(2), <(Moke), <(FMC), <(8)
.byte <(For), <(4), <(57), <(2), <(Next)
.byte <(For), <(2), <(Moke), <(FMC), <(0), <(69), <(2), <(Moke), <(FMC), <(8), <(57), <(2), <(Next), <(57), <(2)
.byte <(Moke), <(FMC), <(0), <(69), <(2), <(Moke), <(FMC), <(8), <(57), <(2)
.byte <(Moke), <(FMC), <(0), <(69), <(2), <(57), <(2), <(57), <(2)
.byte <(DMoke), <(FOLA)
.word TL12
.byte <(For), <(3), <(Moke), <(FMC), <(8), <(55), <(2), <(Moke), <(FMC), <(0), <(55), <(2), <(Next), <(72), <(2)
.byte <(Moke), <(FMC), <(8), <(55), <(2), <(Moke), <(FMC), <(0), <(72), <(2)
.byte <(Moke), <(FMC), <(8), <(55), <(2), <(Moke), <(FMC), <(0), <(55), <(2), <(72), <(2)
.byte <(Moke), <(FMC), <(8), <(55), <(2), <(Moke), <(FMC), <(0), <(55), <(2), <(55), <(2), <(55), <(2)
.byte <(DMoke), <(FOLA)
.word TL13
.byte <(Moke), <(FMC), <(8), <(55), <(2), <(Moke), <(FMC), <(0), <(55), <(2), <(Moke), <(FMC), <(8)
.byte <(For), <(4), <(55), <(2), <(Next)
.byte <(For), <(2), <(Moke), <(FMC), <(0), <(72), <(2), <(Moke), <(FMC), <(8), <(55), <(2), <(Next), <(55), <(2)
.byte <(Moke), <(FMC), <(0), <(72), <(2), <(Moke), <(FMC), <(8), <(55), <(2)
.byte <(Moke), <(FMC), <(0), <(72), <(2), <(55), <(2), <(55), <(2), <(Next)
.byte <(For), <(21), <(Rest), <(16), <(Next), <(Jmp)
.word TITLE1

TC20:
    .word 333, -30, 0, 0
.byte <(3), <(20), <(0), <(0), <(0), <(4)
.word 1
TD20:
    .word 20, -20, 20, 28
.byte <(3), <(6), <(3), <(0), <(40), <(7)
.byte <(50), <(50), <(40), <(5)
.word 10, -10, $0800
.byte <(65), <($14), <($C8), <(255), <(50)
TC21:
    .word 333, -45, -5, -1
.byte <(3), <(20), <(10), <(50), <(0), <(4)
.word 1
TD21:
    .word 25, -25, 25, 0
.byte <(2), <(4), <(2), <(0), <(6), <(5)
.byte <(50), <(50), <(0), <(5)
.word 20, -20, $0600
.byte <(65), <($14), <($E8), <(30), <(40)
TF22:
    .word 32, 0, 0, 0
.byte <(255), <(0), <(0), <(0), <(10), <(4)
TS20:
    .byte <(Rest), <(32)
TS20a:
    .byte <(33), <(32), <(Rest), <(26), <(35), <(6), <(36), <(32), <(Rest), <(26), <(38), <(2), <(40), <(2), <(36), <(2)
.byte <(33), <(32), <(Rest), <(26), <(35), <(6), <(36), <(32), <(Rest), <(32), <(Ret)
TS21:
    .byte <(33), <(4), <(33), <(4), <(45), <(1), <(Sil), <(1), <(33), <(4), <(33), <(8), <(33), <(2), <(45), <(2), <(28), <(2), <(31), <(4)
.byte <(33), <(4), <(33), <(2), <(33), <(2), <(45), <(1), <(Sil), <(1), <(33), <(4), <(33), <(4), <(33), <(4), <(33), <(2), <(45), <(2), <(33), <(2), <(35), <(4)
.byte <(36), <(4), <(36), <(2), <(36), <(2), <(48), <(1), <(Sil), <(3), <(36), <(2), <(36), <(4), <(36), <(2), <(36), <(2), <(36), <(2), <(48), <(2)
.byte <(Freq)
.word TF22
.byte <(31), <(6)
.byte <(Freq)
.word TD21
.byte <(36), <(2), <(24), <(2), <(36), <(2), <(24), <(2), <(48), <(4), <(36), <(2), <(36), <(4), <(36), <(2), <(52), <(2), <(36), <(2), <(48), <(2)
.byte <(40), <(2), <(43), <(2), <(45), <(2), <(Ret)
TX20:
    lda #<(%00010000)
sta D418
rts
TX21:
    lda #<(%00000000)
sta D418
sta $D417
sta FilterChannel
rts

TITLE2:
    .byte <(Filter)
.word TC21
TITLE2Loop:
    .byte <(FLoad), <(VRC)
.word TD20
.byte <(RestR), <(32*4-40), <(5+R), <(40)
.byte <(For), <(4), <(Rest), <(32), <(Next), <(Moke), <(FMC), <(5), <(31), <(32)
.byte <(For), <(3), <(Rest), <(32), <(Next)
.byte <(DSoke), <(FMDLY)
.word 32*4+256*7
.byte <(DSoke), <(FBG)
.word 20
.byte <(Moke), <(FMC), <(5)
.byte <(Call)
.word TS20
.byte <(FLoad), <(VRC)
.word TD21
.byte <(Master), <(Code)
.word TX20
.byte <(Call)
.word TS21
.byte <(Call)
.word TS21
.byte <(FLoad), <(VRC)
.word TD01
.byte <(Filter)
.word TC20
.byte <(For), <(3), <(Rest), <(32), <(Next)
.byte <(For), <(2), <(67), <(16), <(66), <(16), <(64), <(16), <(62), <(16), <(60), <(16), <(59), <(16), <(57), <(16), <(55), <(16), <(Next)
.byte <(67), <(16), <(66+R), <(16*4-41)
.byte <(Filter)
.word TC21
.byte <(FLoad), <(VRC)
.word TD20
.byte <(RestR), <(1), <(5+R), <(40)
.byte <(FLoad), <(VRC)
.word TD21
.byte <(Call)
.word TS21
.byte <(Call)
.word TS21
.byte <(Code)
.word TX21
.byte <(Rest), <(16)
.byte <(For), <(10), <(Rest), <(32), <(Next), <(Jmp)
.word TITLE2Loop

//======================= ENTER NAME DATA ======================================

ED00:
    .word 30, -30, 30, 0
.byte <(3), <(5), <(2), <(0), <(8), <(5)
.fill 8, 0
.word $0800
.byte <(%01001001), <($06), <($99), <(4), <(40)
ES00:
    .byte <(55), <(4), <(57), <(2), <(58), <(2), <(57), <(3), <(Rest), <(1), <(55), <(3), <(Rest), <(1), <(Ret)
ES01:
    .byte <(57), <(3), <(Rest), <(1), <(62), <(3), <(Rest), <(1), <(57), <(7), <(Rest), <(1), <(Ret)
ES02:
    .byte <(Call)
.word ES00
.byte <(Call)
.word ES01
.byte <(Call)
.word ES00
.byte <(55), <(4), <(54), <(4), <(55), <(4), <(57), <(4)
.byte <(Call)
.word ES00
.byte <(Call)
.word ES01
.byte <(58), <(4), <(60), <(2), <(62), <(2), <(60), <(3), <(Rest), <(1), <(58), <(3), <(Rest), <(1)
.byte <(60), <(3), <(Rest), <(1), <(65), <(3), <(Rest), <(1), <(60), <(7), <(Rest), <(1)
.byte <(For), <(2)
.byte <(For), <(3), <(69), <(2), <(69), <(2), <(Rest), <(4), <(Next), <(69), <(2), <(67), <(2), <(65), <(2), <(60), <(2), <(62), <(28)
.byte <(Rest), <(4), <(Next), <(Ret)

eNTER0:
    .byte <(FLoad), <(VRC)
.word ED00
.byte <(RestR), <(1)
eNTER0Loop:
    .byte <(For), <(4), <(Call)
.word ES02
.byte <(Next)
.byte <(For), <(64), <(Rest), <(4), <(Next)
.byte <(Jmp)
.word eNTER0Loop

ED10:
    .word 30, -30, 30, 0
.byte <(2), <(4), <(2), <(0), <(6), <(5)
.fill 8, 0
.word $0800
.byte <(%00101001), <($06), <($99), <(4), <(40)

eNTER1:
    .byte <(FLoad), <(VRC)
.word ED10
.byte <(RestR), <(1)
eNTER1Loop:
    .byte <(For), <(3), <(Call)
.word ES02
.byte <(Rest), <(2), <(Next)
.byte <(For), <(250), <(Rest), <(1), <(Next)
.byte <(Call)
.word ES02
.byte <(Jmp)
.word eNTER1Loop

ED20:
    .fill 14, 0
.byte <(255), <(0), <(1), <(4)
.word 100, 0, $0200
.byte <(65), <($06), <($48), <(10), <(20)
ES20:
    .byte <(For), <(2), <(0), <(2), <(0), <(2), <(12), <(2), <(12), <(2), <(Next), <(Ret)
ES21:
    .byte <(CT), <(31)
.word ES20
.byte <(CT), <(29)
.word ES20
.byte <(CT), <(27)
.word ES20
.byte <(CT), <(26)
.word ES20
.byte <(Ret)

eNTER2:
    .byte <(FLoad), <(VRC)
.word ED20
.byte <(RestR), <(1)
eNTER2Loop:
    .byte <(Call)
.word ES21
.byte <(CT), <(31)
.word ES20
.byte <(CT), <(29)
.word ES20
.byte <(CT), <(27)
.word ES20
.byte <(CT), <(29)
.word ES20
.byte <(Call)
.word ES21
.byte <(Call)
.word ES21
.byte <(Jmp)
.word eNTER2Loop

//======================= EXTRA LIFE DATA ======================================

XV00:
    .byte <(17), <($23), <($E4), <(20), <(10)

EXTRA0:
    .byte <(Vlm)
.word XV00
.byte <(RestR), <(21), <(55), <(1), <(61), <(1), <(62), <(1), <(65), <(1), <(67), <(1), <(71), <(1), <(Ret)

EXTRA1:
    .byte <(Vlm)
.word XV00
.byte <(RestR), <(11), <(55), <(1), <(61), <(1), <(62), <(1), <(65), <(1), <(67), <(1), <(71), <(1), <(74), <(1), <(Ret)

XV20:
    .byte <(65), <($24), <($A4), <(20), <(4)

EXTRA2:
    .byte <(Vlm)
.word XV20
.byte <(DMoke), <(PINIT)
.word $0800
.byte <(RestR), <(1)
.byte <(55), <(1), <(61), <(1), <(62), <(1), <(65), <(1), <(67), <(1), <(71), <(1), <(74), <(1), <(Ret)

//======================== GAME OVER DATA ======================================

OF00:
    .word -N43+1, 0, N43-1, 0
.byte <(1), <(3), <(1), <(9), <(9), <(5)
OV00:
    .byte <(%00011001), <($13), <($E4), <(2), <(10)

OVER0:
    .byte <(Vlm)
.word OV00
.byte <(RestR), <(27)
OVER0a:
    .byte <(58), <(1), <(53), <(1), <(55), <(1), <(50), <(1), <(53), <(1), <(48), <(1), <(50), <(1), <(46), <(1)
.byte <(Freq)
.word OF00
.byte <(43), <(3), <(Moke), <(FMC), <(0), <(43), <(2), <(Ret)

OVER1:
    .byte <(Vlm)
.word OV00
.byte <(RestR), <(04), <(Jmp)
.word OVER0a

OV20:
    .byte <(73), <($24), <($A4), <(2), <(4)

OVER2:
    .byte <(Vlm)
.word OV20
.byte <(DMoke), <(PINIT)
.word $0800
.byte <(RestR), <(1), <(Jmp)
.word OVER0a

//================== OPENING SEQUENCE MUSIC DATA ===============================

SD00:
    .word 14, -14, 14, 0
.byte <(5), <(10), <(5), <(0), <(20), <(5)
.byte <(255), <(0), <(0), <(4)
.word 10, 0, $0800
.byte <(%01001001), <($06), <($98), <(5), <(30)

OPENINGSEQUE0:
    .byte <(FLoad), <(VRC)
.word SD00
.byte <(48), <(3), <(48), <(1), <(55), <(8), <(54+R), <(12), <(55+R), <(12), <(57+R), <(12), <(55), <(16)
.byte <(48), <(3), <(48), <(1), <(55), <(8), <(57), <(1), <(55), <(1), <(54), <(1), <(57), <(1), <(55), <(8), <(Ret)

OPENINGSEQUE1:
    .byte <(FLoad), <(VRC)
.word SD00
.byte <(43), <(3), <(43), <(1), <(52), <(8), <(51+R), <(12), <(52+R), <(12), <(53+R), <(12), <(52), <(16)
.byte <(43), <(3), <(43), <(1), <(52), <(8), <(53), <(1), <(52), <(1), <(51), <(1), <(53), <(1), <(52), <(8), <(Ret)

SC20:
    .word 333, -45, 20, -20
.byte <(3), <(20), <(50), <(50), <(0), <(4)
.word 1
SD20:
    .word 15, -15, 15, 0
.byte <(4), <(8), <(4), <(0), <(14), <(5)
.byte <(25), <(0), <(0), <(4)
.word 10, 0, $0800
.byte <(%01001001), <($06), <($98), <(5), <(30)

OPENINGSEQUE2:
    .byte <(FLoad), <(VRC)
.word SD20
.byte <(Master), <(Filter)
.word SC20
.byte <(For), <(3), <(36), <(4), <(31), <(4), <(Next), <(36), <(2), <(31), <(2), <(33), <(2), <(35), <(2)
.byte <(For), <(2), <(36), <(4), <(31), <(4), <(Next), <(36), <(16), <(Rest), <(8), <(Ret)

//================= NEXT SCREEN/NEXT LIFE MUSIC DATA ===========================

NEXTSCREEN2:
    .byte <(FLoad), <(VRC)
.word SD20
.byte <(Master), <(Filter)
.word SC20
.byte <(Rest), <(3), <(27), <(1), <(27), <(1), <(27), <(1), <(27), <(3), <(29), <(3), <(33), <(3)
.byte <(For), <(2), <(36+R), <(16), <(31+R), <(17), <(Next), <(36), <(6), <(Ret)

NEXTSCREEN1:
    .byte <(RestR), <(20)
NEXTSCREEN0:
    .byte <(FLoad), <(VRC)
.word SD00
.byte <(55), <(2), <(55), <(1), <(58), <(6), <(57+R), <(16), <(55+R), <(17), <(53+R), <(16), <(57+R), <(17), <(55), <(6), <(Ret)

PE: //============================================================================

.label CH0VALUE = 1
.label CH1VALUE = 1
.label CH2VALUE = 1
.label Q = 0
.label refsp = $080 //                         Opening Sequence (100Hz P.A.L.)

//^^^^^^^^^^^^^ This is the end of Mart's source file... (or is it?) ^^^^^^^^^^^