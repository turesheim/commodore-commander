/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.language;

import java.io.IOException;
import java.nio.file.Path;

public interface KickAssemblerSourceTreeParser {

    AssemblySourceNode parse(Path rootSource) throws IOException;
}
