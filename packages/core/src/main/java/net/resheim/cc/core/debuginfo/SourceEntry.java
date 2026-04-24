/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.core.debuginfo;

import java.nio.file.Path;

public class SourceEntry {

    private final int fileNumber;
    private final Path path;

    public SourceEntry(String input) {
        String[] split = input.strip().split(",", 2);
        this.fileNumber = Integer.parseInt(split[0]);
        this.path = Path.of(split[1]).normalize();
    }

    public int getFileNumber() {
        return fileNumber;
    }

    public Path getPath() {
        return path;
    }

    @Override
    public String toString() {
        return "File #" + fileNumber + " - " + path;
    }
}
