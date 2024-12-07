/*******************************************************************************
 * Copyright (c) 2010, 2018 IBM Corporation and others.
 *
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License 2.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IMemoryBlock;

/**
 * Example memory block
 */
public class VICEMemoryBlock extends VICEDebugElement implements IMemoryBlock {


	/**
	 * The bytes
	 */
	private byte[] fBytes = null;
	private int fStart, fLength;

	/**
	 * Constructs a new memory block
	 */
	public VICEMemoryBlock(VICEDebugTarget target, int start, int length, byte[] source) {
		super(target);
		fBytes = new byte[(int) length];
		fStart = start;
		fLength = length;
		System.arraycopy(source, start, fBytes, 0, length);
	}

	@Override
	public long getStartAddress() {
		return fStart;
	}

	@Override
	public long getLength() {
		return fLength;
	}

	@Override
	public byte[] getBytes() throws DebugException {
		return fBytes;
	}

	@Override
	public boolean supportsValueModification() {
		return true;
	}

	@Override
	public void setValue(long offset, byte[] bytes) throws DebugException {
		int i = 0;
		long off = offset;
		while (off < fBytes.length && i < bytes.length) {
			fBytes[(int)off++] = bytes[i++];
		}
		fireChangeEvent(DebugEvent.CONTENT);
	}

}
