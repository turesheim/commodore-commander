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

import java.util.EnumSet;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.LineBreakpoint;

/**
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Checkpoint extends LineBreakpoint {

	/**
	 * The operation that will trigger the checkpoint.
	 */
	public enum Operation {
		LOAD(0x01), STORE(0x02), EXEC(0x04);

		private final byte value;

		Operation(int value) {
            this.value = (byte) value;
        }

		public byte getValue() {
			return value;
		}

		public static EnumSet<Operation> parseByte(byte b) {
			EnumSet<Operation> instructions = EnumSet.noneOf(Operation.class);
			for (Operation instruction : Operation.values()) {
				if ((b & instruction.getValue()) != 0) {
					instructions.add(instruction);
				}
			}
			return instructions;
		}
	}

	/**
	 * <p>
	 * Each time the specified checkpoint is examined, the condition is evaluated.
	 * If it evalutes to true, the checkpoint is activated. Otherwise, it is
	 * ignored. If registers are specified in the expression, the values used are
	 * those at the time the checkpoint is examined, not when the condition is set.
	 * The condition can use registers (A, X, Y, PC, SP, FL and other cpu specific
	 * registers (see manual)) and compare them (==, !=, <, >, <=, >=) against other
	 * registers or constants.
	 * </p>
	 * <p>
	 * RL can be used to refer to the current rasterline, and CY refers to the
	 * current cycle in the line. Full expressions are also supported (+, -, *, /,
	 * &, |, &&, ||). This lets you for example check specific bits in the FL
	 * register using the bitwise boolean operators (& and |). Parentheses are also
	 * supported in the expression.
	 * </p>
	 * <p>
	 * Registers can be the registers of other devices; this is denoted by a
	 * memspace prefix (i.e., c:, 8:, 9:, 10:, 11:) Examples: A == $0, X == Y, 8:X
	 * == X You can also compare against the value of a memory location in a
	 * specific bank, i.e you can break only if the vic register $d020 is $f0. use
	 * the form @[bankname]:[$&lt;address&;gt] | [.label]. Note this is for the C:
	 * memspace only.
	 * </p>
	 * <p>
	 * Examples : if @io:$d020 == $f0, if @io:.vicBorder == $f0 As an extension as
	 * the previous case, you can also dereference an expression, using the
	 * form @[bankname]:(expression) . The parentheses around the expression
	 * distinguish it from the previous form.
	 * </p>
	 *
	 * <pre>
	 * Example: break load 0 $ffff if @cpu:(pc - $1) == $37
	 * </pre>
	 */
	private String condition;

	/**
	 * Wheter nor not the checkpoint is enabled – and whether or not to stop when
	 * hit.
	 */
	private boolean enabled = false;

	private int endAddress;

	/** Break when the address is executed */
	private boolean exec = false;

	private boolean hasCondition = false;

	private boolean currentlyHit = false;

	private int hitCount;

	private int ignoreCount;

	/** Break when the address is read */
	private boolean load = false;

	private boolean stopWhenHit = false;

	/**
	 * Describes which part of the computer to checkpoint:
	 * <ul>
	 * <li>0x00: main memory</li>
	 * <li>0x01: drive 8</li>
	 * <li>0x02: drive 9</li>
	 * <li>0x03: drive 10</li>
	 * <li>0x04: drive 11</li>
	 * </ul>
	 */
	private int memspace;

	/** The checkpoint number */
	private int number;

	private int startAddress;

	/** Break when the address is written */
	private boolean store = false;

	/**
	 * Deletes the checkpoint after it has been hit once. This is similar to "until"
	 * command, but it will not resume the emulator.
	 */
	private boolean temporary = false;

	private EnumSet<Operation> operation;

	public Checkpoint() {
		super();
	}

	public Checkpoint(IResource resource, int lineNumber) throws CoreException {
		super();
		IMarker marker = resource.createMarker("net.resheim.eclipse.cc.checkpointMarker");
		setMarker(marker);
		setEnabled(true);
		ensureMarker().setAttribute(IBreakpoint.ENABLED, true);
		ensureMarker().setAttribute(IMarker.MESSAGE, "Checkpoint");
		ensureMarker().setAttribute(IBreakpoint.ID, getModelIdentifier());
		ensureMarker().setAttribute(IMarker.LINE_NUMBER, lineNumber);
	}

//	public Checkpoint(IResource resource, int adddress) throws CoreException {
//		super();
//		IMarker marker = resource.createMarker("net.resheim.eclipse.cc.checkpointMarker");
//		setMarker(marker);
//		setEnabled(true);
//		ensureMarker().setAttribute(IBreakpoint.ENABLED, true);
//		ensureMarker().setAttribute(IMarker.MESSAGE, "Breakpoint at address ");
//		ensureMarker().setAttribute(IBreakpoint.ID, getModelIdentifier());
//	}

	public String getCondition() {
		return condition;
	}

	public int getEndAddress() {
		return endAddress;
	}

	public int getHitCount() {
		return hitCount;
	}

	public int getIgnoreCount() {
		return ignoreCount;
	}

	public int getMemspace() {
		return memspace;
	}

	public int getNumber() {
		return number;
	}

	public int getStartAddress() {
		return startAddress;
	}

	public boolean hasCondition() {
		return hasCondition;
	}

//	public boolean isEnabled() throws CoreException {
//		return super.isEnabled();
//		// return enabled;
//	}

	public boolean isExec() {
		return exec;
	}

	public boolean isLoad() {
		return load;
	}

	public boolean isStore() {
		return store;
	}

	public boolean isTemporary() {
		return temporary;
	}

	public void setCondition(String condition) {
		this.condition = condition;
	}

//	public void setEnabled(boolean enabled) throws CoreException {
//		super.setEnabled(enabled);
//		this.enabled = enabled;
//	}

	public void setEndAddress(int endAddress) {
		this.endAddress = endAddress;
	}

	public void setExec(boolean exec) {
		this.exec = exec;
	}

	public void setHasCondition(boolean hasCondition) {
		this.hasCondition = hasCondition;
	}

	public void setHitCount(int hitCount) {
		this.hitCount = hitCount;
	}

	public void setIgnoreCount(int ignoreCount) {
		this.ignoreCount = ignoreCount;
	}

	public void setLoad(boolean load) {
		this.load = load;
	}

	public void setMemspace(int memspace) {
		this.memspace = memspace;
	}

	public void setNumber(int number) {
		this.number = number;
	}

	public void setStartAddress(int startAddress) {
		this.startAddress = startAddress;
	}

	public void setStore(boolean store) {
		this.store = store;
	}

	public void setTemporary(boolean temporary) {
		this.temporary = temporary;
	}

	public boolean isStopWhenHit() {
		return stopWhenHit;
	}

	public void setStopWhenHit(boolean stopWhenHit) {
		this.stopWhenHit = stopWhenHit;
	}

	public EnumSet<Operation> getOperation() {
		return operation;
	}

	public void setOperation(EnumSet<Operation> operation) {
		this.operation = operation;
	}

	public boolean isCurrentlyHit() {
		return currentlyHit;
	}

	public void setCurrentlyHit(boolean currentlyHit) {
		this.currentlyHit = currentlyHit;
	}

	@Override
	public String getModelIdentifier() {
		return "net.resheim.eclipse.cc.vice.debug";
	}

}
