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

import java.math.BigInteger;

import org.eclipse.debug.core.model.MemoryByte;
import org.eclipse.debug.internal.ui.DebugUIPlugin;
import org.eclipse.debug.internal.ui.views.memory.renderings.RenderingsUtil;
import org.eclipse.debug.ui.IDebugUIConstants;
import org.eclipse.debug.ui.memory.AbstractTableRendering;

@SuppressWarnings("restriction")
public class EightBitHexRendering extends AbstractTableRendering {

	public EightBitHexRendering(String renderingId) {
		super(renderingId);
	}

	public String getString(String dataType, BigInteger address, MemoryByte[] data) {
		StringBuilder strBuffer = new StringBuilder();

		String paddedStr = DebugUIPlugin.getDefault().getPreferenceStore().getString(IDebugUIConstants.PREF_PADDED_STR);

		for (MemoryByte memByte : data) {
			if (memByte.isReadable()) {
				strBuffer.append(new String(RenderingsUtil.convertByteToCharArray(memByte.getValue())));
			} else {
				// pad with padded string
				strBuffer.append(paddedStr);
			}
		}
		return strBuffer.toString().toUpperCase();
	}

	@Override
	public byte[] getBytes(String dataType, BigInteger address, MemoryByte[] currentValues, String data) {
		return RenderingsUtil.convertHexStringToByteArray(data, currentValues.length, getNumCharsPerByte());
	}

	@Override
	public int getNumCharsPerByte() {
		return 2;
	}
}
