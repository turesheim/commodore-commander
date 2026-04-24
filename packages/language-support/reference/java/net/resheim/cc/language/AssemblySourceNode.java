/**
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.language;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import net.resheim.cc.core.debuginfo.DataLabel;

public class AssemblySourceNode {

    private final Path source;
    private final List<AssemblySourceNode> parents = new ArrayList<>();
    private final Map<Path, AssemblySourceNode> inclusions = new LinkedHashMap<>();
    private final List<Path> unresolvedIncludes = new ArrayList<>();
    private final List<DataLabel> dataLabels = new ArrayList<>();

    public AssemblySourceNode(Path source) {
        this.source = source;
    }

    public Path getSource() {
        return source;
    }

    public void addInclusion(AssemblySourceNode file) {
        inclusions.put(file.getSource(), file);
        file.addParent(this);
    }

    public Map<Path, AssemblySourceNode> getInclusions() {
        return inclusions;
    }

    public List<AssemblySourceNode> getParents() {
        return parents;
    }

    public void addParent(AssemblySourceNode parent) {
        parents.add(parent);
    }

    public boolean contains(Path targetSource) {
        if (source.equals(targetSource)) {
            return true;
        }
        for (AssemblySourceNode child : inclusions.values()) {
            if (child.contains(targetSource)) {
                return true;
            }
        }
        return false;
    }

    public void addDataLabel(DataLabel label) {
        dataLabels.add(label);
    }

    public List<DataLabel> getDataLabels() {
        return dataLabels;
    }

    public void addUnresolvedInclude(Path include) {
        unresolvedIncludes.add(include);
    }

    public List<Path> getUnresolvedIncludes() {
        return unresolvedIncludes;
    }

    @Override
    public String toString() {
        return source.toString();
    }
}
