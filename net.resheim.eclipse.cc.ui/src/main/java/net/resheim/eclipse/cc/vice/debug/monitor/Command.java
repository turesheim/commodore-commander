package net.resheim.eclipse.cc.vice.debug.monitor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import net.resheim.eclipse.cc.vice.debug.ANSIColors;
import net.resheim.eclipse.cc.vice.debug.monitor.IBinaryMonitor.CommandID;

/**
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Command {
    private static final byte STX = 0x02;
    private static final byte API_VERSION = 0x02;

    private int requestId;
	private CommandID commandType;
    private byte[] commandBody;

	public Command(int requestId, CommandID commandType, byte[] commandBody) {
        this.requestId = requestId;
		this.commandType = commandType;
        this.commandBody = commandBody;
    }

    public byte[] build() {
		// calculate command length: only the body length
        int commandLength = commandBody.length;

		// allocate buffer (6 bytes header + 4 bytes request ID + 1 byte command type +
		// command body length)
        ByteBuffer buffer = ByteBuffer.allocate(6 + 4 + 1 + commandLength);
		buffer.order(ByteOrder.LITTLE_ENDIAN); // ensure little endian order

		buffer.put(STX); // byte 0
		buffer.put(API_VERSION); // byte 1
		buffer.putInt(commandLength); // bytes 2-5: length (little endian)
		buffer.putInt(requestId); // bytes 6-9: request ID (little endian)
		buffer.put(commandType.getCode()); // byte 10: Command type
		buffer.put(commandBody); // byte 11+: Command body
        return buffer.array();
    }

    public String toString() {
        StringBuilder sb = new StringBuilder();
		sb.append(ANSIColors.CYAN_BACKGROUND);
		sb.append(ANSIColors.BLACK);
		sb.append("<<< ");

		sb.append("Request : ID " + String.format("$%08X", requestId));
		sb.append(", type " + String.format("$%02X", commandType.getCode()) + " (" + commandType.name() + ")");
		sb.append(", length " + commandBody.length);
		sb.append(", body ");
		for (byte b : commandBody) {
			sb.append(byteToHex(b));
			sb.append(" ");
		}
		sb.append(ANSIColors.RESET);
        return sb.toString();
    }

	private static final String byteToHex(byte b) {
        String hex = Integer.toHexString(b & 0xFF);
        return hex.length() == 1 ? "0" + hex : hex;
    }


}