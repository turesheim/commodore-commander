package net.resheim.eclipse.cc.disassembler;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * First iteration of a 6502 disassembler.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class Disassembler {

	public enum AddressingMode {
		/** ADC #$44 */
		IMMEDIATE,
		/** ADC $44 */
		ZERO_PAGE,
		/** ADC $44,X */
		ZERO_PAGE_X,
		/** STX $44,Y */
		ZERO_PAGE_Y,
		/** ADC ($44,X) */
		INDIRECT_X,
		/** ADC ($44),Y */
		INDIRECT_Y,
		/** BPL */
		RELATIVE,
		/** ADC $4400 */
		ABSOLUTE,
		/** ADC $4400,X */
		ABSOLUTE_X,
		/** ADC $4400,Y */
		ABSOLUTE_Y,
		/** JMP ($5597) */
		INDIRECT,
		/** ASL A */
		ACCUMULATOR,
		/** BRK */
		IMPLIED;

		/**
		 * @return the number of bytes required for the instruction
		 */
		public int getDataSize() {
			switch (this.name()) {
			case "IMMEDIATE":
			case "ZERO_PAGE":
			case "ZERO_PAGE_X":
			case "ZERO_PAGE_Y":
			case "INDIRECT_X":
			case "INDIRECT_Y":
			case "RELATIVE":
				return 1;
			case "ABSOLUTE":
			case "ABSOLUTE_X":
			case "ABSOLUTE_Y":
			case "INDIRECT":
				return 2;
			case "ACCUMULATOR":
			case "IMPLIED":
				return 0;
			}
			throw new RuntimeException("Unhandled AdressingMode length " + this.name());
		}
	}

	public static class Opcode {
		String mnemonic;
		AddressingMode mode;
		int code;
		int cycles;
		int crosspage;

		public Opcode(String mnemonic, AddressingMode mode, int code, int cycles, int crosspage) {
			this.mnemonic = mnemonic;
			this.mode = mode;
			this.code = code;
			this.cycles = cycles;
			this.crosspage = crosspage;
		}

	}


	private static final Map<Integer, Opcode> opcodeTable = new HashMap<>();
	private final HashMap<Integer, Label> labels;
	private ArrayList<Disassembly> disassembly;
	private HashMap<Integer, Disassembly> disassemblyLine;


	static {
		addInstruction(0x69, "ADC", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0x65, "ADC", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0x75, "ADC", AddressingMode.ZERO_PAGE_X, 4, 1);
		addInstruction(0x6D, "ADC", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0x7D, "ADC", AddressingMode.ABSOLUTE_X, 4, 1);
		addInstruction(0x79, "ADC", AddressingMode.ABSOLUTE_Y, 4, 1);
		addInstruction(0x61, "ADC", AddressingMode.INDIRECT_X, 6, 1);
		addInstruction(0x71, "ADC", AddressingMode.INDIRECT_Y, 5, 1);

		addInstruction(0x29, "AND", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0x25, "AND", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0x35, "AND", AddressingMode.ZERO_PAGE_X, 4, 1);
		addInstruction(0x2D, "AND", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0x3D, "AND", AddressingMode.ABSOLUTE_X, 4, 1);
		addInstruction(0x39, "AND", AddressingMode.ABSOLUTE_Y, 4, 1);
		addInstruction(0x21, "AND", AddressingMode.INDIRECT_X, 6, 1);
		addInstruction(0x31, "AND", AddressingMode.INDIRECT_Y, 5, 1);

		addInstruction(0x0A, "ASL", AddressingMode.ACCUMULATOR, 2, 0);
		addInstruction(0x06, "ASL", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x16, "ASL", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x0E, "ASL", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x1E, "ASL", AddressingMode.ABSOLUTE_X, 6, 0);

		addInstruction(0x90, "BCC", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0xB0, "BCS", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0xF0, "BEQ", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0x24, "BIT", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x2C, "BIT", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0x30, "BMI", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0xD0, "BNE", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0x10, "BPL", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0x00, "BRK", AddressingMode.IMPLIED, 7, 0);

		addInstruction(0x50, "BVC", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0x70, "BVS", AddressingMode.RELATIVE, 4, 1);

		addInstruction(0x18, "CLC", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0xD8, "CLD", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x58, "CLI", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0xB8, "CLV", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0xC9, "CMP", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0xC5, "CMP", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0xD5, "CMP", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0xCD, "CMP", AddressingMode.ABSOLUTE, 4, 0);
		addInstruction(0xDD, "CMP", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0xD9, "CMP", AddressingMode.ABSOLUTE_Y, 4, 0);
		addInstruction(0xC1, "CMP", AddressingMode.INDIRECT_X, 6, 0);
		addInstruction(0xD1, "CMP", AddressingMode.INDIRECT_Y, 5, 0);

		addInstruction(0xE0, "CPX", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0xE4, "CPX", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0xEC, "CPX", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0xC0, "CPY", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0xC4, "CPY", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0xCC, "CPY", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0xC6, "DEC", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0xD6, "DEC", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0xCE, "DEC", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0xDE, "DEC", AddressingMode.ABSOLUTE_X, 6, 0);

		addInstruction(0xCA, "DEX", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x88, "DEY", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x49, "EOR", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0x45, "EOR", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0x55, "EOR", AddressingMode.ZERO_PAGE_X, 4, 1);
		addInstruction(0x4D, "EOR", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0x5D, "EOR", AddressingMode.ABSOLUTE_X, 4, 1);
		addInstruction(0x59, "EOR", AddressingMode.ABSOLUTE_Y, 4, 1);
		addInstruction(0x41, "EOR", AddressingMode.INDIRECT_X, 6, 1);
		addInstruction(0x51, "EOR", AddressingMode.INDIRECT_Y, 5, 1);

		addInstruction(0xE6, "INC", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0xF6, "INC", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0xEE, "INC", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0xFE, "INC", AddressingMode.ABSOLUTE_X, 6, 0);

		addInstruction(0xE8, "INX", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0xC8, "INY", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x4C, "JMP", AddressingMode.ABSOLUTE, 3, 0);
		addInstruction(0x6C, "JMP", AddressingMode.INDIRECT, 5, 0);

		addInstruction(0x20, "JSR", AddressingMode.ABSOLUTE, 6, 0);

		addInstruction(0xA9, "LDA", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0xA5, "LDA", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0xB5, "LDA", AddressingMode.ZERO_PAGE_X, 4, 1);
		addInstruction(0xAD, "LDA", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0xBD, "LDA", AddressingMode.ABSOLUTE_X, 4, 1);
		addInstruction(0xB9, "LDA", AddressingMode.ABSOLUTE_Y, 4, 1);
		addInstruction(0xA1, "LDA", AddressingMode.INDIRECT_X, 6, 1);
		addInstruction(0xB1, "LDA", AddressingMode.INDIRECT_Y, 5, 1);

		addInstruction(0xA2, "LDX", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0xA6, "LDX", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0xB6, "LDX", AddressingMode.ZERO_PAGE_Y, 4, 1);
		addInstruction(0xAE, "LDX", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0xBE, "LDX", AddressingMode.ABSOLUTE_Y, 4, 1);

		addInstruction(0xA0, "LDY", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0xA4, "LDY", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0xB4, "LDY", AddressingMode.ZERO_PAGE_X, 4, 1);
		addInstruction(0xAC, "LDY", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0xBC, "LDY", AddressingMode.ABSOLUTE_X, 4, 1);

		addInstruction(0x4A, "LSR", AddressingMode.ACCUMULATOR, 2, 0);
		addInstruction(0x46, "LSR", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x56, "LSR", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x4E, "LSR", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x5E, "LSR", AddressingMode.ABSOLUTE_X, 6, 0);

		addInstruction(0xEA, "NOP", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x09, "ORA", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0x05, "ORA", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x15, "ORA", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0x0D, "ORA", AddressingMode.ABSOLUTE, 4, 0);
		addInstruction(0x1D, "ORA", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0x19, "ORA", AddressingMode.ABSOLUTE_Y, 4, 0);
		addInstruction(0x01, "ORA", AddressingMode.INDIRECT_X, 6, 0);
		addInstruction(0x11, "ORA", AddressingMode.INDIRECT_Y, 5, 0);

		addInstruction(0x48, "PHA", AddressingMode.IMPLIED, 3, 0);

		addInstruction(0x08, "PHP", AddressingMode.IMPLIED, 3, 0);

		addInstruction(0x68, "PLA", AddressingMode.IMPLIED, 4, 0);

		addInstruction(0x28, "PLP", AddressingMode.IMPLIED, 4, 0);

		addInstruction(0x2A, "ROL", AddressingMode.ACCUMULATOR, 2, 0);
		addInstruction(0x26, "ROL", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x36, "ROL", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x2E, "ROL", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x3E, "ROL", AddressingMode.ABSOLUTE_X, 6, 0);

		addInstruction(0x6A, "ROR", AddressingMode.ACCUMULATOR, 2, 0);
		addInstruction(0x66, "ROR", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x76, "ROR", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x6E, "ROR", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x7E, "ROR", AddressingMode.ABSOLUTE_X, 6, 0);

		addInstruction(0x40, "RTI", AddressingMode.IMPLIED, 6, 0);

		addInstruction(0x60, "RTS", AddressingMode.IMPLIED, 6, 0);

		addInstruction(0xE9, "SBC", AddressingMode.IMMEDIATE, 2, 1);
		addInstruction(0xE5, "SBC", AddressingMode.ZERO_PAGE, 3, 1);
		addInstruction(0xF5, "SBC", AddressingMode.ZERO_PAGE_X, 4, 1);
		addInstruction(0xED, "SBC", AddressingMode.ABSOLUTE, 4, 1);
		addInstruction(0xFD, "SBC", AddressingMode.ABSOLUTE_X, 4, 1);
		addInstruction(0xF9, "SBC", AddressingMode.ABSOLUTE_Y, 4, 1);
		addInstruction(0xE1, "SBC", AddressingMode.INDIRECT_X, 6, 1);
		addInstruction(0xF1, "SBC", AddressingMode.INDIRECT_Y, 5, 1);

		addInstruction(0x38, "SEC", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0xF8, "SED", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x78, "SEI", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x85, "STA", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x95, "STA", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0x8D, "STA", AddressingMode.ABSOLUTE, 4, 0);
		addInstruction(0x9D, "STA", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0x99, "STA", AddressingMode.ABSOLUTE_Y, 4, 0);
		addInstruction(0x81, "STA", AddressingMode.INDIRECT_X, 6, 0);
		addInstruction(0x91, "STA", AddressingMode.INDIRECT_Y, 5, 0);

		addInstruction(0x86, "STX", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x96, "STX", AddressingMode.ZERO_PAGE_Y, 4, 0);
		addInstruction(0x8E, "STX", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0x84, "STY", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x94, "STY", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0x8C, "STY", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0xAA, "TAX", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0xA8, "TAY", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0xBA, "TSX", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x8A, "TXA", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x9A, "TXS", AddressingMode.IMPLIED, 2, 0);

		addInstruction(0x98, "TYA", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0x07, "SLA", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x17, "SLA", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x03, "SLA", AddressingMode.INDIRECT_X, 8, 0);
		addInstruction(0x13, "SLA", AddressingMode.INDIRECT_Y, 8, 0);
		addInstruction(0x0F, "SLA", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x1F, "SLA", AddressingMode.ABSOLUTE_X, 7, 0);
		addInstruction(0x1B, "SLA", AddressingMode.ABSOLUTE_Y, 7, 0);

		addInstruction(0x27, "RLA", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x37, "RLA", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x23, "RLA", AddressingMode.INDIRECT_X, 8, 0);
		addInstruction(0x33, "RLA", AddressingMode.INDIRECT_Y, 8, 0);
		addInstruction(0x2F, "RLA", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x3F, "RLA", AddressingMode.ABSOLUTE_X, 7, 0);
		addInstruction(0x3B, "RLA", AddressingMode.ABSOLUTE_Y, 7, 0);

		addInstruction(0xE7, "ISC", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0xF7, "ISC", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0xE3, "ISC", AddressingMode.INDIRECT_X, 8, 0);
		addInstruction(0xF3, "ISC", AddressingMode.INDIRECT_Y, 8, 0);
		addInstruction(0xEF, "ISC", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0xFF, "ISC", AddressingMode.ABSOLUTE_X, 7, 0);
		addInstruction(0xFB, "ISC", AddressingMode.ABSOLUTE_Y, 7, 0);

		addInstruction(0x47, "SRE", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x57, "SRE", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x43, "SRE", AddressingMode.INDIRECT_X, 8, 0);
		addInstruction(0x53, "SRE", AddressingMode.INDIRECT_Y, 8, 0);
		addInstruction(0x4F, "SRE", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x5F, "SRE", AddressingMode.ABSOLUTE_X, 7, 0);
		addInstruction(0x5B, "SRE", AddressingMode.ABSOLUTE_Y, 7, 0);

		addInstruction(0x87, "SAX", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x97, "SAX", AddressingMode.ZERO_PAGE_Y, 4, 0);
		addInstruction(0x83, "SAX", AddressingMode.INDIRECT_X, 6, 0);
		addInstruction(0x8F, "SAX", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0x67, "RRA", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0x77, "RRA", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0x63, "RRA", AddressingMode.INDIRECT_X, 8, 0);
		addInstruction(0x73, "RRA", AddressingMode.INDIRECT_Y, 8, 0);
		addInstruction(0x6F, "RRA", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0x7F, "RRA", AddressingMode.ABSOLUTE_X, 7, 0);
		addInstruction(0x7B, "RRA", AddressingMode.ABSOLUTE_Y, 7, 0);

		addInstruction(0xA7, "LAX", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0xB7, "LAX", AddressingMode.ZERO_PAGE_Y, 4, 0);
		addInstruction(0xA3, "LAX", AddressingMode.INDIRECT_X, 6, 0);
		addInstruction(0xB3, "LAX", AddressingMode.INDIRECT_Y, 5, 0);
		addInstruction(0xAF, "LAX", AddressingMode.ABSOLUTE, 4, 0);
		addInstruction(0xBF, "LAX", AddressingMode.ABSOLUTE_Y, 4, 0);
		addInstruction(0xAB, "LAX", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0xC7, "DCP", AddressingMode.ZERO_PAGE, 5, 0);
		addInstruction(0xD7, "DCP", AddressingMode.ZERO_PAGE_X, 6, 0);
		addInstruction(0xC3, "DCP", AddressingMode.INDIRECT_X, 8, 0);
		addInstruction(0xD3, "DCP", AddressingMode.INDIRECT_Y, 8, 0);
		addInstruction(0xCF, "DCP", AddressingMode.ABSOLUTE, 6, 0);
		addInstruction(0xDF, "DCP", AddressingMode.ABSOLUTE_X, 7, 0);
		addInstruction(0xDB, "DCP", AddressingMode.ABSOLUTE_Y, 7, 0);

		addInstruction(0x0B, "ANC", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0x2B, "ANC", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0x4B, "ALR", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0x6B, "ARR", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0xCB, "SBX", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0xEB, "SBC", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0xBB, "LAS", AddressingMode.ABSOLUTE_Y, 3, 0);

		addInstruction(0x1A, "NOP", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0x3A, "NOP", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0x5A, "NOP", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0x7A, "NOP", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0xDA, "NOP", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0xFA, "NOP", AddressingMode.IMPLIED, 2, 0);
		addInstruction(0x80, "NOP", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0x82, "NOP", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0xC2, "NOP", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0xE2, "NOP", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0x89, "NOP", AddressingMode.IMMEDIATE, 2, 0);
		addInstruction(0x04, "NOP", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x44, "NOP", AddressingMode.ZERO_PAGE, 3, 0);
		addInstruction(0x64, "NOP", AddressingMode.ZERO_PAGE, 3, 0);

		addInstruction(0x14, "NOP", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0x34, "NOP", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0x54, "NOP", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0x74, "NOP", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0xD4, "NOP", AddressingMode.ZERO_PAGE_X, 4, 0);
		addInstruction(0xF4, "NOP", AddressingMode.ZERO_PAGE_X, 4, 0);

		addInstruction(0x0C, "NOP", AddressingMode.ABSOLUTE, 4, 0);

		addInstruction(0x1C, "NOP", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0x3C, "NOP", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0x5C, "NOP", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0x7C, "NOP", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0xDC, "NOP", AddressingMode.ABSOLUTE_X, 4, 0);
		addInstruction(0xFC, "NOP", AddressingMode.ABSOLUTE_X, 4, 0);

		addInstruction(0x02, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x12, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x22, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x32, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x42, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x52, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x62, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x72, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0x92, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0xB2, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0xD2, "JAM", AddressingMode.IMPLIED, 1, 0);
		addInstruction(0xF2, "JAM", AddressingMode.IMPLIED, 1, 0);

		addInstruction(0x93, "SHA", AddressingMode.ZERO_PAGE_Y, 1, 0);
		addInstruction(0x9F, "SHA", AddressingMode.ABSOLUTE_Y, 1, 0);

		addInstruction(0x9E, "SHX", AddressingMode.ABSOLUTE_Y, 1, 0);

		addInstruction(0x8B, "XAA", AddressingMode.IMMEDIATE, 2, 0);

		addInstruction(0x9C, "SHY", AddressingMode.ABSOLUTE_Y, 1, 0);

		addInstruction(0x9B, "TAS", AddressingMode.ABSOLUTE_Y, 1, 0);
	}

	static void addInstruction(int code, String name, AddressingMode mode, int cycles, int crosspage) {
		Opcode opcode = new Opcode(name, mode, code, cycles, crosspage);
		opcodeTable.put(code, opcode);
	}

	public Disassembler(HashMap<Integer, Label> labels) {
		this.labels = labels;
	}

	public synchronized void disassemble(byte[] code) {
		disassembly = new ArrayList<Disassembly>();
		disassemblyLine = new HashMap<>();
		int address = 0;
		int line = 0;
		do {
			if (address == code.length || address >= 65_535) {
				break;
			}
			int opCode = Byte.toUnsignedInt(code[address]);
			Opcode op = opcodeTable.get(opCode);

			if (op == null) {
				throw new RuntimeException("Unknown opcode");
			}

			// get the length of the operation
			int instructionLength = op.mode.getDataSize() + 1;

			StringBuilder sb = new StringBuilder();

			sb.append(String.format("%02X", op.code));
			sb.append(" ");

			if (instructionLength > 1) {
				sb.append(String.format("%02X ", code[address + 1]));
			} else {
				sb.append("   ");
			}

			if (instructionLength > 2) {
				sb.append(String.format("%02X ", code[address + 2]));
			} else {
				sb.append("   ");
			}

			sb.append("   ");

			sb.append(op.mnemonic.toLowerCase());

			switch (op.mode) {
			case IMMEDIATE:
				sb.append(" #$" + String.format("%02X", code[address + 1]));
				break;
			case ZERO_PAGE:
				sb.append(" $" + String.format("%02X", code[address + 1]));
				break;
			case ZERO_PAGE_X:
				sb.append(" $" + String.format("%02X", code[address + 1]) + ",X");
				break;
			case ABSOLUTE:
			case ABSOLUTE_X:
			case ABSOLUTE_Y:
				int pointer_address = Short
						.toUnsignedInt((short) ((code[address + 2] << 8) | (code[address + 1] & 0xFF)));
				if (labels.containsKey(pointer_address)) {
					sb.append(" ");
					sb.append(labels.get(pointer_address).name);
				} else {
					sb.append(" $" + String.format("%04X", pointer_address));
				}
				if (op.mode == AddressingMode.ABSOLUTE_X)
					sb.append(",X");
				if (op.mode == AddressingMode.ABSOLUTE_Y)
					sb.append(",Y");
				break;
			case INDIRECT:
				sb.append(" ($" + String.format("%02X", code[address + 1]) + "),X");
				break;
			case INDIRECT_Y:
				sb.append(" ($" + String.format("%02X", code[address + 1]) + "),Y");
				break;
			case RELATIVE:
				int pointer_relative = (address + code[address + 1]) + instructionLength;
				if (labels.containsKey(pointer_relative)) {
					sb.append(" ");
					sb.append(labels.get(pointer_relative).name);
				} else {
					sb.append(" $" + String.format("%02X", code[address + 1]) + "("
							+ String.format("%04X", pointer_relative) + ")");
				}
				break;
			default:
				break;
			}
			Disassembly dis = new Disassembly(line, address, sb.toString(), instructionLength);
			if (labels.containsKey(address)) {
				dis.setLabel(labels.get(address).name);
			}
			disassembly.add(dis);
			disassemblyLine.put(line, dis);
			line = line + 1;
			address = address + instructionLength;
		} while (true);
	}

	/**
	 * Returns a list of disassembled code where each key is the address.
	 *
	 * @return
	 */
	public List<Disassembly> getDisassembly() {
		return disassembly;
	}

	public Disassembly getLine(int line) {
		return disassemblyLine.get(line);
	}
}
