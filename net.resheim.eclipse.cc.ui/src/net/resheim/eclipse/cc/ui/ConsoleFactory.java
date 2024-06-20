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
package net.resheim.eclipse.cc.ui;

import org.eclipse.ui.console.ConsolePlugin;
import org.eclipse.ui.console.IConsole;
import org.eclipse.ui.console.IConsoleFactory;
import org.eclipse.ui.console.IConsoleManager;
import org.eclipse.ui.console.MessageConsole;

/**
 * Factory for producing an instance of the "Commodore Commander" console view.
 * This is used both for outputting log messages from the (KickAssembler)
 * compiler.
 */
public class ConsoleFactory implements IConsoleFactory {

	public static final String CONSOLE_NAME = "Commodore Commander";

	public static MessageConsole findConsole() {
		ConsolePlugin plugin = ConsolePlugin.getDefault();
		IConsoleManager conMan = plugin.getConsoleManager();
		IConsole[] existing = conMan.getConsoles();
		for (int i = 0; i < existing.length; i++)
			if (CONSOLE_NAME.equals(existing[i].getName()))
				return (MessageConsole) existing[i];
		// no console found, so create a new one
		MessageConsole myConsole = new MessageConsole(CONSOLE_NAME, null);
		conMan.addConsoles(new IConsole[] { myConsole });
		return myConsole;
	}

	@Override
	public void openConsole() {
		findConsole();
	}

}
