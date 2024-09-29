package net.resheim.eclipse.cc.disassembler;

/**
 * First iteration of a 6502 disassembler.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */

public class Label {

	int address;
	String name;

	public Label(int address, String name) {
		super();
		this.address = address;
		this.name = name;
	}

}
