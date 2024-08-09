package net.resheim.eclipse.cc.vice.debug.model;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicInteger;

import org.eclipse.core.resources.IMarkerDelta;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManagerListener;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IMemoryBlock;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;

import net.resheim.eclipse.cc.disassembler.Disassembler;
import net.resheim.eclipse.cc.vice.debug.monitor.Command;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.CommandID;
import net.resheim.eclipse.cc.vice.debug.monitor.MonitorEventDispatcher;

/**
 * This root element of the debug model controls the connection to the VICE
 * binary montor. It will also respond to certain {@link DebugEvent} instances
 * created by the {@link MonitorEventDispatcher} which asynchronously will
 * respond to output from the monitor.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEDebugTarget extends VICEDebugElement
		implements IDebugTarget, IBreakpointManagerListener, IDebugEventSetListener {

	private State currentState;

	private static final int MAX_CONNECTION_ATTEMPTS = 30;

	private ILaunch launch;

	/** The associated system process */
	private IProcess process;

	/** Connection to VICE Binary Monitor (localhost:6502) */
	private Socket socket;

	/** We have only one thread */
	private IThread thread;

	/**
	 * Listens to messages coming over the binary monitor port and reacts
	 * accordingly
	 */
	private MonitorEventDispatcher eventDispatcher;

	/** For sending messages to the binary monitor */
	private DataOutputStream out;

	/**
	 * For reading messages from the binory monitor. Connected to
	 * {@link MonitorEventDispatcher}
	 */
	private DataInputStream in;

	/**
	 * For keeping track of the messages sent VICE want unique identifiers.
	 */
	private AtomicInteger counter;

	private Disassembler disassembler;

	public VICEDebugTarget(IProcess process, ILaunch launch, Disassembler disassembler) {
		super(null);
		this.process = process;
		this.launch = launch;
		this.socket = connect();
		this.counter = new AtomicInteger();
		this.thread = new VICEThread(this, socket);
		this.disassembler = disassembler;
		DebugPlugin.getDefault().getBreakpointManager().addBreakpointListener(this);
		DebugPlugin.getDefault().addDebugEventListener(this);
		connectEventdDispatcherStreams();
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
		return isSuspended();
	}

	@Override
	public boolean canSuspend() {
		return State.RUNNING.equals(currentState);
	}

	@Override
	public boolean canTerminate() {
		return !State.TERMINATED.equals(currentState);
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
		// XXX: Should probably just call terminate()?
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
		return State.SUSPENDED.equals(currentState);
	}

	@Override
	public boolean isTerminated() {
		return State.TERMINATED.equals(currentState);
	}

	@Override
	public void resume() throws DebugException {
		sendCommand(CommandID.EXIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
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
		// any command will suspend
		sendCommand(CommandID.PING, new byte[] { 0x00 });
	}

	@Override
	public void terminate() throws DebugException {
		sendCommand(CommandID.QUIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
	}

	@Override
	public synchronized void breakpointManagerEnablementChanged(boolean enabled) {
		if (enabled) {
			System.out.println("Breakpoints are enabled.");
		} else {
			System.out.println("Breakpoints are disabled (Skip All Breakpoints is enabled).");
		}
	}

	private void connectEventdDispatcherStreams() {
		try {
			out = new DataOutputStream(socket.getOutputStream());
			in = new DataInputStream(socket.getInputStream());
			eventDispatcher = new MonitorEventDispatcher(this, in);
			eventDispatcher.schedule();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	/**
	 * Deal with some of the debug events that are triggered, typically by
	 * {@link MonitorEventDispatcher} when responding to the VICE Monitor stream.
	 */
	@Override
	public void handleDebugEvents(DebugEvent[] events) {
		for (DebugEvent event : events) {
			if (event.getSource().equals(this)) {
				System.out.println("VICEThread.handleDebugEvents(" + event + ")");
				if (DebugEvent.SUSPEND == event.getKind()) {
					setCurrentState(State.SUSPENDED);
					try {
						// we assume the first register is the main CPU
						IStackFrame stackFrame = getThreads()[0].getTopStackFrame();
						IRegisterGroup iRegisterGroup = stackFrame.getRegisterGroups()[0];
						// get all the register names, if we don't have them
						if (!iRegisterGroup.hasRegisters()) {
							sendCommand(CommandID.REGISTERS_AVAILABLE, new byte[] { 0x00 });
						}
						// the result from the command does NOT include the
						// start address of the data included, so it's hard to
						// figure it out unless we somehow pass that value. We
						// just read out the entire 64kiB for now.
						sendCommand(CommandID.MEMORY_GET, new byte[] { 0x00, // side effects
								0x00, // start address LSB
								0x00, // start address MSB
								(byte) 0xff, // end address LSB
								(byte) 0xff, // end address MSB
								0x00, // memspace
								0x00, // bank ID LSB
								0x00 // bank ID MSB
						});
						// update the list of breakpoints, some may have been
						// set by code or even another manually connected
						// monitor
						sendCommand(CommandID.CHECKPOINT_LIST, new byte[] {});
					} catch (Exception e) {
						e.printStackTrace();
					}
				}
				if (DebugEvent.RESUME == event.getKind()) {
					setCurrentState(State.RUNNING);
				}
				if (DebugEvent.TERMINATE == event.getKind()) {
					setCurrentState(State.TERMINATED);
					try {
						// Close down socket
						if (!socket.isClosed()) {
							socket.shutdownOutput();
							socket.shutdownInput();
							socket.close();
						}
						// and our IO-streams
						out.close();
						in.close();
					} catch (IOException e) {
						e.printStackTrace();
					}
					DebugPlugin.getDefault().removeDebugEventListener(this);
					DebugPlugin.getDefault().getBreakpointManager().removeBreakpointListener(this);
				}
			}
		}
	}

	private synchronized void sendCommand(CommandID command, byte[] body) {
		int id = counter.incrementAndGet();
		try {
			Command msg = new Command(id, command, body);
			byte[] messageToSend = msg.build();
			out.write(messageToSend);
			out.flush();
			// for debugging
			System.out.println(msg);
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public byte[] getComputerMemory() {
		return eventDispatcher.getComputerMemory();
	}

	public State getCurrentState() {
		return currentState;
	}

	public void setCurrentState(State currentState) {
		this.currentState = currentState;
	}

	public Disassembler getDisassembler() {
		return disassembler;
	}

}
