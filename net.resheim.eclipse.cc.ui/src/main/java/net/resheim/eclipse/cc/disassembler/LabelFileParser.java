package net.resheim.eclipse.cc.disassembler;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;

/**
 * First iteration of a 6502 disassembler.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class LabelFileParser {

	public static HashMap<Integer, Label> parse(File file) {
		HashMap<Integer, Label> labels = new HashMap<>();
		try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.startsWith("al C:")) {
					String[] parts = line.split(" ", 3);
					if (parts.length > 1) {
						String code = parts[1].substring(2);
						String description = parts.length == 3 ? parts[2] : "";
						Integer address = Integer.parseInt(code, 16);
						Label label = new Label(address, description);
						labels.put(address, label);
					}
				}
			}
		} catch (IOException e) {
			System.err.println("Error reading the file: " + e.getMessage());
		}
		return labels;
	}

}
