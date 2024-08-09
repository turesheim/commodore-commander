package net.resheim.eclipse.cc.vice.debug.monitor;

/**
 *
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Response {

	public static final byte STX = 0x02;
	public static final byte API_VERSION = 0x02;

	byte responseType;
	byte errorCode;
	int requestId;
	int bodyLength;

	public Response(byte responseType, byte errorCode, int requestId, int bodyLength) {
		super();
		this.responseType = responseType;
		this.errorCode = errorCode;
		this.requestId = requestId;
		this.bodyLength = bodyLength;
	}

}
