package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;
import org.eclipse.debug.core.model.IVariable;

/**
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEStackFrame extends VICEDebugElement implements IStackFrame {

	/** A reusable register group */
	private VICERegisterGroup registerGroup;

	private final IThread thread;

	public VICEStackFrame(IThread thread) {
		super(thread.getDebugTarget());
		this.thread = thread;
		this.registerGroup = new VICERegisterGroup(getDebugTarget());
	}

	@Override
	public boolean canStepInto() {
		return thread.canStepInto();
	}

	@Override
	public boolean canStepOver() {
		return thread.canStepOver();
	}

	@Override
	public boolean canStepReturn() {
		return thread.canStepReturn();
	}

	@Override
	public boolean isStepping() {
		return thread.isStepping();
	}

	@Override
	public void stepInto() throws DebugException {
	}

	@Override
	public void stepOver() throws DebugException {
	}

	@Override
	public void stepReturn() throws DebugException {
	}

	@Override
	public boolean canResume() {
		return thread.canResume();
	}

	@Override
	public boolean canSuspend() {
		return thread.canSuspend();
	}

	@Override
	public boolean isSuspended() {
		return thread.isSuspended();
	}

	@Override
	public void resume() throws DebugException {
		thread.resume();
	}

	@Override
	public void suspend() throws DebugException {
		thread.suspend();
	}

	@Override
	public boolean canTerminate() {
		return thread.canTerminate();
	}

	@Override
	public boolean isTerminated() {
		return thread.isTerminated();
	}

	@Override
	public void terminate() throws DebugException {
		thread.terminate();
	}

	@Override
	public IThread getThread() {
		return thread;
	}

	@Override
	public IVariable[] getVariables() throws DebugException {
		return new IVariable[0];
	}

	@Override
	public boolean hasVariables() throws DebugException {
		return true;
	}

	@Override
	public int getLineNumber() throws DebugException {
		return 0;
	}

	@Override
	public int getCharStart() throws DebugException {
		return 0;
	}

	@Override
	public int getCharEnd() throws DebugException {
		return 0;
	}

	@Override
	public String getName() throws DebugException {
		// AFAIK we don't really have stack frames on a 6510, so we're using the
		// PROGRAM COUNTER to name this frame
		return registerGroup.getRegisterByName("PC").getValue().getValueString();
	}

	@Override
	public IRegisterGroup[] getRegisterGroups() throws DebugException {
		return new IRegisterGroup[] { registerGroup };
	}

	@Override
	public boolean hasRegisterGroups() throws DebugException {
		return true;
	}

	public short getProgramCounter() throws NumberFormatException, DebugException {
		return registerGroup.getProgramCounter();
	}
}
