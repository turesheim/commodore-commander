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

import java.nio.file.Path;
import java.util.Optional;

import net.resheim.cc.core.debuginfo.LineMapping;
import net.resheim.cc.core.debuginfo.ProgramDebugInfo;

public class ProgramDebugInfoBreakpointMapper implements SourceBreakpointMapper {

    private final ProgramDebugInfo programDebugInfo;

    public ProgramDebugInfoBreakpointMapper(ProgramDebugInfo programDebugInfo) {
        this.programDebugInfo = programDebugInfo;
    }

    @Override
    public Optional<ViceBreakpointSpec> map(Path source, int line) {
        Optional<LineMapping> mapping = programDebugInfo.findLineMapping(source, line);
        return mapping.map(value -> new ViceBreakpointSpec(value.getStartAddress(), value.getEndAddress(),
                false, false, true));
    }
}
