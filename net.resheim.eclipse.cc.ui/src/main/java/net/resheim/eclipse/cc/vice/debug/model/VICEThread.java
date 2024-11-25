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

import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManager;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;

import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.CommandID;

/**
 * The one and only thread in this debug model.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEThread extends VICEDebugElement implements IThread {

	/** A re-usable stack frame */
	private final VICEStackFrame stackFrame;

	private boolean stepping;

	private State state;

	public VICEThread(IDebugTarget target, Socket socket) {
		super(target);
		this.stackFrame = new VICEStackFrame(this);
		fireCreationEvent();
	}

	@Override
	public boolean canResume() {
		return isSuspended();
	}

	@Override
	public boolean canSuspend() {
		return State.RUNNING.equals(getState());
	}

	@Override
	public boolean isSuspended() {
		return State.SUSPENDED.equals(getState());
	}

	@Override
	public void resume() throws DebugException {
		stepping = false;
		getDebugTarget().resume();
	}

	@Override
	public void suspend() throws DebugException {
		stepping = false;
		getDebugTarget().suspend();
	}

	@Override
	public boolean canStepInto() {
		return isSuspended();
	}

	@Override
	public boolean canStepOver() {
		return isSuspended();
	}

	@Override
	public boolean canStepReturn() {
		return isSuspended();
	}

	@Override
	public boolean isStepping() {
		return stepping;
	}

	@Override
	public void stepInto() throws DebugException {
		stepping = true;
		ByteBuffer buffer = ByteBuffer.allocate(3);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		buffer.put((byte) 0x00); // Should subroutines count as a single instruction?
		buffer.putShort((short)0x01);
		((VICEDebugTarget) getDebugTarget()).sendCommand(CommandID.ADVANCE_INSTRUCTIONS, buffer.array());
	}

	@Override
	public void stepOver() throws DebugException {
		stepping = true;
		ByteBuffer buffer = ByteBuffer.allocate(3);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		buffer.put((byte) 0x01); // Should subroutines count as a single instruction?
		buffer.putShort((short) 0x01);
		((VICEDebugTarget) getDebugTarget()).sendCommand(CommandID.ADVANCE_INSTRUCTIONS, buffer.array());
	}

	@Override
	public void stepReturn() throws DebugException {
		stepping = true;
		ByteBuffer buffer = ByteBuffer.allocate(0);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		((VICEDebugTarget) getDebugTarget()).sendCommand(CommandID.EXECUTE_UNTIL_RETURN, buffer.array());
	}

	@Override
	public boolean canTerminate() {
		return !State.TERMINATED.equals(getState());
	}

	@Override
	public boolean isTerminated() {
		return State.TERMINATED.equals(getState());
	}

	@Override
	public void terminate() throws DebugException {
		getDebugTarget().terminate();
	}

	@Override
	public IStackFrame[] getStackFrames() throws DebugException {
		return new IStackFrame[] { stackFrame };
	}

	@Override
	public boolean hasStackFrames() throws DebugException {
		// It only makes sens to return a stack frame if the CPU is suspended
		// as we otherwise have no access to the registers
		return isSuspended();
	}

	@Override
	public int getPriority() throws DebugException {
		return 0;
	}

	@Override
	public IStackFrame getTopStackFrame() throws DebugException {
		return stackFrame;
	}

	@Override
	public String getName() throws DebugException {
		return "Emulator Thread";
	}

	@Override
	public IBreakpoint[] getBreakpoints() {
		// TODO: Return ony the set belonging to this target
		IBreakpointManager breakpointManager = DebugPlugin.getDefault().getBreakpointManager();
		IBreakpoint[] breakpoints = breakpointManager.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);
		return breakpoints;
	}

	public synchronized State getState() {
		return state;
	}

	public synchronized void setState(State state) {
		this.state = state;
	}

}
