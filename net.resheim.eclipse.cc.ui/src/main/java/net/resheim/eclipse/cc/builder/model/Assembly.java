/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
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
package net.resheim.eclipse.cc.builder.model;

import java.util.List;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.debug.core.model.ISourceLocator;
import org.eclipse.debug.core.model.IStackFrame;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlAttribute;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;

/**
 * This is the root element from parsing <code>*.dbg</code> files that
 * <i>KickAssembler</i> produces when supplied with the <code>-debugdump</code>
 * flag. This was originally intended for the
 * <a href="https://sourceforge.net/projects/c64-debugger/">C64 65XE NES
 * Debugger</a>. But comes in very useful as it is the only way we can figure
 * out the various code segments, how they are laid out in memory and are
 * corresponding to the actual code.
 *
 * <p>
 * This type represents the root element of the file, but also attempts to
 * remove the intricacies of the original file format.
 * </p>
 *
 */
@XmlRootElement(name = "C64debugger")
@XmlAccessorType(XmlAccessType.FIELD)
public class Assembly {

	/** Format version */
    @XmlAttribute(name = "version")
    private String version;

	/** A list of included source files */
    @XmlElement(name = "Sources")
    private Sources sources;

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

	public Sources getSources() {
		return sources;
	}

	public List<Segment> getSegments() {
		return segments;
	}

	public Labels getLabels() {
		return labels;
	}

	/**
	 * Returns the {@link LineMapping} for the given address.
	 *
	 * @param address the address to search for
	 * @return the matching line mapping or <code>null</code> if not found
	 */
	public LineMapping getLineMapping(int address) {
		for (Segment segment : segments) {
			List<Block> blocks = segment.getBlocks();
			for (Block block : blocks) {
				List<LineMapping> lineMappings = block.getLineMappings();
				for (LineMapping linemapping : lineMappings) {
					if (linemapping.startAddress <= address && linemapping.endAddress >= address) {
						return linemapping;
					}
				}

			}

		}
		return null;
	}

	public LineMapping getLineMapping(IFile file, int line) {
		int fileNumber = findFilenumber(file);
		if (fileNumber > -1) {
			for (Segment segment : segments) {
				List<Block> blocks = segment.getBlocks();
				for (Block block : blocks) {
					for (LineMapping lineMapping : block.getLineMappings()) {
						if (lineMapping.fileIndex == fileNumber) {
							if (lineMapping.getStartLine() == line) {
								return lineMapping;
							}
						}
					}
				}
			}
		} // if
		return null;
	}

	public int findFilenumber(IFile file) {
		for (SourceFile sourceFile : sources.getSourceFiles()) {
			IFile sf = ResourcesPlugin.getWorkspace().getRoot().getFileForLocation(sourceFile.getPath());
			if (sf != null && sf.equals(file)) {
				return sourceFile.getFileNumber();
			}
		}
		return -1;
	}

	public IFile findFile(int fileNumber) {
		for (SourceFile sourceFile : sources.getSourceFiles()) {
			if (sourceFile.getFileNumber() == fileNumber) {
				return ResourcesPlugin.getWorkspace().getRoot().getFileForLocation(sourceFile.getPath());
			}
		}
		return null;
	}

	public List<Breakpoint> getBreakpoints() {
		return breakpoints.getBreakpoints();
	}

	public List<Watchpoint> getWatchpoints() {
		return watchpoints.getWatchpoints();
	}

}