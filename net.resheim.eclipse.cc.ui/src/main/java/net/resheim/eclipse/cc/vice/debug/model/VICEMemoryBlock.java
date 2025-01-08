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
package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IMemoryBlock;

/**
 * A basic memory block – we should probably not be using this one
 */
public class VICEMemoryBlock extends VICEDebugElement implements IMemoryBlock {


	protected int fStart, fLength;

	/**
	 * Constructs a new memory block
	 */
	public VICEMemoryBlock(VICEDebugTarget target, int start, int length) {
		super(target);
		fStart = start;
		fLength = length;
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
		byte[] bytes = new byte[(int) fLength];
		VICEDebugTarget target = (VICEDebugTarget) getDebugTarget();
		System.arraycopy(target.getComputerMemory(), fStart, bytes, 0, fLength);
		return bytes;
	}

	@Override
	public boolean supportsValueModification() {
		return true;
	}

	@Override
	public void setValue(long offset, byte[] bytes) throws DebugException {
		// Use ExtendedVICEMemoryBlock
	}

}
