/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 * Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.kickassembler.editor;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.JAXBException;
import jakarta.xml.bind.Unmarshaller;
import jakarta.xml.bind.ValidationEvent;
import jakarta.xml.bind.ValidationEventHandler;
import jakarta.xml.bind.annotation.XmlAttribute;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;
import jakarta.xml.bind.annotation.XmlValue;

@XmlRootElement(name = "mnemonics")
public class Mnemonics {

	private Map<String, Mnemonic> mnemonicMap = new HashMap<String, Mnemonic>();

	/**
	 * Used to group mnemonics when they have the same description.
	 */
	public static class Group {

		private String description;
		private List<Mnemonic> mnemonics;
		private String name;

		@XmlElement(name = "description")
		public String getDescription() {
			return description;
		}

		@XmlElement(name = "mnemonic")
		public List<Mnemonic> getMnemonics() {
			return this.mnemonics;
		}

		@XmlAttribute
		public String getName() {
			return name;
		}

		public void setDescription(String description) {
			this.description = description;
		}

		public void setMnemonics(List<Mnemonic> mnemonics) {
			this.mnemonics = mnemonics;
		}

		public void setName(String name) {
			this.name = name;
		}

	}

	/**
	 * A <i>mnemonic</i> with an identifier (the actual mnemonic), a descriptive
	 * name, a list of flags affected and a description.
	 */
	public static class Mnemonic {
		private String description;
		private String flags;
		private String id;
		private String name;

		@XmlValue
		public String getDescription() {
			return description;
		}

		@XmlAttribute
		public String getFlags() {
			return flags;
		}

		@XmlAttribute
		public String getId() {
			return id;
		}

		@XmlAttribute
		public String getName() {
			return name;
		}

		public void setDescription(String description) {
			this.description = description;
		}

		public void setFlags(String flags) {
			this.flags = flags;
		}

		public void setId(String id) {
			this.id = id;
		}

		public void setName(String name) {
			this.name = name;
		}

	}

	private List<Group> groups;

	private List<Mnemonic> mnemonics;

	@XmlElement(name = "group")
	public List<Group> getGroups() {
		return groups;
	}

	@XmlElement(name = "mnemonic")
	public List<Mnemonic> getMnemonics() {
		return mnemonics;
	}

	public void load() throws JAXBException, IOException {
		ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
		InputStream xmlFileStream = classLoader.getResourceAsStream("reference/6502.xml");
		JAXBContext jaxbContext = JAXBContext.newInstance(Mnemonics.class);
		Unmarshaller unmarshaller = jaxbContext.createUnmarshaller();
		unmarshaller.setEventHandler(new ValidationEventHandler() {
			@Override
			public boolean handleEvent(ValidationEvent arg0) {
				System.out.println(arg0);
				return false;
			}
		});

		Mnemonics mnemonics = (Mnemonics) unmarshaller.unmarshal(xmlFileStream);

		for (Mnemonic mnemonic : mnemonics.getMnemonics()) {
			mnemonicMap.put(mnemonic.getId(), mnemonic);
		}

		// Deal with the groups that have identical descriptions
		for (Group group : mnemonics.getGroups()) {
			for (Mnemonic mnemonic : group.getMnemonics()) {
				mnemonic.setDescription(group.getDescription());
				mnemonicMap.put(mnemonic.getId(), mnemonic);
			}
		}
	}


	public void setGroups(List<Group> mnemonics) {
		this.groups = mnemonics;
	}

	public void setMnemonics(List<Mnemonic> mnemonics) {
		this.mnemonics = mnemonics;
	}

	public Map<String, Mnemonic> getMnemonicMap() {
		return mnemonicMap;
	}

}
