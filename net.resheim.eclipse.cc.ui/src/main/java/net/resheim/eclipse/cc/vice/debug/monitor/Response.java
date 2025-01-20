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
