package net.resheim.eclipse.cc.vice.debug.model;

import java.util.HashMap;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IRegister;
import org.eclipse.debug.core.model.IRegisterGroup;

/**
 * A VICE register group. We currently only keep track of the main CPU
 * registers.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICERegisterGroup extends VICEDebugElement implements IRegisterGroup {

	private HashMap<Byte, VICERegister> registers = new HashMap<>();

	private byte pcId;

	public VICERegisterGroup(IDebugTarget target) {
		super(target);
	}

	@Override
	public String getName() throws DebugException {
		return "6510 registers";
	}

	@Override
	public IRegister[] getRegisters() throws DebugException {
		return registers.values().toArray(new IRegister[registers.size()]);
	}

	@Override
	public boolean hasRegisters() throws DebugException {
		return !registers.isEmpty();
	}

	public void addRegister(byte id, String name, short value, byte size) {
		registers.put(id, new VICERegister(getDebugTarget(), this, name, value, size));
		if (name.equals("PC")) {
			pcId = id;
		}
	}

	public VICERegister getRegisterByName(String name) throws DebugException {
		for (VICERegister register : registers.values()) {
			if (register.getName().equals(name))
				return register;
		}
		return null;
	}

	public VICERegister getRegisterById(Byte id) throws DebugException {
		return registers.get(id);

	}

	public short getProgramCounter() throws DebugException {
		VICERegister viceRegister = registers.get(pcId);
		if (viceRegister != null) {
			Scalar value = (Scalar) viceRegister.getValue();
			return value.getValue();
		}
		return -1;
	}

}
