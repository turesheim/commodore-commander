package net.resheim.eclipse.cc.vice.debug;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IRegister;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IValue;

/**
 * Representation of a VICE register value. A register is a special kind of
 * variable that is contained in a register group. Each register has a name and
 * a value.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICERegister extends VICEDebugElement implements IRegister {

	private String name;
	private Scalar value;
	private short lastScalar;
	private short currentScalar;
	private IRegisterGroup group;

	public VICERegister(IDebugTarget target, IRegisterGroup group, String name, short value, byte size) {
		super(target);
		this.name = name;
		this.group = group;
		this.value = new Scalar(target, value, size);
		this.lastScalar = value;
		this.currentScalar = value;
	}

	@Override
	public IValue getValue() throws DebugException {
		return value;
	}

	@Override
	public String getName() throws DebugException {
		return name;
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		return null;
	}

	@Override
	public boolean hasValueChanged() throws DebugException {
		return lastScalar != currentScalar;
	}

	@Override
	public void setValue(String expression) throws DebugException {
		lastScalar = currentScalar;
		value.setValue(Short.parseShort(expression));
		currentScalar = Short.parseShort(expression);
	}

	/**
	 * Sets the scalar value of the contained {@link IValue} directly instead of
	 * having to create a new instance.
	 *
	 * @param newScalar
	 * @throws DebugException
	 */
	public void internalSetValue(short newScalar) {
		lastScalar = currentScalar;
		value.setValue(newScalar);
		currentScalar = newScalar;
	}

	@Override
	public void setValue(IValue value) throws DebugException {
	}

	@Override
	public boolean supportsValueModification() {
		return false;
	}

	@Override
	public boolean verifyValue(String expression) throws DebugException {
		return false;
	}

	@Override
	public boolean verifyValue(IValue value) throws DebugException {
		return false;
	}

	@Override
	public IRegisterGroup getRegisterGroup() throws DebugException {
		return group;
	}

}
