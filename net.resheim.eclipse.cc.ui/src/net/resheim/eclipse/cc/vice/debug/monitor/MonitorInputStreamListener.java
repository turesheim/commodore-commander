package net.resheim.eclipse.cc.vice.debug.monitor;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HashMap;
import java.util.Map;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.IBreakpointManager;
import org.eclipse.debug.core.model.IBreakpoint;

import net.resheim.eclipse.cc.vice.debug.model.Checkpoint;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;
import net.resheim.eclipse.cc.vice.debug.model.VICERegisterGroup;
import net.resheim.eclipse.cc.vice.debug.model.VICEStackFrame;
import net.resheim.eclipse.cc.vice.debug.model.VICEThread;
import net.resheim.eclipse.cc.vice.debug.model.Checkpoint.Operation;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.Command;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.Response;

/**
 * This type handles the responsive end of the <i>VICE Binary Monitor</i>
 * connection. It will keep a local representation of data obtained from the
 * monitor and respond to events.
 *
 * <p>
 * This type will fire {@link DebugEvent}s on behalf of the {@link VICEThread}
 * whenever parsing of the monitor response or event is completed.
 * </p>
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 *
 */
public class MonitorInputStreamListener implements Runnable {

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

	public MonitorInputStreamListener(VICEThread viceThread, InputStream inputStream) {
		this.inputStream = inputStream;
		this.thread = viceThread;
	}

	@Override
	public void run() {

		try {

			while (!Thread.currentThread().isInterrupted()) {
				if (inputStream.available() > 0) {

					// read the header which is 12 bytes long
					byte[] initialBytes = new byte[12];
					inputStream.readNBytes(initialBytes, 0, 12);

					ByteBuffer initialBuffer = ByteBuffer.wrap(initialBytes, 0, 12);
					initialBuffer.order(ByteOrder.LITTLE_ENDIAN); // Set buffer to little endian

					byte stx = initialBuffer.get(); // Byte 0: STX
					assert (stx == MessageResponse.STX);

					byte api_version = initialBuffer.get(); // Byte 1: API Version
					assert (api_version == MessageResponse.API_VERSION);

					int bodyLength = initialBuffer.getInt(); // Bytes 2-5: response body length (little endian)
					byte responseType = initialBuffer.get(); // Byte 6: Response type
					byte errorCode = initialBuffer.get(); // Byte 7: Error code
					int requestId = initialBuffer.getInt(); // Bytes 8-11: Request ID (little endian)

					MessageResponse header = new MessageResponse(responseType, errorCode, requestId, bodyLength);

					byte[] bodyBytes = new byte[bodyLength];
					inputStream.readNBytes(bodyBytes, 0, bodyLength);
					assert (bodyLength == bodyBytes.length);

					parseResponse(header, bodyBytes);

				} // if
			} // while
		} catch (Exception e) {
			e.printStackTrace();
		}

	}

	private static String byteToHex(byte b) {
		String hex = Integer.toHexString(b & 0xFF);
		return hex.length() == 1 ? "0" + hex : hex;
	}

	private synchronized void parseResponse(MessageResponse header, byte[] responseBody) {

		// ----------------------------------------------------------------------
		// Use this for debugging, clean up and reimplement later
		byte code = header.responseType;
		// Some codes are reused for Response and command, response is probably
		// the most accurate in this context.
		String type = Response.hasCode(code) ? Response.getNameFromCode(code) : Command.getNameFromCode(code);
		StringBuilder sb = new StringBuilder();
		sb.append(">>> Response: ID " + String.format("$%08X", header.requestId));
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
		// print some debug info
		System.out.println(sb);

		// ----------------------------------------------------------------------

		if (header.responseType == Response.STOPPED.getCode())
			thread.fireSuspendEvent(0);
		else if (header.responseType == Response.CHECKPOINT_INFO.getCode())
			parseCheckpointInfo(responseBody);
		else if (header.responseType == Response.RESUMED.getCode())
			thread.fireResumeEvent(0);
		else if (header.responseType == Command.MEMORY_GET.getCode())
			// TODO Handle that we may not be reading the entire 64k
			parseMemoryGet(responseBody);
		else if (header.responseType == Command.QUIT.getCode())
			thread.fireTerminateEvent();
		else if (header.responseType == Response.REGISTER_INFO.getCode())
			parseRegistersGet(responseBody);
		else if (header.responseType == Command.REGISTERS_AVAILABLE.getCode())
			parseRegistersAvailable(responseBody);
		else
			// we may care
			System.err.println("Unhandled command " + String.format("$%02X", header.responseType) + " (" + type + ")");

	}


	private void parseCheckpointInfo(byte[] responseBody) {
		try {
			IBreakpointManager breakpointManager = DebugPlugin.getDefault().getBreakpointManager();
			IBreakpoint[] breakpoints = breakpointManager.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);
			ByteBuffer buffer = ByteBuffer.wrap(responseBody, 0, responseBody.length);
			buffer.order(ByteOrder.LITTLE_ENDIAN);
			Checkpoint cp = null;
			// see if we have the breakpoint already
			int id = buffer.getInt();
			for (IBreakpoint iBreakpoint : breakpoints) {
				if (iBreakpoint instanceof Checkpoint && ((Checkpoint) iBreakpoint).getNumber() == id) {
					cp = (Checkpoint) iBreakpoint;
				}
			}
			if (cp == null) {
				cp = new Checkpoint(ResourcesPlugin.getWorkspace().getRoot(), 0);
				cp.setNumber(id);
			}
			cp.setCurrentlyHit(buffer.get() == 0x01);
			cp.setStartAddress(buffer.getShort());
			cp.setEndAddress(buffer.getShort());
			cp.setStopWhenHit(buffer.get() == 0x01);
			buffer.get();
			// cp.setEnabledRemotely(buffer.get() == 0x01);
			cp.setOperation(Operation.parseByte(buffer.get()));
			cp.setTemporary(buffer.get() == 0x01);
			cp.setHitCount(id);
			cp.setIgnoreCount(id);
			cp.setHasCondition(buffer.get() == 0x01);
			cp.setMemspace(buffer.get());
			// we have hit a breakpoint, however a Response.STOPPED will always
			// follow, so we're doing nothing for now
			if (cp.isStopWhenHit() && cp.isCurrentlyHit()) {
//			thread.fireEvent(new DebugEvent(thread, DebugEvent.SUSPEND, DebugEvent.BREAKPOINT));
			}
			breakpointManager.addBreakpoint(cp);
			System.out.println(DebugPlugin.getDefault().getBreakpointManager().isRegistered(cp));

		} catch (CoreException e) {
			e.printStackTrace();
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
			int items = buffer.getShort() & 0xFF;
			for (int i = 0; i < items; i++) {
				int size = buffer.get(); // Size of the item, excluding this byte
				byte id = buffer.get(); // ID of the register
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
			buffer.get(computerMemory, 0, items);
			thread.fireEvent(new DebugEvent(thread, DebugEvent.MODEL_SPECIFIC, IBinaryMonitor.DISASSEMBLE));
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public byte[] getComputerMemory() {
		return computerMemory;
	}

}