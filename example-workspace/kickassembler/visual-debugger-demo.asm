//////////////////////////////////////////////////////////////////////////////
// visual-debugger-demo.asm
//
// Small C64 visual-debugger fixture:
// - writes screen codes and color RAM directly
// - installs sprite 0 bitmap data at $2000
// - moves sprite 0 around the visible screen
//////////////////////////////////////////////////////////////////////////////

// 10 SYS (4096)
*=$0800 "BASIC Start"
        .byte $00
        .byte $0e, $08
        .byte $0a, $00
        .byte $9e
        .byte $20, $28, $34, $30, $39, $36, $29
        .byte $00, $00, $00

.const SCREEN = $0400
.const COLOR = $d800
.const VIC = $d000
.const BORDER = $d020
.const BACKGROUND = $d021
.const CIA2_PRA = $dd00
.const CIA2_DDRA = $dd02
.const VIC_MEMORY = $d018
.const SPRITE_ENABLE = $d015
.const SPRITE_X_MSB = $d010
.const SPRITE_POINTERS = SCREEN + $03f8
.const SPRITE_DATA = $2000
.const SPRITE_POINTER = SPRITE_DATA / 64
.const WHITE = $01
.const RED = $02
.const CYAN = $03
.const GREEN = $05
.const YELLOW = $07
.const LIGHT_BLUE = $0e
.const LIGHT_GREY = $0f
.const ROW_2 = 40 * 2
.const ROW_4 = 40 * 4
.const ROW_6 = 40 * 6
.const ROW_8 = 40 * 8
.const SPRITE_MIN_X = 24
.const SPRITE_MAX_X_LO = 44       // 300 - 256
.const SPRITE_MIN_Y = 58
.const SPRITE_MAX_Y = 190

sprite_x_lo:  .byte 48
sprite_x_hi:  .byte 0
sprite_y:     .byte 90
sprite_dx:    .byte 1
sprite_dy:    .byte 1
frame_counter:.byte 0

title:
        // "VISUAL DEBUGGER DEMO"
        .byte 22, 9, 19, 21, 1, 12, 32, 4, 5, 2, 21, 7, 7, 5, 18, 32, 4, 5, 13, 15
title_end:
.const TITLE_LENGTH = title_end - title

screen_line:
        // "SCREEN AND COLOR RAM"
        .byte 19, 3, 18, 5, 5, 14, 32, 1, 14, 4, 32, 3, 15, 12, 15, 18, 32, 18, 1, 13
screen_line_end:
.const SCREEN_LINE_LENGTH = screen_line_end - screen_line

sprite_line:
        // "SPRITE ZERO MOVES"
        .byte 19, 16, 18, 9, 20, 5, 32, 26, 5, 18, 15, 32, 13, 15, 22, 5, 19
sprite_line_end:
.const SPRITE_LINE_LENGTH = sprite_line_end - sprite_line

watch_line:
        // "WATCH D000 D001 D010 D018"
        .byte 23, 1, 20, 3, 8, 32, 4, 48, 48, 48, 32, 4, 48, 48, 49, 32, 4, 48, 49, 48, 32, 4, 48, 49, 56
watch_line_end:
.const WATCH_LINE_LENGTH = watch_line_end - watch_line

*=$1000 "Main Start"
Start:
        sei
        jsr SelectVicBank0
        lda #$14                    // screen $0400, character ROM at $1000
        sta VIC_MEMORY
        jsr SetupSprite
AfterBasicReady:
        nop                         // DEBUG: breakpoint after BASIC ready screen
        jsr ClearScreen
        jsr WriteText
        cli

MainLoop:
        jsr WaitFrame               // DEBUG: stop here to inspect raster state
        jsr MoveSprite              // DEBUG: step here and watch sprite labels
        jmp MainLoop

SelectVicBank0:
        lda CIA2_DDRA
        ora #%00000011
        sta CIA2_DDRA
        lda CIA2_PRA
        ora #%00000011              // VIC bank $0000-$3fff
        sta CIA2_PRA
        rts

ClearScreen:
        ldx #$00
        lda #$20
ClearScreenLoop:
        sta SCREEN,x
        sta SCREEN + $0100,x
        sta SCREEN + $0200,x
        sta SCREEN + $0300,x
        inx
        bne ClearScreenLoop

        ldx #$00
        lda #LIGHT_GREY
ClearColorLoop:
        sta COLOR,x
        sta COLOR + $0100,x
        sta COLOR + $0200,x
        sta COLOR + $0300,x
        inx
        bne ClearColorLoop
        rts

WriteText:
        ldx #$00
TitleLoop:
        lda title,x
        sta SCREEN + ROW_2,x
        lda #YELLOW
        sta COLOR + ROW_2,x
        inx
        cpx #TITLE_LENGTH
        bne TitleLoop

        ldx #$00
