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

import java.math.BigInteger;
import java.util.ArrayList;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IMemoryBlockExtension;
import org.eclipse.debug.core.model.IMemoryBlockRetrieval;
import org.eclipse.debug.core.model.IMemoryBlockRetrievalExtension;
import org.eclipse.debug.core.model.MemoryByte;
import org.eclipse.debug.internal.ui.memory.IPersistableDebugElement;
import org.eclipse.debug.internal.ui.preferences.IDebugPreferenceConstants;

/**
 * Memory Block Implementation
 *
 */
// We're using internal API, which probably should have been public. Alternatives?
@SuppressWarnings("restriction")
public class ExtendedVICEMemoryBlock extends VICEMemoryBlock
		implements IMemoryBlockExtension, IPersistableDebugElement {

	private String fExpression;

	private boolean isEnabled = true;

	private BigInteger fBaseAddress;

	private int fLength;

	private ArrayList<Object> fConnections = new ArrayList<>();

	/**
	 * Creates memory block
	 *
	 * @param debugTarget
	 * @param expression
	 * @param context
	 * @param address
	 */
	public ExtendedVICEMemoryBlock(VICEDebugTarget target, int start, int length, String expression,
			Object context) {
		super(target, start, length);
		fExpression = expression;
		fBaseAddress = BigInteger.valueOf(1024);
		fLength = 1000;
	}

	@Override
	public BigInteger getBigBaseAddress() throws DebugException {
		return fBaseAddress;
	}

	@Override
	public boolean supportBaseAddressModification() throws DebugException {
		return false;
	}

	@Override
	public void setBaseAddress(BigInteger address) throws DebugException {
		fBaseAddress = address;
	}

	@Override
	synchronized public MemoryByte[] getBytesFromOffset(BigInteger offset, long length) throws DebugException {
		BigInteger address = fBaseAddress.subtract(offset);
		return getBytesFromAddress(address, length);
	}

	@Override
	public MemoryByte[] getBytesFromAddress(BigInteger address, long length) throws DebugException {
		VICEDebugTarget target = (VICEDebugTarget) getDebugTarget();
		byte[] data = target.getComputerMemory();
		try {
			MemoryByte[] byteUnit = new MemoryByte[(int) length];
			for (int j = 0; j < length; j++) {
				MemoryByte oneByte = new MemoryByte(data[address.intValue() + j]);
				oneByte.setBigEndian(true);
				oneByte.setWritable(true);
				oneByte.setReadable(true);
				byteUnit[j] = oneByte;
			}
			return byteUnit;
		} catch (RuntimeException e) {
			throw e;
		}
	}

	@Override
	public void connect(Object object) {

		if (!fConnections.contains(object)) {
			fConnections.add(object);
		}

		if (fConnections.size() == 1) {
			enable();
		}
	}

	/**
	 * Enable this memory block
	 */
	private void enable() {
		isEnabled = true;
	}

	@Override
	public void disconnect(Object object) {

		if (fConnections.contains(object)) {
			fConnections.remove(object);
		}

		if (fConnections.isEmpty()) {
			disable();
		}
	}

	@Override
	public Object[] getConnections() {
		return fConnections.toArray();
	}

	/**
	 * Disable this memory block
	 */
	private void disable() {
		isEnabled = false;
	}

	@Override
	public boolean supportsValueModification() {
		// XXX: We assume that memory always can be modified. In practice this may not
		// be the case.
		return true;
	}

	@Override
	public void setValue(BigInteger offset, byte[] bytes) throws DebugException {
		try {
			VICEDebugTarget target = (VICEDebugTarget) getDebugTarget();
			target.setComputerMemory(fBaseAddress.longValue() + offset.longValue(), bytes);
//			fConnections.forEach(c -> {
//				if
//			});
			// ask the engine to modify memory at specified address
			fireChangeEvent(DebugEvent.CONTENT);
		} catch (RuntimeException e) {
//			IStatus status = new Status(IStatus.ERROR, MemoryViewSamplePlugin.PLUGIN_ID, 0,
//					Messages.SampleMemoryBlock_0, e);
//			DebugException exception = new DebugException(status);
//			throw exception;
			throw e;
		}
	}

	@Override
	public String getModelIdentifier() {
		return getDebugTarget().getModelIdentifier();
	}

	@SuppressWarnings("unchecked")
	@Override
	public <T> T getAdapter(Class<T> adapter) {
		if (adapter.equals(IPersistableDebugElement.class)) {
			return (T) this;
		}
		if (adapter.equals(IMemoryBlockRetrievalExtension.class)) {
			return (T) getDebugTarget();
		}
		return super.getAdapter(adapter);
	}

	@Override
	public String getExpression() {
		return fExpression;
	}

	@Override
	public void dispose() throws DebugException {
		// XXX: remove this memory block from debug target
		// fDebugTarget.removeMemoryBlock(this);
	}

	/**
	 * @return is enabled
	 */
	public boolean isEnabled() {
		return isEnabled;
	}

	@Override
	public IMemoryBlockRetrieval getMemoryBlockRetrieval() {
		return getDebugTarget();
	}

	@Override
	public boolean supportsChangeManagement() {
		return true;
	}

	@Override
	public int getAddressableSize() throws DebugException {
		return 1;
	}

	@Override
	public int getAddressSize() throws DebugException {
		return 2;
	}

	@Override
	public BigInteger getMemoryBlockStartAddress() throws DebugException {
		return fBaseAddress;
	}

	@Override
	public BigInteger getMemoryBlockEndAddress() throws DebugException {
		return BigInteger.valueOf(fBaseAddress.intValue() + fLength);
	}

	@Override
	public void setValue(long offset, byte[] bytes) throws DebugException {
		// do not need to implement for IMemoryBlockExtension
	}

	@Override
	public BigInteger getBigLength() throws DebugException {
		// return -1 by default and default length is calculated
		return BigInteger.valueOf(fLength);
	}

	// org.eclipse.debug.ui.memory.AbstractTableRendering uses properties or
	// preferences to determine how to render a memory block, so we specify
	// useful values here.
	@Override
	public Object getProperty(Object context, String propertyId) throws CoreException {
		if (IDebugPreferenceConstants.PREF_COL_SIZE_BY_MODEL.equals(propertyId)) {
			return 1;
		}
		if (IDebugPreferenceConstants.PREF_ROW_SIZE_BY_MODEL.equals(propertyId)) {
			return 16;
		}
		return null;
	}

	@Override
	public void setProperty(Object context, String propertyId, Object value) throws CoreException {

	}

	@Override
	public boolean supportsProperty(Object context, String propertyId) {
		if (IDebugPreferenceConstants.PREF_COL_SIZE_BY_MODEL.equals(propertyId)) {
			return true;
		}
		if (IDebugPreferenceConstants.PREF_ROW_SIZE_BY_MODEL.equals(propertyId)) {
			return true;
		}
		return false;
	}
}
