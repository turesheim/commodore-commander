package net.resheim.eclipse.cc.vice.debug;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class Message {
    private static final byte STX = 0x02;
    private static final byte API_VERSION = 0x02;

    private int requestId;
    private byte commandType;
    private byte[] commandBody;

    public Message(int requestId, byte commandType, byte[] commandBody) {
        this.requestId = requestId;
        this.commandType = commandType;
        this.commandBody = commandBody;
    }

    public byte[] buildMessage() {
        // Calculate command length: only the body length
        int commandLength = commandBody.length;

        // Allocate buffer (6 bytes header + 4 bytes request ID + 1 byte command type + command body length)
        ByteBuffer buffer = ByteBuffer.allocate(6 + 4 + 1 + commandLength);
        buffer.order(ByteOrder.LITTLE_ENDIAN); // Ensure little endian order

        buffer.put(STX); // Byte 0
        buffer.put(API_VERSION); // Byte 1
        buffer.putInt(commandLength); // Bytes 2-5: length (little endian)
        buffer.putInt(requestId); // Bytes 6-9: request ID (little endian)
        buffer.put(commandType); // Byte 10: Command type
        buffer.put(commandBody); // Byte 11+: Command body
        return buffer.array();
    }

    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Command Length: " + String.format("%08X", commandBody.length) + "\n");
        sb.append("Request ID    : " + String.format("%08X", requestId) + "\n");
        sb.append("Command type  : " + byteToHex(commandType) + "\n");
        sb.append("Command body  : ");
        for (byte b : commandBody) {
            sb.append(byteToHex(b));
            sb.append(" ");
        }
        sb.append("\n");
        return sb.toString();
    }

    private static String byteToHex(byte b) {
        String hex = Integer.toHexString(b & 0xFF);
        return hex.length() == 1 ? "0" + hex : hex;
    }


}