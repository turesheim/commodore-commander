package net.resheim.eclipse.cc.vice.debug;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import org.eclipse.debug.core.DebugEvent;

import net.resheim.eclipse.cc.vice.debug.IBinaryMonitor.Command;
import net.resheim.eclipse.cc.vice.debug.IBinaryMonitor.Response;

public class MonitorInputStreamListener implements Runnable {

	private final InputStream inputStream;
	private final VICEThread thread;

	/**
	 * Temporary array of register values. This is updated every time a command is
	 * sent, since the emulator will respond by suspending and sending a list of
	 * register values.
	 */
	private final short[] values = new short[256];


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

	public void parseResponse(MessageResponse header, byte[] bodyBytes) {

		// ----------------------------------------------------------------------
		// Use this for debugging, clean up and reimplement later
		byte code = header.responseType;
		// Some codes are reused for Response and command, response is probably
		// the most accurate.
		String type = Response.hasCode(code) ? Response.getNameFromCode(code) : Command.getNameFromCode(code);
		StringBuilder sb = new StringBuilder();
		sb.append(">>> Response: ID " + String.format("$%08X", header.requestId));
		sb.append(", error " + String.format("$%02X", header.errorCode));
		sb.append(", type " + String.format("$%02X", header.responseType) + " ("
				+ type + ")");
		sb.append(", length " + header.bodyLength);
		sb.append(", body ");
		for (byte b : bodyBytes) {
			sb.append(byteToHex(b));
			sb.append(" ");
		}
		System.out.println(sb);
		// ----------------------------------------------------------------------

		if (header.responseType == Response.STOPPED.getCode())
			thread.fireSuspendEvent(0);
		else if (header.responseType == Response.CHECKPOINT.getCode()) {
			System.err.println("IMPLEMENT CHECKPOINT");
			// code må være checkpoint nummer
			thread.fireEvent(new DebugEvent(thread, DebugEvent.SUSPEND, DebugEvent.BREAKPOINT));
		}
		else if (header.responseType == Response.RESUMED.getCode())
			thread.fireResumeEvent(0);
		else if (header.responseType == Command.QUIT.getCode())
			// VICE will typically segfault here, and it appears there is nothing we can do
			// about it - we can avoid it by killing the IProcess first, but that is nasty
			thread.fireTerminateEvent();
		else if (header.responseType == Response.REGISTER.getCode())
			parseRegistersGet(bodyBytes);
		else if (header.responseType == Command.REGISTERS_AVAILABLE.getCode())
			parseRegistersAvailable(bodyBytes);
		else
			System.err.println("Unhandled command " + byteToHex(header.responseType));

	}


	private void parseRegistersAvailable(byte[] responseBody) {
		try {
			VICEStackFrame stackFrame = (VICEStackFrame) thread.getTopStackFrame();
			VICERegisterGroup registerGroup = (VICERegisterGroup) stackFrame.getRegisterGroups()[0];

			ByteBuffer buffer = ByteBuffer.wrap(responseBody, 0, responseBody.length);
			buffer.order(ByteOrder.LITTLE_ENDIAN); // Set buffer to little endian
			short items = buffer.getShort(); // The count of the array items
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
					registerGroup.addRegister(id, sb.toString(), values[id], bitSize);
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
			short items = buffer.getShort(); // The count of the array items
			for (int i = 0; i < items; i++) {
				int size = buffer.get(); // Size of the item, excluding this byte
				byte id = buffer.get(); // ID of the register
				// get the value // length is three or more!
				if (size == 3) {
					short value = buffer.getShort();
					values[id] = (short) value;
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


}