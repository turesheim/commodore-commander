/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.debugadapter;

import java.util.List;

import net.resheim.cc.core.debuginfo.ProgramDebugInfo;

/**
 * TODO: replace this placeholder with a headless monitor session that composes
 * a TypeScript/Node VICE process launcher, monitor transport, command sender,
 * response decoder, and event mapper.
 */
public class UnimplementedViceDebugSession implements ViceDebugSession {

    private final ProgramDebugInfo programDebugInfo;

    public UnimplementedViceDebugSession(ProgramDebugInfo programDebugInfo) {
        this.programDebugInfo = programDebugInfo;
    }

    @Override
    public ProgramDebugInfo programDebugInfo() {
        return programDebugInfo;
    }

    @Override
    public byte[] readMemory(int startAddress, int endAddress) {
        throw unsupported("readMemory");
    }

    @Override
    public void writeMemory(int startAddress, byte[] values) {
        throw unsupported("writeMemory");
    }

    @Override
    public void setBreakpoints(List<ViceBreakpointSpec> breakpoints) {
        throw unsupported("setBreakpoints");
    }

    @Override
    public void resume() {
        throw unsupported("resume");
    }

    @Override
    public void suspend() {
        throw unsupported("suspend");
    }

    @Override
    public void terminate() {
        throw unsupported("terminate");
    }

    private UnsupportedOperationException unsupported(String method) {
        return new UnsupportedOperationException(
                "TODO: implement ViceDebugSession." + method + " without Eclipse debug APIs");
    }
}
