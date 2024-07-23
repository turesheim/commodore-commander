package net.resheim.eclipse.cc.disassembler;

/**
 * First iteration of a 6502 disassembler.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Disassembly {

	enum Presentation {
		CODE, DATA
	}

	/** Whether or not the segment should be presented as code or data */
	private Presentation presentation;

	/** The starting address of the segment */
	private int address;

	/** The length of the data or code segment */
	private int length;

	private String text;

	private boolean label;

	public int getAddress() {
		return address;
	}

	public Disassembly(int address, String text, int length) {
		super();
		presentation = Presentation.CODE;
		this.address = address;
		this.text = text;
		this.length = length;
	}

	public Disassembly(int address, String text, int length, boolean label) {
		super();
		presentation = Presentation.CODE;
		this.address = address;
		this.text = text;
		this.label = label;
		this.length = length;
	}

	public String getText() {
		return text;
	}

	public boolean isLabel() {
		return label;
	}

	public void setLabel(boolean label) {
		this.label = label;
	}

	public Presentation getPresentation() {
		return presentation;
	}

	public void setPresentation(Presentation presentation) {
		this.presentation = presentation;
	}

	public int getLength() {
		return length;
	}

	public void setLength(int length) {
		this.length = length;
	}

}
