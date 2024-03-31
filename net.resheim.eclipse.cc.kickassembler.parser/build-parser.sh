#!/bin/bash
antlr4 -o src/main/java/net/resheim/eclipse/cc/kickassembler/parser \
    -package net.resheim.eclipse.cc.kickassembler.parser KickAssembler.g4