ScreenLineLoop:
        lda screen_line,x
        sta SCREEN + ROW_4,x
        lda #CYAN
        sta COLOR + ROW_4,x
        inx
        cpx #SCREEN_LINE_LENGTH
        bne ScreenLineLoop

        ldx #$00
SpriteLineLoop:
        lda sprite_line,x
        sta SCREEN + ROW_6,x
        lda #GREEN
        sta COLOR + ROW_6,x
        inx
        cpx #SPRITE_LINE_LENGTH
        bne SpriteLineLoop

        ldx #$00
WatchLineLoop:
        lda watch_line,x
        sta SCREEN + ROW_8,x
        lda #WHITE
        sta COLOR + ROW_8,x
        inx
        cpx #WATCH_LINE_LENGTH
        bne WatchLineLoop
        rts

SetupSprite:
        lda #SPRITE_POINTER
        sta SPRITE_POINTERS
        lda #RED
        sta VIC + $27               // sprite 0 color
        lda #$01
        sta SPRITE_ENABLE
        lda VIC + $1c
        and #%11111110              // sprite 0 single-color mode
        sta VIC + $1c
        lda VIC + $1d
        and #%11111110              // normal X size
        sta VIC + $1d
        lda VIC + $17
        and #%11111110              // normal Y size
        sta VIC + $17
        jsr UpdateSpriteRegisters
        rts

WaitFrame:
        lda VIC + $12
        cmp #$f8
        bne WaitFrame
WaitFrameDone:
        lda VIC + $12
        cmp #$f8
        beq WaitFrameDone
        rts

MoveSprite:
        inc frame_counter
        lda frame_counter
        and #$0f
        sta BORDER
        eor #$06
        sta BACKGROUND

        lda sprite_dx
        bmi MoveLeft
MoveRight:
        inc sprite_x_lo
        bne CheckRightEdge
        inc sprite_x_hi
CheckRightEdge:
        lda sprite_x_hi
        beq UpdateY
        lda sprite_x_lo
        cmp #SPRITE_MAX_X_LO
        bcc UpdateY
        lda #SPRITE_MAX_X_LO
        sta sprite_x_lo
        lda #$01
        sta sprite_x_hi
        lda #$ff
        sta sprite_dx
        jmp UpdateY

MoveLeft:
        lda sprite_x_lo
        bne MoveLeftNoBorrow
        lda sprite_x_hi
        beq LeftEdge
        dec sprite_x_hi
MoveLeftNoBorrow:
        dec sprite_x_lo
        lda sprite_x_hi
        bne UpdateY
        lda sprite_x_lo
        cmp #SPRITE_MIN_X
        bcs UpdateY
LeftEdge:
        lda #SPRITE_MIN_X
        sta sprite_x_lo
        lda #$00
        sta sprite_x_hi
        lda #$01
        sta sprite_dx

UpdateY:
        lda sprite_dy
        bmi MoveUp
MoveDown:
        inc sprite_y
        lda sprite_y
        cmp #SPRITE_MAX_Y
        bcc UpdateSprite
        lda #SPRITE_MAX_Y
        sta sprite_y
        lda #$ff
        sta sprite_dy
        jmp UpdateSprite

MoveUp:
        dec sprite_y
        lda sprite_y
        cmp #SPRITE_MIN_Y
        bcs UpdateSprite
        lda #SPRITE_MIN_Y
        sta sprite_y
        lda #$01
        sta sprite_dy

UpdateSprite:
        jsr UpdateSpriteRegisters
        rts

UpdateSpriteRegisters:
        lda sprite_x_lo
        sta VIC + $00
        lda sprite_y
        sta VIC + $01
        lda sprite_x_hi
        beq ClearSpriteXHigh
        lda SPRITE_X_MSB
        ora #%00000001
        sta SPRITE_X_MSB
        rts
ClearSpriteXHigh:
        lda SPRITE_X_MSB
        and #%11111110
        sta SPRITE_X_MSB
        rts

*=$2000 "Sprite 0 Bitmap"
Sprite0Bitmap:
        .byte %00000000, %01111110, %00000000
        .byte %00000001, %10000001, %10000000
        .byte %00000010, %00000000, %01000000
        .byte %00000100, %00111100, %00100000
        .byte %00001000, %01000010, %00010000
        .byte %00010000, %10000001, %00001000
        .byte %00100001, %00000000, %10000100
        .byte %00100010, %01100110, %01000100
        .byte %01000100, %01100110, %00100010
        .byte %01001000, %00000000, %00010010
        .byte %01010000, %10000001, %00001010
        .byte %01010000, %01000010, %00001010
        .byte %01001000, %00111100, %00010010
        .byte %01000100, %00000000, %00100010
        .byte %00100010, %00011000, %01000100
        .byte %00100001, %11111111, %10000100
        .byte %00010000, %00011000, %00001000
        .byte %00001000, %00011000, %00010000
        .byte %00000100, %00111100, %00100000
        .byte %00000010, %01000010, %01000000
        .byte %00000001, %10000001, %10000000
        .byte $00
