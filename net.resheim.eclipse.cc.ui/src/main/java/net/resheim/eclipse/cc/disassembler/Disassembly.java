package net.resheim.eclipse.cc.disassembler;

/**
 * This type represents one disassembled instruction.
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

	private String label;

	private int line;

	public int getAddress() {
		return address;
	}

	public Disassembly(int line, int address, String text, int length) {
		super();
		presentation = Presentation.CODE;
		this.address = address;
		this.text = text;
		this.length = length;
		this.setLine(line);
	}

	public String getText() {
		return text;
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

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public int getLine() {
		return line;
	}

	public void setLine(int line) {
		this.line = line;
	}

	public String toString() {
		StringBuilder sb = new StringBuilder();
		sb.append(String.format("$%02X", address));

		return sb.toString();
	}

}
