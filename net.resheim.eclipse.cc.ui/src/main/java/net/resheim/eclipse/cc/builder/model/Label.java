package net.resheim.eclipse.cc.builder.model;

public class Label extends LineMapping {

	private String segment;
	private String name;

	public Label(String inputString) {
		String[] split = inputString.split(",");
		segment = split[0];
		startAddress = Integer.parseInt(split[1].substring(1), 16);
		name = split[2];
		fileIndex = Integer.parseInt(split[3]);
		startLine = Integer.parseInt(split[4]);
		startColumn = Integer.parseInt(split[5]);
		endLine = Integer.parseInt(split[6]);
		endColumn = Integer.parseInt(split[7]);
	}

	public String getSegment() {
		return segment;
	}

	public String getName() {
		return name;
	}

}
