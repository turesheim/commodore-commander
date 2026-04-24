//////////////////////////////////////////////////////////////////////////////
// debug-demo.asm
//
// A small Commodore Commander debugging fixture for Theia.
//
// Useful breakpoint lines are marked with DEBUG.
//////////////////////////////////////////////////////////////////////////////

// 10 SYS (4096)
*=$0800 "BASIC Start"
        .byte $00
        .byte $0e, $08
        .byte $0a, $00
        .byte $9e
        .byte $20, $28, $34, $30, $39, $36, $29
        .byte $00, $00, $00

.const CLEAR_SCREEN = $e544
.const SCREEN = $0400
.const COLOR = $d800
.const BORDER = $d020
.const BACKGROUND = $d021
.const WHITE = $01
.const LIGHT_BLUE = $0e
.const ROW_10 = 40 * 10
.const ROW_12 = 40 * 12

copy_index:    .byte 0
current_color: .byte LIGHT_BLUE
frame_counter: .byte 0
demo_state:    .byte 0
scratch_value: .byte 0

message:
        .text @"theia debug demo"
message_end:
.const MESSAGE_LENGTH = message_end - message

status_line:
        .text @"break step inspect"
status_line_end:
.const STATUS_LENGTH = status_line_end - status_line

*=$1000 "Main Start"
Start:
AfterBasicReady:
        sei
        jsr MarkStepTarget           // DEBUG: breakpoint after BASIC ready screen
        nop                          // DEBUG: step-over landing point
        jsr ClearScreen              // setup; this clears the visible screen

        lda #$00
        sta copy_index
        sta frame_counter
        sta demo_state

        lda #LIGHT_BLUE
        sta current_color
        sta BORDER
        lda #$06
        sta BACKGROUND

CopyMessage:
        ldx copy_index                // DEBUG: watch X and copy_index change
        lda message,x
        sta SCREEN + ROW_10,x
        lda current_color
        sta COLOR + ROW_10,x
        inx
        stx copy_index
        cpx #MESSAGE_LENGTH
        bne CopyMessage
 
        lda #$01
        sta demo_state                // DEBUG: inspect demo_state label address

PrepareStatus:
        ldx #$00
StatusLoop:
        lda status_line,x
        sta SCREEN + ROW_12,x
        lda #WHITE
        sta COLOR + ROW_12,x
        inx
        cpx #STATUS_LENGTH
        bne StatusLoop

        lda #$02
        sta demo_state
        ldx #$00

PulseLoop:
        stx frame_counter             // DEBUG: continue here repeatedly
        txa
        and #$0f
        sta current_color
        sta BORDER
        sta COLOR + ROW_10
        jsr Delay
        inx
        cpx #$20
        bne PulseLoop

Done:
        lda #$03
        sta demo_state                // DEBUG: final state before idle loop
        cli

Hold:
        jmp Hold                      // keep VICE alive for pause/inspect

ClearScreen:
        jsr CLEAR_SCREEN
        rts

MarkStepTarget:
        lda #$40                     // step into reaches this subroutine
        sta scratch_value
        inc scratch_value
        rts

Delay:
        ldy #$20
DelayOuter:
        lda #$ff
        sta scratch_value
DelayInner:
        dec scratch_value
        bne DelayInner
        dey
        bne DelayOuter
        rts
