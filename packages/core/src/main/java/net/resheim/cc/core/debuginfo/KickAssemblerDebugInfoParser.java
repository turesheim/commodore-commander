/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.core.debuginfo;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.JAXBException;
import jakarta.xml.bind.Unmarshaller;

public class KickAssemblerDebugInfoParser {

    public ProgramDebugInfo parse(Path debugInfoFile) throws IOException, JAXBException {
        try (InputStream inputStream = Files.newInputStream(debugInfoFile)) {
            return parse(inputStream);
        }
    }

    public ProgramDebugInfo parse(InputStream inputStream) throws JAXBException {
        JAXBContext context = JAXBContext.newInstance(ProgramDebugInfo.class);
        Unmarshaller unmarshaller = context.createUnmarshaller();
        return (ProgramDebugInfo) unmarshaller.unmarshal(inputStream);
    }
}
