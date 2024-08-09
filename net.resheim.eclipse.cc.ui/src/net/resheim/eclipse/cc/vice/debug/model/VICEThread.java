package net.resheim.eclipse.cc.vice.debug.model;

import java.net.Socket;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManager;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;

/**
 * The one and only thread in this debug model. It delegates most work to the
 * {@link VICEDebugTarget} since we only have one "thread"
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEThread extends VICEDebugElement implements IThread {

	/** A re-usable stack frame */
	private final VICEStackFrame stackFrame;


	public VICEThread(IDebugTarget target, Socket socket) {
		super(target);
		this.stackFrame = new VICEStackFrame(this);
	}

	@Override
	public boolean canResume() {
		return getDebugTarget().canResume();
	}

	@Override
	public boolean canSuspend() {
		return getDebugTarget().canSuspend();
	}

	@Override
	public boolean isSuspended() {
		return getDebugTarget().isSuspended();
	}

	@Override
	public void resume() throws DebugException {
		getDebugTarget().resume();
	}

	@Override
	public void suspend() throws DebugException {
		getDebugTarget().suspend();
	}

	@Override
	public boolean canStepInto() {
		return false;
	}

	@Override
	public boolean canStepOver() {
		return false;
	}

	@Override
	public boolean canStepReturn() {
		return false;
	}

	@Override
	public boolean isStepping() {
		return false;
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
	public boolean canTerminate() {
		return getDebugTarget().canTerminate();

	}

	@Override
	public boolean isTerminated() {
		return getDebugTarget().isTerminated();
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

}
