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

import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlAttribute;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "C64debugger")
@XmlAccessorType(XmlAccessType.FIELD)
public class ProgramDebugInfo {

    @XmlAttribute(name = "version")
    private String version;

    @XmlElement(name = "Sources")
    private SourceCatalog sources;

    @XmlElement(name = "Segment")
    private List<Segment> segments;

    @XmlElement(name = "Labels")
    private Labels labels;

    @XmlElement(name = "Breakpoints")
    private Breakpoints breakpoints;

    @XmlElement(name = "Watchpoints")
    private Watchpoints watchpoints;

    public String getVersion() {
        return version;
    }

    public SourceCatalog getSources() {
        return sources;
    }

    public List<Segment> getSegments() {
        return segments == null ? Collections.emptyList() : segments;
    }

    public Labels getLabels() {
        return labels;
    }

    public List<Breakpoint> getBreakpoints() {
        return breakpoints == null ? Collections.emptyList() : breakpoints.getBreakpoints();
    }

    public List<Watchpoint> getWatchpoints() {
        return watchpoints == null ? Collections.emptyList() : watchpoints.getWatchpoints();
    }

    public Optional<LineMapping> findLineMapping(int address) {
        for (Segment segment : getSegments()) {
            if (segment.getBlocks() == null) {
                continue;
            }
            for (Block block : segment.getBlocks()) {
                for (LineMapping lineMapping : block.getLineMappings()) {
                    if (lineMapping.startAddress <= address && lineMapping.endAddress >= address) {
                        return Optional.of(lineMapping);
                    }
                }
            }
        }
        return Optional.empty();
    }

    public Optional<LineMapping> findLineMapping(Path source, int line) {
        OptionalInt fileNumber = findFileNumber(source);
        if (fileNumber.isEmpty()) {
            return Optional.empty();
        }
        for (Segment segment : getSegments()) {
            if (segment.getBlocks() == null) {
                continue;
            }
            for (Block block : segment.getBlocks()) {
                for (LineMapping lineMapping : block.getLineMappings()) {
                    if (lineMapping.getFileIndex() == fileNumber.getAsInt()
                            && lineMapping.getStartLine() == line) {
                        return Optional.of(lineMapping);
                    }
                }
            }
        }
        return Optional.empty();
    }

    public Optional<Label> findLabel(int address) {
        if (labels == null) {
            return Optional.empty();
        }
        for (Label label : labels.getLabels()) {
            if (label.getStartAddress() == address) {
                return Optional.of(label);
            }
        }
        return Optional.empty();
    }

    public Optional<Path> findSource(int fileNumber) {
        if (sources == null) {
            return Optional.empty();
        }
        for (SourceEntry sourceFile : sources.getSourceFiles()) {
            if (sourceFile.getFileNumber() == fileNumber) {
                return Optional.of(sourceFile.getPath());
            }
        }
        return Optional.empty();
    }

    public OptionalInt findFileNumber(Path source) {
        if (sources == null || source == null) {
            return OptionalInt.empty();
        }
        Path normalizedSource = normalize(source);
        for (SourceEntry sourceFile : sources.getSourceFiles()) {
            if (Objects.equals(normalize(sourceFile.getPath()), normalizedSource)) {
                return OptionalInt.of(sourceFile.getFileNumber());
            }
        }
        return OptionalInt.empty();
    }

    public void attachDataLabels(Map<String, DataLabel> dataLabelsByName) {
        if (labels == null || dataLabelsByName == null || dataLabelsByName.isEmpty()) {
            return;
        }
        for (Label label : labels.getLabels()) {
            label.setData(dataLabelsByName.get(label.getName()));
        }
    }

    private static Path normalize(Path path) {
        return path.toAbsolutePath().normalize();
    }
}
