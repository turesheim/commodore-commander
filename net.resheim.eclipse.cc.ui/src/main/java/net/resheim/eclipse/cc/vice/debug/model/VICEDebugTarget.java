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

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.atomic.AtomicInteger;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IMarkerDelta;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IResourceDelta;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManagerListener;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IMemoryBlock;
import org.eclipse.debug.core.model.IMemoryBlockExtension;
import org.eclipse.debug.core.model.IMemoryBlockRetrievalExtension;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;
import org.eclipse.ui.console.IConsole;
import org.eclipse.ui.console.MessageConsole;
import org.eclipse.ui.console.MessageConsoleStream;

import net.resheim.eclipse.cc.builder.KickAssemblerBuilder;
import net.resheim.eclipse.cc.builder.model.Assembly;
import net.resheim.eclipse.cc.builder.model.LineMapping;
import net.resheim.eclipse.cc.ui.ConsoleFactory;
import net.resheim.eclipse.cc.vice.debug.MonitorLogger;
import net.resheim.eclipse.cc.vice.debug.model.VICECheckpoint.Source;
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
		implements IDebugTarget, IBreakpointManagerListener, IDebugEventSetListener, IMemoryBlockRetrievalExtension {

	private static final int MAX_CONNECTION_ATTEMPTS = 30;

	private ILaunch launch;

	/** The associated system process */
	private IProcess process;

	/** Connection to VICE Binary Monitor (localhost:6502) */
	private Socket socket;

	/** We have only one thread */
	private VICEThread thread;

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
	 * For keeping track of the messages sent. VICE want unique identifiers.
	 */
	private AtomicInteger counter;

	/**
	 * Details from building the program generated by Kick Assembler in
	 * {@link KickAssemblerBuilder}.
	 */
	private Assembly assembly;

	private MessageConsole console;

	private MessageConsoleStream consoleStream;

	public VICEDebugTarget(IProcess process, ILaunch launch, Assembly assembly) {
		super(null);
		this.process = process;
		this.launch = launch;
		this.socket = connect();
		this.assembly = assembly;
		this.counter = new AtomicInteger();
		this.thread = new VICEThread(this, socket);

		this.console = ConsoleFactory.findConsole();
		this.consoleStream = console.newMessageStream();

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
		MonitorLogger.info(consoleStream, MonitorLogger.USER, "Checkpoint added " + breakpoint);
		// This method will be called when installing deferred breakpoints and
		// when responding to a new breakpoint added using the UI. As the program
		// is already running we must first determine the breakpoint address
		// since we typically only know the file and the line number.
		if (supportsBreakpoint(breakpoint)) {
			try {
				updateAdresses(breakpoint);
				if ((breakpoint.isEnabled()
						&& getBreakpointManager().isEnabled()) /* || !breakpoint.isRegistered() */) {
					registerBreakpoint(breakpoint);
				}
			} catch (CoreException e) {
			}
		}
	}

	private void registerBreakpoint(IBreakpoint breakpoint) throws CoreException {
		VICECheckpoint cp = (VICECheckpoint) breakpoint;
		ByteBuffer buffer = ByteBuffer.allocate(8);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		buffer.putShort((short) cp.getStartAddress());
		buffer.putShort((short) cp.getEndAddress());
		buffer.put((byte) 0x01); // stop when hit
		buffer.put(breakpoint.isEnabled() ? (byte) 0x01 : (byte) 0x00);
		int bitmask = 0;
		if (cp.isLoad()) {
			bitmask |= (1 << 0);
		}
		if (cp.isStore()) {
			bitmask |= (1 << 1);
		}
		if (cp.isExec()) {
			bitmask |= (1 << 2);
		}
		buffer.put((byte) bitmask);
		buffer.put((byte) 0x00); // is not temporary
		int id = sendCommand(CommandID.CHECKPOINT_SET, buffer.array());
		// update the checkpoint with the ID of the request that created it
		cp.setRequestId(id);
	}

	@Override
	public void breakpointChanged(IBreakpoint breakpoint, IMarkerDelta delta) {
		boolean skipBreakpoints = DebugPlugin.getDefault().getBreakpointManager().isEnabled();
		if (!skipBreakpoints) {
			MonitorLogger.error(consoleStream, MonitorLogger.USER, "Unhandled skip all breakpoint");
			return;
		}
		VICECheckpoint cp = (VICECheckpoint) breakpoint;
		// If the number is not set it may or may not exist in the emulator state, so we
		// fix that by registering it.
		if (cp.getNumber()<=0) {
			MonitorLogger.error(consoleStream, MonitorLogger.USER, "Unknown checkpoint " + breakpoint);
			return;
		}
		// The monitor does not have the capability to alter the CPU operation flag of
		// the checkpoint. It appears the only way to change this is to delete the
		// checkpoint and re-add it as a new checkpoint.

		// We only deal with the breakpoint if the delta has actually changed.
		// Otherwise breakpointAdded and breakpointRemoved should be sufficient.
		if (delta != null && delta.getKind() == IResourceDelta.CHANGED) {
			MonitorLogger.info(consoleStream, MonitorLogger.USER, "Checkpoint changed " + breakpoint);
			System.out.println("CHANGED >> " + delta);
			// Toggle the checkpoint if this is the attribute that has changed
			try {
				boolean newState = !delta.getAttribute(IBreakpoint.ENABLED, true);
				if (cp.isEnabled() == newState) {
					MonitorLogger.info(consoleStream, MonitorLogger.USER, "Toggling state " + newState);
					ByteBuffer buffer = ByteBuffer.allocate(5);
					buffer.order(ByteOrder.LITTLE_ENDIAN);
					buffer.putInt(cp.getNumber());
					buffer.put(newState ? (byte) 0x01 : (byte) 0x00);
					sendCommand(CommandID.CHECKPOINT_TOGGLE, buffer.array());
				} else {
					MonitorLogger.info(consoleStream, MonitorLogger.USER, "Re-adding checkpoint");
					ByteBuffer buffer = ByteBuffer.allocate(4);
					buffer.order(ByteOrder.LITTLE_ENDIAN);
					buffer.putInt(cp.getNumber());
					sendCommand(CommandID.CHECKPOINT_DELETE, buffer.array());
					cp.setNumber(0);
					registerBreakpoint(breakpoint);

				}
				// operating mode
			} catch (CoreException e) {
				e.printStackTrace();
			}
		}
	}

	@Override
	public void breakpointRemoved(IBreakpoint breakpoint, IMarkerDelta delta) {
		MonitorLogger.info(consoleStream, MonitorLogger.USER, "Checkpoint removed " + breakpoint);
		VICECheckpoint cp = (VICECheckpoint) breakpoint;
		ByteBuffer buffer = ByteBuffer.allocate(4);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		buffer.putInt(cp.getNumber());
		sendCommand(CommandID.CHECKPOINT_DELETE, buffer.array());
	}

	@Override
	public boolean canDisconnect() {
		// make it simple for now
		return false;
		// return !socket.isClosed();
	}

	@Override
	public boolean canResume() {
		return thread.isSuspended();
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
		MonitorLogger.info(consoleStream, MonitorLogger.USER, "Disconnect");
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
		VICEMemoryBlock vmb = new VICEMemoryBlock(this, (int) startAddress, (int) length);
		return vmb;
	}

	public byte[] getComputerMemory() {
		return eventDispatcher.getComputerMemory();
	}

	public synchronized void setComputerMemory(long startAddress, byte[] values) {
		ByteBuffer buffer = ByteBuffer.allocate(values.length + 8);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		buffer.put((byte) 1); // side effects?
		buffer.putShort((short) startAddress);
		buffer.putShort((short) (startAddress + values.length - 1));
		buffer.put((byte) 0);
		buffer.putShort((short) 0);
		buffer.put(values);
		sendCommand(CommandID.MEMORY_SET, buffer.array());
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
		return !socket.isConnected();
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
	public synchronized void resume() throws DebugException {
		MonitorLogger.info(consoleStream, MonitorLogger.USER, "Resume");
		sendCommand(CommandID.EXIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
	}

	@Override
	public boolean supportsBreakpoint(IBreakpoint breakpoint) {
		return breakpoint instanceof VICECheckpoint;
	}

	@Override
	public boolean supportsStorageRetrieval() {
		return true;
	}

	@Override
	public synchronized void suspend() throws DebugException {
		// any command will suspend
		MonitorLogger.info(consoleStream, MonitorLogger.USER, "Suspend");
		sendCommand(CommandID.PING, new byte[] { 0x00 });
	}

	@Override
	public synchronized void terminate() throws DebugException {
		MonitorLogger.info(consoleStream, MonitorLogger.USER, "Terminate");
		sendCommand(CommandID.QUIT, IBinaryMonitor.EMPTY_COMMAND_BODY);
	}

	@Override
	public void breakpointManagerEnablementChanged(boolean enabled) {
		if (enabled) {
			MonitorLogger.info(consoleStream, MonitorLogger.USER, "Breakpoints enabled");
		} else {
			MonitorLogger.info(consoleStream, MonitorLogger.USER, "Breakpoints disabled");
		}
	}

	private void connectEventdDispatcherStreams() {
		try {
			out = new DataOutputStream(socket.getOutputStream());
			in = new DataInputStream(socket.getInputStream());
			eventDispatcher = new MonitorEventDispatcher(thread, in, consoleStream);
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
			MonitorLogger.info(consoleStream, MonitorLogger.USER, "DebugEvent " + event);
			if (DebugEvent.SUSPEND == event.getKind()) {
				try {
					// we assume the first register is the main CPU
					IStackFrame stackFrame = getThreads()[0].getTopStackFrame();
					IRegisterGroup iRegisterGroup = stackFrame.getRegisterGroups()[0];
					// get all the register names, if we don't have them
					if (!iRegisterGroup.hasRegisters()) {
						sendCommand(CommandID.REGISTERS_AVAILABLE, new byte[] { 0x00 });
						// update the list of breakpoints, some may have been
						// set by code or even another manually connected
						// monitor
						sendCommand(CommandID.CHECKPOINT_LIST, new byte[] {});
					}
					// the result from the command does NOT include the
					// start address of the data included, so it's hard to
					// figure it out unless we somehow pass that value. We
					// just read out the entire 64kiB for now.
					sendCommand(CommandID.MEMORY_GET, new byte[] {
							0x00, // side effects
							0x00, // start address LSB
							0x00, // start address MSB
							(byte) 0xff, // end address LSB
							(byte) 0xff, // end address MSB
							0x00, // memspace
							0x00, // bank ID LSB
							0x00 // bank ID MSB
					});
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			if (DebugEvent.TERMINATE == event.getKind()) {
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
				IBreakpoint[] breakpoints = getBreakpointManager().getBreakpoints(DEBUG_MODEL_ID);
				for (IBreakpoint b : breakpoints) {
					if (b instanceof VICECheckpoint) {
						((VICECheckpoint) b).setNumber(0);
					}
				}
			}
		}
	}

	public int sendCommand(CommandID command, byte[] body) {
		int id = counter.incrementAndGet();
		try {
			Command msg = new Command(id, command, body);
			byte[] messageToSend = msg.build();
			MonitorLogger.info(consoleStream, MonitorLogger.INPUT, msg.toString());
			out.write(messageToSend);
			out.flush();
		} catch (IOException e) {
			thread.setState(State.TERMINATED);
			fireTerminateEvent();
		}
		return id;
	}

	private void updateAdresses(IBreakpoint iBreakpoint) throws CoreException {
		VICECheckpoint cp = (VICECheckpoint) iBreakpoint;
		if (cp.getSource() != Source.CODE) {
			IResource br = iBreakpoint.getMarker().getResource();
			// see if the checkpoint is in one of the assembled files
			LineMapping lineMapping;
			try {
				lineMapping = assembly.getLineMapping((IFile) br, cp.getLineNumber());
				if (lineMapping != null) {
					cp.setStartAddress(lineMapping.getStartAddress());
					cp.setEndAddress(lineMapping.getEndAddress());
				}
			} catch (CoreException e) {
				System.err.println("COULD NOT DETERMINE ADDRESS");
			}
		}
	}

	public Assembly getAssembly() {
		return assembly;
	}

	public IConsole getConsole() {
		return console;
	}

	@Override
	public IMemoryBlockExtension getExtendedMemoryBlock(String expression, Object context) throws DebugException {
		int start = 0;
		int length = 256;
		try {

			// Remove whitespace and split the input
			expression = expression.trim();

			if (expression.contains("-")) {
				// A-B syntax: parse start and end, calculate length
				String[] parts = expression.split("-");
				if (parts.length == 2) {
					start = parseNumber(parts[0]);
					int end = parseNumber(parts[1]);
					if (end >= start) {
						length = end - start + 1;
					} else {
						throw new IllegalArgumentException(
								"End address must be greater than or equal to start address.");
					}
				} else {
					throw new IllegalArgumentException("Invalid range format. Use A-B syntax.");
				}
			} else if (expression.contains(",")) {
				// A,Length syntax
				String[] parts = expression.split(",");
				if (parts.length > 0) {
					start = parseNumber(parts[0]);
				}
				if (parts.length > 1) {
					length = parseNumber(parts[1]);
				}
			} else {
				start = parseNumber(expression);
			}


			System.out.println("Start: " + start);
			System.out.println("Length: " + length);
		} catch (NumberFormatException e) {
			System.err.println("Error parsing input: " + e.getMessage());
		} catch (IllegalArgumentException e) {
			System.err.println("Error: " + e.getMessage());
		}
		return new ExtendedVICEMemoryBlock(this, start, length, expression, context);
	}

	/**
	 * Parses a string into an integer. Supports hexadecimal ($ or 0x) and decimal.
	 *
	 * @param value the string to parse
	 * @return the parsed integer value
	 * @throws NumberFormatException if the string cannot be parsed
	 */
	private static int parseNumber(String value) throws NumberFormatException {
		value = value.trim();
		if (value.startsWith("$")) {
			return Integer.parseInt(value.substring(1), 16); // Hexadecimal with $ prefix
		} else if (value.startsWith("0x")) {
			return Integer.parseInt(value.substring(2), 16); // Hexadecimal with 0x prefix
		} else {
			return Integer.parseInt(value); // Decimal
		}
	}
}
