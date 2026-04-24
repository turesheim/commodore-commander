/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.debugadapter.monitor.protocol;

public class ViceMonitorResponseHeader {

    private final byte responseType;
    private final byte errorCode;
    private final int requestId;
    private final int bodyLength;

    public ViceMonitorResponseHeader(byte responseType, byte errorCode, int requestId, int bodyLength) {
        this.responseType = responseType;
        this.errorCode = errorCode;
        this.requestId = requestId;
        this.bodyLength = bodyLength;
    }

    public byte getResponseType() {
        return responseType;
    }

    public byte getErrorCode() {
        return errorCode;
    }

    public int getRequestId() {
        return requestId;
    }

    public int getBodyLength() {
        return bodyLength;
    }
}
