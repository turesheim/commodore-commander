package net.resheim.eclipse.cc.vice.debug.model;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicInteger;

import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManager;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;

import net.resheim.eclipse.cc.disassembler.Disassembler;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor;
import net.resheim.eclipse.cc.vice.debug.monitor.Command;
import net.resheim.eclipse.cc.vice.debug.monitor.MonitorEventDispatcher;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.CommandID;

/**
 * The one and only thread in this debug model.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEThread extends VICEDebugElement implements IThread, IDebugEventSetListener {

	private enum State {
		RUNNING, STEPPING, SUSPENDED, TERMINATED
	}

	private State currentState;

	Socket socket;

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


	/** A re-usable stack frame */
	private final VICEStackFrame stackFrame;

	private final Disassembler disassembler;

	public VICEThread(IDebugTarget target, Socket socket, Disassembler disassembler) {
		super(target);
		this.socket = socket;
		this.disassembler = disassembler;
		this.counter = new AtomicInteger();
		this.stackFrame = new VICEStackFrame(this);
		DebugPlugin.getDefault().addDebugEventListener(this);
		connectEventdDispatcherStreams();
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
	public boolean isSuspended() {
		return State.SUSPENDED.equals(currentState);
	}

	@Override
	public void resume() throws DebugException {
		sendCommand(CommandID.EXIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
	}

	@Override
	public void suspend() throws DebugException {
		// any command will suspend
		sendCommand(CommandID.PING, new byte[] { 0x00 });
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
		return State.STEPPING.equals(currentState);
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
		return !State.TERMINATED.equals(currentState);
	}

	@Override
	public boolean isTerminated() {
		return State.TERMINATED.equals(currentState);
	}

	@Override
	public void terminate() throws DebugException {
		sendCommand(CommandID.QUIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
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
		// TODO: Return the limited set
		IBreakpointManager breakpointManager = DebugPlugin.getDefault().getBreakpointManager();
		IBreakpoint[] breakpoints = breakpointManager.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);
		return breakpoints;
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

	public static byte[] shortToBytes(short value) {
		byte[] bytes = new byte[2];
		bytes[0] = (byte) (value & 0xFF); // Low byte
		bytes[1] = (byte) ((value >> 8) & 0xFF); // High byte
		return bytes;
	}

	/**
	 * Deal with some of the debug events that are triggered, typically by
	 * {@link MonitorEventDispatcher} when responding to the VICE Monitor stream.
	 */
	@Override
	public void handleDebugEvents(DebugEvent[] events) {
		for (DebugEvent event : events) {
			if (event.getSource() instanceof VICEThread) {
				System.out.println("VICEThread.handleDebugEvents(" + event + ")");
				if (DebugEvent.SUSPEND == event.getKind()) {
					currentState = State.SUSPENDED;
					try {
						// we assume the first register is the main CPU
						IRegisterGroup iRegisterGroup = stackFrame.getRegisterGroups()[0];
						// get all the register names, if we don't have them
						if (!iRegisterGroup.hasRegisters()) {
							sendCommand(CommandID.REGISTERS_AVAILABLE, new byte[] { 0x00 });
						}
						// the result from the command does NOT include the
						// start address of the data included, so it's hard to
						// figure it out unless we somehow pass that value. We
						// just read out the entire 64kiB for now.
						sendCommand(CommandID.MEMORY_GET,
								new byte[] { 0x00, // side effects
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
					currentState = State.RUNNING;
				}
				if (DebugEvent.TERMINATE == event.getKind()) {
					currentState = State.TERMINATED;
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
				}
			}
		}
	}

	public Disassembler getDisassembler() {
		return disassembler;
	}

	public byte[] getComputerMemory() {
		return eventDispatcher.getComputerMemory();
	}

}
