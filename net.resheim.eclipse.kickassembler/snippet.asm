.label zpLabel = $10

lda #0
sta $d020
sta $d021

lda.abs $0040,x   // Uses absolute mode
lda.a $0030,x     // Same as abs (abbreviation)  
stx.zp zpLabel,y  // Uses zeropage mode
stx.z zpLabel,y   // Same as zp (abbreviation)
