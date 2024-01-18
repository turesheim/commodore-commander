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

import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

import jakarta.xml.bind.JAXBException;

public class C64EditorPlugin extends AbstractUIPlugin {

	private IOMap ioMap;

	private Mnemonics mnemonics;

	private static C64EditorPlugin plugin;

	public C64EditorPlugin() {
		// TODO Auto-generated constructor stub
	}

	@Override
	public void start(BundleContext context) throws Exception {
		super.start(context);
		ioMap = new IOMap();
		mnemonics = new Mnemonics();
		try {
			ioMap.load();
			mnemonics.load();
		} catch (JAXBException e) {
			e.printStackTrace();
		}
		plugin = this;

	}

	public IOMap getIOMap() {
		return ioMap;
	}

	public static C64EditorPlugin getPlugin() {
		return plugin;
	}

	public Mnemonics getMnemonics() {
		return mnemonics;
	}

}
