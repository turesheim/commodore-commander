package net.resheim.eclipse.cc.vice.debug;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicInteger;

import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;

import net.resheim.eclipse.cc.vice.debug.IBinaryMonitor.Command;

/**
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

	public VICEThread(IDebugTarget target, Socket socket) {
		super(target);
		this.socket = socket;
		this.counter = new AtomicInteger();
		this.stackFrame = new VICEStackFrame(this);
		DebugPlugin.getDefault().addDebugEventListener(this);
		createListener();
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
		return new IBreakpoint[0];
	}

	private void createListener() {
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

	private void sendCommand(Command command, byte[] commandBody) {
		try {
			Message msg = new Message(counter.incrementAndGet(), command.getCode(), commandBody);
			byte[] messageToSend = msg.buildMessage();
			out.write(messageToSend);
			out.flush();
		} catch (IOException e) {
			e.printStackTrace();
		}
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
					// Do we have register name? If not, get them
					try {
						// we assume the first register is the main CPU
						IRegisterGroup iRegisterGroup = stackFrame.getRegisterGroups()[0];
						// get all the register names, if we don't have them
						if (!iRegisterGroup.hasRegisters()) {
							sendCommand(Command.REGISTERS_AVAILABLE, new byte[] { 0x00 });
						}
					} catch (DebugException e) {
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

}
