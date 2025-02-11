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
package net.resheim.eclipse.cc.vice.debug.monitor;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Status;
import org.eclipse.core.runtime.jobs.ILock;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManager;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IMemoryBlock;
import org.eclipse.ui.console.MessageConsoleStream;

import net.resheim.eclipse.cc.vice.debug.MonitorLogger;
import net.resheim.eclipse.cc.vice.debug.model.VICECheckpoint;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement.State;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugTarget;
import net.resheim.eclipse.cc.vice.debug.model.VICERegisterGroup;
import net.resheim.eclipse.cc.vice.debug.model.VICEStackFrame;
import net.resheim.eclipse.cc.vice.debug.model.VICEThread;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.CommandID;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.ResponseID;

/**
 * This type handles the responsive end of the <i>VICE Binary Monitor</i>
 * connection. It will listen to events from the monitor and fires corresponding
 * debug events.
 *
 * <p>
 * This type will fire {@link DebugEvent}s on behalf of the {@link VICEThread}
 * whenever parsing of the monitor response or event is completed.
 * </p>
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class MonitorEventDispatcher extends Job {


	private final InputStream inputStream;

	private final VICEThread thread;

	/**
	 * Temporary array of register values. This is updated every time a command is
	 * sent, since the emulator will respond by suspending and sending a list of
	 * register values.
	 */
	private final short[] registerValues = new short[256];

	/**
	 * The current value of the computer's memory. 64kiB in this case as we are
	 * targeting the Commodore 64s main main memory.
	 */
	private final byte[] computerMemory = new byte[65_536];

	private MessageConsoleStream consoleStream;

	public MonitorEventDispatcher(VICEThread thread, InputStream inputStream,
			MessageConsoleStream consoleStream) {
		super("Binary monitor dispach");
		this.inputStream = inputStream;
		this.thread = thread;
		this.consoleStream = consoleStream;
	}

	private static String byteToHex(byte b) {
		String hex = Integer.toHexString(b & 0xFF);
		return hex.length() == 1 ? "0" + hex : hex;
	}

	private void parseResponse(Response header, byte[] responseBody) throws DebugException {
		try {
			debug(header, responseBody);
			if (header.responseType == ResponseID.STOPPED.getCode()) {
				thread.setState(State.SUSPENDED);
				if (thread.isStepping()) {
					thread.fireSuspendEvent(DebugEvent.STEP_END);
				} else {
					thread.fireSuspendEvent(DebugEvent.UNSPECIFIED);
				}
			} else if (header.responseType == ResponseID.CHECKPOINT_INFO.getCode())
				parseCheckpointInfo(header, responseBody);
			else if (header.responseType == ResponseID.RESUMED.getCode()) {
				thread.setState(State.RUNNING);
				thread.fireResumeEvent(DebugEvent.UNSPECIFIED);
			} else if (header.responseType == CommandID.MEMORY_GET.getCode())
				parseMemoryGet(responseBody);
			else if (header.responseType == CommandID.MEMORY_SET.getCode())
				// update the memory image
				((VICEDebugTarget) thread.getDebugTarget()).sendCommand(CommandID.MEMORY_GET, new byte[] { 0x00, // side
																													// effects
						0x00, // start address LSB
						0x00, // start address MSB
						(byte) 0xff, // end address LSB
						(byte) 0xff, // end address MSB
						0x00, // memspace
						0x00, // bank ID LSB
						0x00 // bank ID MSB
				});

			else if (header.responseType == CommandID.QUIT.getCode()) {
				thread.setState(State.TERMINATED);
				thread.fireTerminateEvent();
			}
			else if (header.responseType == ResponseID.REGISTER_INFO.getCode())
				parseRegistersGet(responseBody);
			else if (header.responseType == CommandID.CHECKPOINT_TOGGLE.getCode())
				ack();
			else if (header.responseType == CommandID.REGISTERS_AVAILABLE.getCode())
				parseRegistersAvailable(responseBody);
			else
				MonitorLogger.error(consoleStream, MonitorLogger.OUTPUT,
						"Unhandled response " + String.format("$%02X", header.responseType));
		} catch (CoreException e) {
			throw new DebugException(Status.error("Could not parse", e));
		}
	}

	/**
	 * Does nothing.
	 */
	private void ack() {
		// TODO Auto-generated method stub
	}

	private void debug(Response header, byte[] responseBody) {
		// ----------------------------------------------------------------------
		// Use this for debugging, clean up and reimplement later
		byte code = header.responseType;
		// Some codes are reused for Response and command, response is probably
		// the most accurate in this context.
		String type = ResponseID.hasCode(code) ? ResponseID.getNameFromCode(code) : CommandID.getNameFromCode(code);
		StringBuilder sb = new StringBuilder();
		sb.append("Response: ID " + String.format("$%08X", header.requestId));
		sb.append(", type " + String.format("$%02X", header.responseType) + " ("
				+ type + ")");
		sb.append(", error " + String.format("$%02X", header.errorCode));
		sb.append(", length " + header.bodyLength);
		sb.append(", body ");
		for (int i = 0; i < responseBody.length; i++) {
			byte b = responseBody[i];
			sb.append(byteToHex(b));
			sb.append(" ");
			if (i == 31) {
				sb.append("…");
				break;
			}
		}
		if (header.errorCode > 0) {
			MonitorLogger.error(consoleStream, MonitorLogger.OUTPUT, sb.toString());
		} else {
			MonitorLogger.info(consoleStream, MonitorLogger.OUTPUT, sb.toString());
		}
	}


	/**
	 * It appears that when VICE is reporting watchpoints with read/write actions
	 * set, it will return two instances at the same address.
	 *
	 * @param header
	 * @param responseBody
	 * @throws CoreException
	 */
	private void parseCheckpointInfo(Response header, byte[] responseBody) throws CoreException {
		// parse information from the checkooint info
		ByteBuffer buffer = ByteBuffer.wrap(responseBody, 0, responseBody.length);
		buffer.order(ByteOrder.LITTLE_ENDIAN);
		int number = buffer.getInt(); // first four bytes
		boolean hit = buffer.get() == 0x1 ? true : false;
		int startAddress = buffer.getShort() & 0xFFFF;
		int endAddress = buffer.getShort() & 0xFFFF;
		boolean stop = buffer.get() == 0x1 ? true : false;
		boolean enabled = buffer.get() == 0x1 ? true : false;
		byte bitmask = buffer.get();
		boolean isLoad = (bitmask & (1 << 0)) != 0; // Check bit 0
		boolean isStore = (bitmask & (1 << 1)) != 0; // Check bit 1
		boolean isExec = (bitmask & (1 << 2)) != 0; // Check bit 2
		boolean temp = buffer.get() == 0x1 ? true : false;

		// see if we have the breakpoint already
		IBreakpointManager breakpointManager = DebugPlugin.getDefault().getBreakpointManager();
		IBreakpoint[] breakpoints = breakpointManager.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);
		for (IBreakpoint iBreakpoint : breakpoints) {
			if (iBreakpoint instanceof VICECheckpoint) {
				VICECheckpoint testing = (VICECheckpoint) iBreakpoint;
				// hitherto unnumbered checkpoint
				if (testing.getNumber() == 0) {
					// If the command request identifier matches the one used when creating the
					// checkpoint we can use the ID otherwise, we may be able to use the address, in
					// order to number the breakpoint that we already have registered in the debug
					// manager
					if (header.requestId == testing.getRequestId() || startAddress == testing.getStartAddress()) {
						testing.setNumber(number);
						testing.setRequestId(0);
						testing.setCurrentlyHit(hit);
						testing.setLoad(isLoad);
						testing.setExec(isExec);
						testing.setStore(isStore);
						testing.setEnabled(enabled);
						testing.setTemporary(temp);
						testing.setEndAddress(endAddress);
						break;
					}
				}
				if (testing.getNumber() == 0) {
					MonitorLogger.error(consoleStream, MonitorLogger.USER,
							"Unknown checkpoint number " + number + " at $" + Integer.toHexString(startAddress));
					return;
				}
			}
		}
	}

	private void parseRegistersAvailable(byte[] responseBody) {
		try {
			VICEStackFrame stackFrame = (VICEStackFrame) thread.getTopStackFrame();
			VICERegisterGroup registerGroup = (VICERegisterGroup) stackFrame.getRegisterGroups()[0];

			ByteBuffer buffer = ByteBuffer.wrap(responseBody, 0, responseBody.length);
			buffer.order(ByteOrder.LITTLE_ENDIAN);
			int items = buffer.getShort() & 0xFF;
			// An array with items of structure:
			for (int i = 0; i < items; i++) {
				StringBuilder sb = new StringBuilder();
				buffer.get(); // Size of the item, excluding this byte
				byte id = buffer.get(); // ID of the register
				byte bitSize = buffer.get(); // Size of the register in bits
				int nameLength = buffer.get(); // Length of name
				for (int c = 0; c < nameLength; c++) {
					char n = (char) buffer.get();
					sb.append(n);
				} // for char
				if (registerGroup.getRegisterById(id) == null) {
					registerGroup.addRegister(id, sb.toString(), registerValues[id], bitSize);
				}
			} // for item
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	/**
	 * Response body:
	 *
	 * <pre>
	 * byte 0-1: The count of the array items
	 * byte 2+: An array with items of structure:
	 *   byte 0: Size of the item, excluding this byte
	 *   byte 1-2: bank ID
	 *   byte 3: Name length
	 *   byte 4+: Name
	 * </pre>
	 *
	 * @param responseBody
	 */
	private void parseRegistersGet(byte[] responseBody) {
		try {
			VICEStackFrame stackFrame = (VICEStackFrame) thread.getTopStackFrame();
			VICERegisterGroup registerGroup = (VICERegisterGroup) stackFrame.getRegisterGroups()[0];
			ByteBuffer buffer = ByteBuffer.wrap(responseBody, 0, responseBody.length);
			buffer.order(ByteOrder.LITTLE_ENDIAN); // Set buffer to little endian
			int items = Short.toUnsignedInt(buffer.getShort());
			for (int i = 0; i < items; i++) {
				int size = buffer.get(); // Size of the item, excluding this byte
				byte id = buffer.get(); // ID of the register
				if (size == 2) {
					System.out.println("MonitorEventDispatcher.parseRegistersGet()");
				}
				// get the value // length is three or more!
				if (size == 3) {
					short value = buffer.getShort();
					registerValues[id] = (short) value;
					if (registerGroup.getRegisterById(id) != null) {
						registerGroup.getRegisterById(id).internalSetValue(value);
					}
				} else {
					throw new RuntimeException("Unhandled array length " + size);
				}
			} // for item
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	private void parseMemoryGet(byte[] responseBody) {
		try {
			ByteBuffer buffer = ByteBuffer.wrap(responseBody, 0, responseBody.length);
			buffer.order(ByteOrder.LITTLE_ENDIAN);
			int items = buffer.getShort() & 0xFF;
			// the response does _not_ contain the starting address and we
			// have no way of knowing it unless connected to the command that
			// requested this data – therefore we will always read the full 64kiB
			// each time instead of implementing something elaborate
			if (items == 0)
				items = 65_535;

			// update the cache
			buffer.get(computerMemory, 0, items);

			// update all the blocks already in view
			IMemoryBlock[] memoryBlocks = DebugPlugin.getDefault().getMemoryBlockManager()
					.getMemoryBlocks(thread.getDebugTarget());
			for (IMemoryBlock iMemoryBlock : memoryBlocks) {
				int startAddress = (int) iMemoryBlock.getStartAddress();
				int length = (int) iMemoryBlock.getLength();
				byte[] temp = new byte[length];
				// why +2 here? must be a bug somewhere
				System.arraycopy(responseBody, startAddress + 2, temp, 0, length);
				iMemoryBlock.setValue(0, temp);
			}
			// Not sure if this is needed
			thread.fireEvent(new DebugEvent(thread.getDebugTarget(), DebugEvent.CHANGE, DebugEvent.STATE));

		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public byte[] getComputerMemory() {
		return computerMemory;
	}

	@Override
	protected IStatus run(IProgressMonitor monitor) {
		try {
			while (!thread.isTerminated()) {
				if (inputStream.available() > 0) {

					// read the header which is 12 bytes long
					byte[] initialBytes = new byte[12];
					inputStream.readNBytes(initialBytes, 0, 12);

					ByteBuffer initialBuffer = ByteBuffer.wrap(initialBytes, 0, 12);
					initialBuffer.order(ByteOrder.LITTLE_ENDIAN); // Set buffer to little endian

					byte stx = initialBuffer.get(); // Byte 0: STX
					assert (stx == Response.STX);

					byte api_version = initialBuffer.get(); // Byte 1: API Version
					assert (api_version == Response.API_VERSION);

					int bodyLength = initialBuffer.getInt(); // bytes 2-5: response body length (little endian)
					byte responseType = initialBuffer.get(); // byte 6: Response type
					byte errorCode = initialBuffer.get(); // byte 7: Error code
					int requestId = initialBuffer.getInt(); // bytes 8-11: Request ID (little endian)

					Response header = new Response(responseType, errorCode, requestId, bodyLength);

					byte[] bodyBytes = new byte[bodyLength];
					inputStream.readNBytes(bodyBytes, 0, bodyLength);
					assert (bodyLength == bodyBytes.length);

					ILock lock = Job.getJobManager().newLock();
					lock.acquire();
					try {
						parseResponse(header, bodyBytes);
					} finally {
						lock.release();
					}

				} // if
			} // while
			return Status.OK_STATUS;
		} catch (IOException | DebugException e) {
			try {
				thread.getLaunch().terminate();
			} catch (DebugException e1) {
				e1.printStackTrace();
			}
			return Status.CANCEL_STATUS;
		} finally {
			try {
				inputStream.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}

}