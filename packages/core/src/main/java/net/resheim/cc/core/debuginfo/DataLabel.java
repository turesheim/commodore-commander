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

public class DataLabel {

    private final String label;
    private final int length;
    private final int[] lineLengths;
    private ValueType type;
    private NumericPresentation presentation;

    public DataLabel(String label, int length, int[] lineLengths, ValueType type,
            NumericPresentation presentation) {
        this.label = label;
        this.length = length;
        this.lineLengths = lineLengths;
        this.type = type;
        this.presentation = presentation;
    }

    public String getLabel() {
        return label;
    }

    public int getLength() {
        return length;
    }

    public int[] getLineLengths() {
        return lineLengths;
    }

    public ValueType getType() {
        return type;
    }

    public void setType(ValueType type) {
        this.type = type;
    }

    public NumericPresentation getPresentation() {
        return presentation;
    }

    public void setPresentation(NumericPresentation presentation) {
        this.presentation = presentation;
    }
}
