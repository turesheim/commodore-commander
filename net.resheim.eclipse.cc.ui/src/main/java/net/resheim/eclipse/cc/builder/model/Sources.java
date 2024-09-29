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

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlTransient;
import jakarta.xml.bind.annotation.XmlValue;

/**
 * A list of source files included in the application. Each file is numbered by
 * the order it was included. The number is further used in {@link Segment} and
 * {@link Labels} in order to reference the source file.
 *
 * @since 1.0
 */
@XmlAccessorType(XmlAccessType.FIELD)
public class Sources {

	@XmlValue
	private String sourcesData;

	@XmlTransient
	private List<SourceFile> sourceFiles;

	/**
	 * Computes a list source files in the order they were included into the
	 * application.
	 *
	 * @return a list of source files used in the application
	 */
	public List<SourceFile> getSourceFiles() {
		if (sourceFiles == null) {
			sourceFiles = new CopyOnWriteArrayList<>();
			String[] split = sourcesData.split("\\r?\\n");
			for (String string : split) {
				if (!string.isBlank()) {
					SourceFile sf = new SourceFile(string.strip());
					sourceFiles.add(sf);
				}
			}
		}
		return sourceFiles;
	}

}