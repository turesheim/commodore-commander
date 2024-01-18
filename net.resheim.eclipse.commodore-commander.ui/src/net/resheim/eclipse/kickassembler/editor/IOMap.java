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

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.JAXBException;
import jakarta.xml.bind.Unmarshaller;
import jakarta.xml.bind.annotation.XmlAttribute;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;
import jakarta.xml.bind.annotation.XmlValue;

@XmlRootElement(name = "iomap")
public class IOMap {

	private List<Entry> entries;

	private Map<String, Entry> entriesMap = new HashMap<String, IOMap.Entry>();

	public IOMap() {
	}

	public void load() throws JAXBException {
		ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
		InputStream xmlFileStream = classLoader.getResourceAsStream("reference/c64/c64io.xml");

		JAXBContext jaxbContext = JAXBContext.newInstance(IOMap.class);
		Unmarshaller unmarshaller = jaxbContext.createUnmarshaller();

		IOMap iomap = (IOMap) unmarshaller.unmarshal(xmlFileStream);

		for (Entry entry : iomap.getEntries()) {
			entriesMap.put(entry.getAddress(), entry);
		}
	}

	public Map<String, Entry> getEntriesMap() {
		return entriesMap;
	}

	@XmlElement(name = "entry")
	public List<Entry> getEntries() {
		return entries;
	}

	public void setEntries(List<Entry> entries) {
		this.entries = entries;
	}

	public static class Entry {
		private String address;
		private String id;
		private String name;
		private String description;

		@XmlAttribute
		public String getAddress() {
			return address;
		}

		public void setAddress(String address) {
			this.address = address;
		}

		@XmlAttribute
		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		@XmlValue
		public String getDescription() {
			return description;
		}

		public void setDescription(String description) {
			this.description = description;
		}

		@XmlAttribute
		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}
	}

}
