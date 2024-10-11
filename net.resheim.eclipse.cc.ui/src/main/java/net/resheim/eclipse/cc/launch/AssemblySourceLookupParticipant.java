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

import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.sourcelookup.AbstractSourceLookupParticipant;

import net.resheim.eclipse.cc.vice.debug.model.VICEStackFrame;

public class AssemblySourceLookupParticipant extends AbstractSourceLookupParticipant {

	@Override
	public String getSourceName(Object object) throws CoreException {
		if (object instanceof VICEStackFrame) {
			VICEStackFrame stackFrame = (VICEStackFrame)object;

			String fileName = stackFrame.getFileName();
			if (fileName != null) {
				return fileName;
			}
		}
		return null;
	}

}
