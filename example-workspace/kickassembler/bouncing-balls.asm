// Three bouncing hardware sprites with SIDScore background music and wall hits.
// @sidscore "bouncing-balls.sidscore" as Bounces at $3000
.plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive"

// BASIC: 10 SYS (4096)
*=$0800 "BASIC Start"
    .byte $00, $0e, $08, $0a, $00, $9e, $20
    .byte $28, $34, $30, $39, $36, $29, $00, $00, $00

.const VIC = $d000
.const SCREEN = $0400
.const SPRITE_DATA = $2000
.const SPRITE_POINTER = SPRITE_DATA / 64
.const LEFT = 24
.const RIGHT_HI = 1
.const RIGHT_LO = 64       // 320: rightmost sprite pixel is at 343
.const TOP = 50
.const BOTTOM = 229       // bottommost sprite pixel is at 249

// Signed one-pixel velocities. X uses separate low and high bytes.
ball_x_lo: .byte 48, 132, 216
ball_x_hi: .byte 0, 0, 0
ball_y:    .byte 72, 120, 190
ball_dx:   .byte 1, $ff, 1
ball_dy:   .byte 1, 1, $ff
x_mask:    .byte 1, 2, 4
sprite_msb:.byte 0
music_frames_left: .byte 201

*=$1000 "Bouncing Balls"
Start:
    sei
    jsr $e544             // clear the default text screen
    lda $dd02
    ora #3
    sta $dd02
    lda $dd00
    ora #3                 // VIC bank 0: sprite data at $2000
    sta $dd00
    lda #$14              // screen $0400, character ROM
    sta $d018
    lda #0
    sta $d020
    sta $d021
    sta $d01c             // single-color sprites
    sta $d01d             // no X expansion
    sta $d017             // no Y expansion
    lda #SPRITE_POINTER
    sta SCREEN + $03f8
    sta SCREEN + $03f9
    sta SCREEN + $03fa
    lda #2
    sta $d027             // red
    lda #3
    sta $d028             // cyan
    lda #7
    sta $d029             // yellow
    lda #7
    sta $d015             // enable sprites 0-2
    jsr DrawBalls
    lda #1                 // tune 1 supplies voices 1 and 2
    jsr Bounces.init

Frame:
    jsr WaitFrame
    lda music_frames_left
    bne PlayMusic
    lda #1                 // the short PAL tune runs for 201 play calls
    jsr Bounces.init
    lda #201
    sta music_frames_left
PlayMusic:
    jsr Bounces.play
    dec music_frames_left
    jsr MoveBalls
    jsr DrawBalls
    jmp Frame

// One call per PAL video frame, independent of the KERNAL IRQ.
WaitFrame:
    lda $d012
    cmp #$ff
    bne WaitFrame
WaitNextFrame:
    lda $d012
    cmp #$ff
    beq WaitNextFrame
    rts

MoveBalls:
    ldx #0
MoveNextBall:
    lda ball_dx,x
    bmi MoveLeft
MoveRight:
    inc ball_x_lo,x
    bne CheckRight
    inc ball_x_hi,x
CheckRight:
    lda ball_x_hi,x
    beq MoveVertical
    lda ball_x_lo,x
    cmp #RIGHT_LO
    bcc MoveVertical
    lda #RIGHT_LO
    sta ball_x_lo,x
    lda #RIGHT_HI
    sta ball_x_hi,x
    lda #$ff
    sta ball_dx,x
    jsr HitWall
    jmp MoveVertical
MoveLeft:
    lda ball_x_lo,x
    bne DecLeftLow
    dec ball_x_hi,x
DecLeftLow:
    dec ball_x_lo,x
    lda ball_x_hi,x
    bne MoveVertical
    lda ball_x_lo,x
    cmp #LEFT
    bcs MoveVertical
    lda #LEFT
    sta ball_x_lo,x
    lda #1
    sta ball_dx,x
    jsr HitWall

MoveVertical:
    lda ball_dy,x
    bmi MoveUp
MoveDown:
    inc ball_y,x
    lda ball_y,x
    cmp #BOTTOM
    bcc MoveDone
    lda #BOTTOM
    sta ball_y,x
    lda #$ff
    sta ball_dy,x
    jsr HitWall
    jmp MoveDone
MoveUp:
    dec ball_y,x
    lda ball_y,x
    cmp #TOP
    bcs MoveDone
    lda #TOP
    sta ball_y,x
    lda #1
    sta ball_dy,x
    jsr HitWall
MoveDone:
    inx
    cpx #3
    beq MoveAllDone
    jmp MoveNextBall
MoveAllDone:
    rts

// The effect is on tune 2, so tune 1 keeps playing throughout a hit.
HitWall:
    txa
    pha
    jsr Bounces.tune2.effect_WallHit
    pla
    tax
    rts

DrawBalls:
    lda #0
    sta sprite_msb
    ldx #0
    ldy #0
DrawNextBall:
    lda ball_x_lo,x
    sta VIC,y
    lda ball_y,x
    sta VIC + 1,y
    lda ball_x_hi,x
    beq DrawNextPosition
    lda sprite_msb
    ora x_mask,x
    sta sprite_msb
DrawNextPosition:
    iny
    iny
    inx
    cpx #3
    bne DrawNextBall
    lda sprite_msb
    sta $d010
    rts

HostEnd:
*=$2000 "Ball sprite"
BallSprite:
    .byte $00,$3c,$00, $01,$ff,$80, $03,$ff,$c0
    .byte $07,$ff,$e0, $0f,$ff,$f0, $0f,$ff,$f0
    .byte $1f,$ff,$f8, $1f,$ff,$f8, $1f,$ff,$f8
    .byte $1f,$ff,$f8, $1f,$ff,$f8, $1f,$ff,$f8
    .byte $1f,$ff,$f8, $1f,$ff,$f8, $1f,$ff,$f8
    .byte $0f,$ff,$f0, $0f,$ff,$f0, $07,$ff,$e0
    .byte $03,$ff,$c0, $01,$ff,$80, $00,$3c,$00
    .byte 0
