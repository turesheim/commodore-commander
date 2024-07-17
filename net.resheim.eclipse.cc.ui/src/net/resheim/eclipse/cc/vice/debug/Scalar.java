package net.resheim.eclipse.cc.vice.debug;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;

/**
 * A simple {@link IValue} representing a scalar. It has a value and a size in
 * in the number of bits required to represent the value.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Scalar extends VICEDebugElement implements IValue {

	private short value;
	private byte size;

	public Scalar(IDebugTarget target, short value, byte size) {
		super(target);
		this.setValue(value);
		this.size = size;
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		if (size == 8) {
			return "byte";
		}
		if (size == 16) {
			return "short";
		}
		return null;
	}

	@Override
	public String getValueString() throws DebugException {
		if (size == 8) {
			return String.format("$%02X", value);
		} else {
			return String.format("$%04X", value);
		}
	}

	@Override
	public boolean isAllocated() throws DebugException {
		return true;
	}

	@Override
	public IVariable[] getVariables() throws DebugException {
		return new IVariable[0];
	}

	@Override
	public boolean hasVariables() throws DebugException {
		return false;
	}

	public void setValue(short value) {
		this.value = value;
	}

}
