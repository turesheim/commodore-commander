package net.resheim.eclipse.cc.vice.debug.monitor;

public class MessageResponse {

	public static final byte STX = 0x02;
	public static final byte API_VERSION = 0x02;

	byte responseType;
	byte errorCode;
	int requestId;
	int bodyLength;

	public MessageResponse(byte responseType, byte errorCode, int requestId, int bodyLength) {
		super();
		this.responseType = responseType;
		this.errorCode = errorCode;
		this.requestId = requestId;
		this.bodyLength = bodyLength;
	}

}
