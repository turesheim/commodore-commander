/**
 * Copyright (c) 2026 Torkild U. Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.debugadapter.monitor.protocol;

import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class ViceMonitorFrameCodec implements ViceMonitorResponseDecoder {

    public static final int HEADER_LENGTH = 12;

    public ViceMonitorResponseFrame readResponse(InputStream inputStream) throws IOException {
        byte[] headerBytes = readFully(inputStream, HEADER_LENGTH);
        ByteBuffer headerBuffer = ByteBuffer.wrap(headerBytes);
        headerBuffer.order(ByteOrder.LITTLE_ENDIAN);

        byte stx = headerBuffer.get();
        if (stx != ViceBinaryMonitorProtocol.STX) {
            throw new ViceMonitorProtocolException("Unexpected STX byte: " + hex(stx));
        }

        byte apiVersion = headerBuffer.get();
        if (apiVersion != ViceBinaryMonitorProtocol.API_VERSION) {
            throw new ViceMonitorProtocolException("Unsupported API version: " + hex(apiVersion));
        }

        int bodyLength = headerBuffer.getInt();
        if (bodyLength < 0) {
            throw new ViceMonitorProtocolException("Negative body length: " + bodyLength);
        }

        byte responseType = headerBuffer.get();
        byte errorCode = headerBuffer.get();
        int requestId = headerBuffer.getInt();

        byte[] body = readFully(inputStream, bodyLength);
        ViceMonitorResponseHeader header = new ViceMonitorResponseHeader(responseType, errorCode, requestId,
                bodyLength);
        return new ViceMonitorResponseFrame(header, body);
    }

    private static byte[] readFully(InputStream inputStream, int length) throws IOException {
        byte[] bytes = inputStream.readNBytes(length);
        if (bytes.length != length) {
            throw new EOFException("Expected " + length + " bytes but received " + bytes.length);
        }
        return bytes;
    }

    private static String hex(byte value) {
        return String.format("0x%02X", value);
    }
}
