/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *
 *   Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.cc.builder.model;

import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.Path;

/**
 * A numbered source file in an {@link Assembly}.
 *
 * @since 1.0
 */
public class SourceFile {

	private int fileNumber;

	private IPath path;

	public SourceFile(String input) {
		String[] split = input.strip().split(",");
		fileNumber = Integer.parseInt(split[0]);
		path = Path.fromOSString(split[1]);
	}

	public int getFileNumber() {
		return fileNumber;
	}

	public IPath getPath() {
		return path;
	}

	public String toString() {
		return "File #" + fileNumber + " - " + path;
	}

}
