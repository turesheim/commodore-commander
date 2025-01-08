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
package net.resheim.eclipse.cc.ui.debug;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.ui.memory.IMemoryRendering;
import org.eclipse.debug.ui.memory.IMemoryRenderingTypeDelegate;

public class CCRenderingTypeDelegate implements IMemoryRenderingTypeDelegate {

	public CCRenderingTypeDelegate() {
	}

	@Override
	public IMemoryRendering createRendering(String id) throws CoreException {
		if ("net.resheim.cc.debug.ui.rendering.characters".equals(id)) {
			return new CharacterRendering(id);
		}
		if ("net.resheim.cc.debug.ui.rendering.hex".equals(id)) {
			return new EightBitHexRendering(id);
		}
		return null;
	}

}
