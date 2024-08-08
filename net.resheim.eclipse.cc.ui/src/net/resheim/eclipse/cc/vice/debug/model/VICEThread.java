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
import net.resheim.eclipse.cc.vice.debug.monitor.MonitorInputStreamListener;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.Command;

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

	private MonitorInputStreamListener task;

	private DataOutputStream out;

	private AtomicInteger counter;

	private Thread listenerThread;

	private DataInputStream in;

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
		createMonitorInterface();
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
		sendCommand(Command.EXIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
	}

	@Override
	public void suspend() throws DebugException {
		// any command will suspend
		sendCommand(Command.PING, new byte[] { 0x00 });
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
		sendCommand(Command.QUIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
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

	private void createMonitorInterface() {
		try {
			out = new DataOutputStream(socket.getOutputStream());
			in = new DataInputStream(socket.getInputStream());
			task = new MonitorInputStreamListener(this, in);
			listenerThread = new Thread(task);
			listenerThread.start();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	private static String byteToHex(byte b) {
		String hex = Integer.toHexString(b & 0xFF);
		return hex.length() == 1 ? "0" + hex : hex;
	}

	private synchronized void sendCommand(Command command, byte[] commandBody) {
		int id = counter.incrementAndGet();
		StringBuilder sb = new StringBuilder();
		sb.append("<<< Request : ID " + String.format("$%08X", id));
		sb.append(", type " + String.format("$%02X", command.getCode()) + " (" + command.name() + ")");
		sb.append(", length " + commandBody.length);
		sb.append(", body ");
		for (byte b : commandBody) {
			sb.append(byteToHex(b));
			sb.append(" ");
		}
		System.out.println(sb);
		try {
			Message msg = new Message(id, command.getCode(), commandBody);
			byte[] messageToSend = msg.buildMessage();
			out.write(messageToSend);
			out.flush();
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
	 * Deal with the debug events that are triggered, typically by
	 * {@link MonitorInputStreamListener} when responding to the VICE Monitor
	 * stream.
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
							sendCommand(Command.REGISTERS_AVAILABLE, new byte[] { 0x00 });
						}
						// the result from the command does NOT include the
						// start address of the data included, so it's hard to
						// figure it out unless we somehow pass that value. We
						// just read out the entire 64kiB for now.
						sendCommand(Command.MEMORY_GET,
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
						sendCommand(Command.CHECKPOINT_LIST, new byte[] {});
					} catch (Exception e) {
						e.printStackTrace();
					}
				}
				if (DebugEvent.RESUME == event.getKind()) {
					currentState = State.RUNNING;
				}
				if (DebugEvent.TERMINATE == event.getKind()) {
					currentState = State.TERMINATED;
					listenerThread.interrupt();
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
		return task.getComputerMemory();
	}

}
