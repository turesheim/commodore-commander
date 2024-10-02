/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
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
package net.resheim.eclipse.cc.launch;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.sourcelookup.AbstractSourceLookupParticipant;

import net.resheim.eclipse.cc.builder.model.Assembly;
import net.resheim.eclipse.cc.builder.model.LineMapping;
import net.resheim.eclipse.cc.vice.debug.model.VICEStackFrame;

public class AssemblySourceLookupParticipant extends AbstractSourceLookupParticipant {

	@Override
	public String getSourceName(Object object) throws CoreException {
		if (object instanceof VICEStackFrame) {
			VICEStackFrame stackFrame = (VICEStackFrame)object;
			Assembly assembly = stackFrame.getAssembly();
			// determine the address of the program counter
			int pc = Short.toUnsignedInt(stackFrame.getProgramCounter());
			// attempt to determine a line mapping for the program counter
			LineMapping lineMapping = assembly.getLineMapping(pc);
			// this may not match anything in the program as it could be in the
			// kernal somewhere
			if (lineMapping != null) {
				IFile file = assembly.findFile(lineMapping.getFileIndex());
				// remove the project part as we currently do not support dealing
				// with source files in multiple projects
				return file.getFullPath().removeFirstSegments(1).toPortableString();
			} else {
				System.err.println("Cannot determine line mapping for PC " + String.format("%04X", pc));
				return null;
			}
		}
		return null;
	}

}