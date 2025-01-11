/**
 * Copyright (c) 2025 Torkild Ulvøy Resheim
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
package net.resheim.eclipse.cc.vice.debug.model.data;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;

import net.resheim.eclipse.cc.builder.model.Label;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;

/**
 * Represents the top level node of a named data block. This simply contains an
 * {@link IValue} that holds the actual data.
 */
public class NamedDataVariable extends VICEDebugElement implements IVariable {

	private Label label;

	public NamedDataVariable(IDebugTarget target, Label label) {
		super(target);
		this.label = label;
	}


	@Override
	public void setValue(String expression) throws DebugException {
	}

	@Override
	public void setValue(IValue value) throws DebugException {
	}

	@Override
	public boolean supportsValueModification() {
		return true;
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
	public IValue getValue() throws DebugException {
		return new ArrayValueSet(getDebugTarget(), label);
	}

	@Override
	public String getName() throws DebugException {
		return label.getName();
	}

	@Override
	public String getReferenceTypeName() throws DebugException {
		return "";
	}

	@Override
	public boolean hasValueChanged() throws DebugException {
		return false;
	}


}
