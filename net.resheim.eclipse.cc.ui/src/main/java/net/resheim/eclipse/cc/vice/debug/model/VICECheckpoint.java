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

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.LineBreakpoint;

import net.resheim.eclipse.cc.launch.VICELaunchDelegate;

/**
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICECheckpoint extends LineBreakpoint {

	public static final String SOURCE = "source";
	public static final String OPERATION = "operation";
	public static final String CONDITION = "condition";
	public static final String MEMSPACE = "memspace";
	public static final String START_ADDRESS = "start_address";
	public static final String END_ADDRESS = "end_address";
	public static final String BREAK_ON_LOAD = "break_on_load";
	public static final String BREAK_ON_STORE = "break_on_store";
	public static final String BREAK_ON_EXEC = "break_on_exec";

	public enum Source {
		/**
		 * The Checkpoint has been created using the KickAssembler <code>.break</code>
		 * or <code>.watch</code> commands.
		 */
		CODE,
		/**
		 * The checkpoint has been created using the Commodore Commander user interface.
		 */
		USER
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

	/** The source of the breakpoint, how it was created */
	private Source source;

	private boolean hasCondition = false;

	private boolean currentlyHit = false;

	private int hitCount;

	private int ignoreCount;

	/**
	 * The checkpoint number. Will be set when the
	 * {@link VICEDebugTarget#installDeferredBreakpoints()} has submitted all
	 * checkpoints that are created by the user and an ID has been assigned.
	 */
	private int number;

	/**
	 * Deletes the checkpoint after it has been hit once. This is similar to "until"
	 * command, but it will not resume the emulator.
	 */
	private boolean temporary = false;

	/**
	 * The ID of the monitor command that was sent to create the checkpoint. The
	 * response will use the same ID and some extra details that must be used to
	 * update the checkpoint.
	 */
	private int requestId;

	public VICECheckpoint() {
	}

	protected VICECheckpoint(IResource resource, String type, Source source, int lineNumber, int operation)
			throws DebugException, CoreException {
		super();

		IMarker marker = resource.createMarker(type);
		setMarker(marker);
		setEnabled(true);

		ensureMarker().setAttribute(IBreakpoint.ID, getModelIdentifier());
		ensureMarker().setAttribute(IMarker.LINE_NUMBER, lineNumber);
		ensureMarker().setAttribute(VICECheckpoint.SOURCE, source.name());
		ensureMarker().setAttribute(IBreakpoint.ENABLED, true);

		boolean isLoad = (operation & (1 << 0)) != 0; // Check bit 0
		boolean isStore = (operation & (1 << 1)) != 0; // Check bit 1
		boolean isExec = (operation & (1 << 2)) != 0; // Check bit 2

		setLoad(isLoad);
		setStore(isStore);
		setExec(isExec);
	}

	public String getCondition() {
		return condition;
	}

	/**
	 * The end address of the breakpoint. Will be set/updated when the
	 * {@link VICELaunchDelegate} updates from the metadata created from assembling
	 * the program. It is only valid within that context.
	 */
	public int getEndAddress() throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			return m.getAttribute(VICECheckpoint.END_ADDRESS, -1);
		}
		return -1;
	}

	public int getHitCount() {
		return hitCount;
	}

	public int getIgnoreCount() {
		return ignoreCount;
	}

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
	public int getMemspace() {
		IMarker m = getMarker();
		if (m != null) {
			return m.getAttribute(VICECheckpoint.MEMSPACE, -1);
		}
		return -1;
	}

	public int getNumber() {
		return number;
	}

	/**
	 * The start address of the breakpoint. Will be set/updated when the
	 * {@link VICELaunchDelegate} updates from the metadata created from assembling
	 * the program. It is only valid within that context.
	 */
	public int getStartAddress() {
		IMarker m = getMarker();
		if (m != null) {
			return m.getAttribute(VICECheckpoint.START_ADDRESS, -1);
		}
		return -1;
	}

	public boolean hasCondition() {
		return hasCondition;
	}

	public boolean isExec() {
		IMarker m = getMarker();
		if (m != null) {
			return m.getAttribute(VICECheckpoint.BREAK_ON_EXEC, false);
		}
		return false;
	}

	public boolean isLoad() {
		IMarker m = getMarker();
		if (m != null) {
			return m.getAttribute(VICECheckpoint.BREAK_ON_LOAD, false);
		}
		return false;
	}

	public boolean isStore() {
		IMarker m = getMarker();
		if (m != null) {
			return m.getAttribute(VICECheckpoint.BREAK_ON_STORE, false);
		}
		return false;
	}

	public boolean isTemporary() {
		return temporary;
	}

	public void setCondition(String condition) {
		this.condition = condition;
	}

	public void setEndAddress(int endAddress) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.END_ADDRESS, endAddress);
		}
	}

	public void setExec(boolean exec) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.BREAK_ON_EXEC, exec);
		}
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

	public void setLoad(boolean load) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.BREAK_ON_LOAD, load);
		}
	}

	public void setMemspace(int memspace) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.MEMSPACE, memspace);
		}
	}

	public void setNumber(int number) {
		this.number = number;
	}

	public void setStartAddress(int startAddress) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.START_ADDRESS, startAddress);
		}
	}

	public void setStore(boolean store) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.BREAK_ON_STORE, store);
		}
	}

	public void setTemporary(boolean temporary) {
		this.temporary = temporary;
	}

//	public boolean isStopWhenHit() {
//		return stopWhenHit;
//	}
//
//	public void setStopWhenHit(boolean stopWhenHit) {
//		this.stopWhenHit = stopWhenHit;
//	}

	public boolean isCurrentlyHit() {
		return currentlyHit;
	}

	public void setCurrentlyHit(boolean currentlyHit) {
		this.currentlyHit = currentlyHit;
	}

	@Override
	public String getModelIdentifier() {
		return VICEDebugElement.DEBUG_MODEL_ID;
	}

	public Source getSource() throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			return Source.valueOf(m.getAttribute(VICECheckpoint.SOURCE).toString());
		}
		return source;
	}

	public void setSource(Source source) throws CoreException {
		IMarker m = getMarker();
		if (m != null) {
			m.setAttribute(VICECheckpoint.SOURCE, source.toString());
		}
	}

	/**
	 * This value is determined by VICE and depends on the order of the
	 * {@link VICECheckpoint} being submitted to the emulator
	 *
	 * @return the ID of the command used to set the {@link VICECheckpoint}
	 */
	public int getRequestId() {
		return requestId;
	}

	public void setRequestId(int requestId) {
		this.requestId = requestId;
	}

}
