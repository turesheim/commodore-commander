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

public interface SourceBreakpointMapper {

    Optional<ViceBreakpointSpec> map(Path source, int line);
}
