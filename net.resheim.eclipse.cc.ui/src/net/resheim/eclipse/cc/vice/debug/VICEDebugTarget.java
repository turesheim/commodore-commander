package net.resheim.eclipse.cc.vice.debug;

import java.net.InetSocketAddress;
import java.net.Socket;

import org.eclipse.core.resources.IMarkerDelta;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointListener;
import org.eclipse.debug.core.IBreakpointManagerListener;
import org.eclipse.debug.core.IBreakpointsListener;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IMemoryBlock;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.IThread;

import net.resheim.eclipse.cc.disassembler.Checkpoint;
import net.resheim.eclipse.cc.disassembler.Disassembler;

/**
 * Delegates mostly to IThread, except for opening the socket communication with
 * the VICE Debug Monitor.
 *
 * https://git.eclipse.org/r/plugins/gitiles/platform/eclipse.platform.debug/+/1c1d17b82a223fb8fcc69b4883a71b8744899ccb/org.eclipse.debug.examples.core/src/org/eclipse/debug/examples/core/pda/model/PDADebugTarget.java
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEDebugTarget extends VICEDebugElement
		implements IDebugTarget, IBreakpointManagerListener {

	private static final int MAX_CONNECTION_ATTEMPTS = 30;

	private ILaunch launch;

	private IProcess process;

	/** Connection to VICE Binary Monitor (localhost:6502) */
	private Socket socket;

	/** We have only one thread */
	private IThread thread;

	public VICEDebugTarget(IProcess process, ILaunch launch, Disassembler disassembler) {
		super(null);
		this.process = process;
		this.launch = launch;
		this.socket = connect();
		this.thread = new VICEThread(this, socket, disassembler);
		DebugPlugin.getDefault().getBreakpointManager().addBreakpointListener(this);
		fireCreationEvent();
	}

	private Socket attemptConnection(String hostname, int port) throws InterruptedException {
		int attemptCount = 0;
		while (true) {
			try {
				Socket socket = new Socket();
				socket.connect(new InetSocketAddress(hostname, port), 100); // Timeout for each attempt is 100ms second
				System.out.println("Connected to " + hostname + ":" + port);
				return socket;
			} catch (Exception e) {
				if (++attemptCount >= MAX_CONNECTION_ATTEMPTS) {
					throw new RuntimeException("Failed to connect after " + MAX_CONNECTION_ATTEMPTS + " attempts", e);
				}
				Thread.sleep(100); // Wait for 10ms before the next attempt
			}
		}
	}

	@Override
	public void breakpointAdded(IBreakpoint breakpoint) {
		System.err.println("VICEDebugTarget.breakpointAdded()" + breakpoint);

	}

	@Override
	public void breakpointChanged(IBreakpoint breakpoint, IMarkerDelta delta) {
		System.err.println("VICEDebugTarget.breakpointChanged()" + breakpoint);
		boolean skipBreakpoints = DebugPlugin.getDefault().getBreakpointManager().isEnabled();
		if (!skipBreakpoints) {
			System.out.println("Skip All Breakpoints is enabled, ignoring breakpoint change.");
			return;
		}

		if (delta != null) {
			Boolean enabled = (Boolean) delta.getAttribute(IBreakpoint.ENABLED);
			if (enabled != null) {
				if (enabled) {
					System.out.println("Breakpoint enabled: " + breakpoint);
				} else {
					System.out.println("Breakpoint disabled: " + breakpoint);
				}
			}
		}
	}

	@Override
	public void breakpointRemoved(IBreakpoint breakpoint, IMarkerDelta delta) {
		System.err.println("VICEDebugTarget.breakpointRemoved()" + breakpoint);

	}

	@Override
	public boolean canDisconnect() {
		// make it simple for now
		return false;
		// return !socket.isClosed();
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
	public boolean canTerminate() {
		return thread.canTerminate();
	}

	private Socket connect() {
		String hostname = "localhost";
		int port = 6502;
		try {
			return attemptConnection(hostname, port);
		} catch (InterruptedException e) {
			e.printStackTrace();
			return null;
		}
	}

	@Override
	public void disconnect() throws DebugException {
		fireTerminateEvent();
	}

	@Override
	public IDebugTarget getDebugTarget() {
		return this;
	}

	@Override
	public ILaunch getLaunch() {
		return launch;
	}

	@Override
	public IMemoryBlock getMemoryBlock(long startAddress, long length) throws DebugException {
		System.err.println("VICEDebugTarget.getMemoryBlock() " + startAddress);
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String getName() throws DebugException {
		return "VICE Debug Target";
	}

	@Override
	public IProcess getProcess() {
		return process;
	}

	@Override
	public IThread[] getThreads() throws DebugException {
		return new IThread[] { thread };
	}

	@Override
	public boolean hasThreads() throws DebugException {
		// all be it only one
		return true;
	}

	@Override
	public boolean isDisconnected() {
		return socket.isConnected();
	}

	@Override
	public boolean isSuspended() {
		return thread.isSuspended();
	}

	@Override
	public boolean isTerminated() {
		return thread.isTerminated();
	}

	@Override
	public void resume() throws DebugException {
		thread.resume();
	}

	@Override
	public boolean supportsBreakpoint(IBreakpoint breakpoint) {
		return breakpoint instanceof Checkpoint;
	}

	@Override
	public boolean supportsStorageRetrieval() {
		// TODO: Implement this
		return true;
	}

	@Override
	public void suspend() throws DebugException {
		thread.suspend();
	}

	@Override
	public void terminate() throws DebugException {
		thread.terminate();
	}

	@Override
	public synchronized void breakpointManagerEnablementChanged(boolean enabled) {
		if (enabled) {
			System.out.println("Breakpoints are enabled.");
		} else {
			System.out.println("Breakpoints are disabled (Skip All Breakpoints is enabled).");
		}
	}

}
