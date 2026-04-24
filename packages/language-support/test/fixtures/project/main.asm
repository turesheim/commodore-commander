#import "lib/shared.asm"
#importif FEATURE_ENABLED "lib/conditional.asm"
#import "vendor/macros.asm"
#import "missing.asm"

.const SCREEN = $0400
.var currentRow = 0

MainSprite:
.byte $00, $01, $02, $03
.byte $04, $05, $06, $07

EntryPoint:
    lda #$00
    rts
