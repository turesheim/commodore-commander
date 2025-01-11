/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *
 *   Torkild Ulvøy Resheim <torkildr@gmail.com> - initial API and implementation
 */
package net.resheim.eclipse.cc.vice.debug;

import org.eclipse.ui.console.MessageConsoleStream;

public class MonitorLogger {

	public static final int USER = 0;
	public static final int INPUT = 1;
	public static final int OUTPUT = 2;

	private static final boolean ansi = true;

	public static final void error(MessageConsoleStream out, int source, String message) {
		StringBuilder sb = new StringBuilder();
		if (ansi) {
			sb.append(ANSIColors.RED_BACKGROUND);
			sb.append(ANSIColors.WHITE);
		}
			switch (source) {
			case USER:
				sb.append("=== ");
				break;
			case INPUT:
				sb.append("<<< ");
				break;
			case OUTPUT:
				sb.append(">>> ");
				break;
			}
			sb.append(message);
			while (sb.length() < 79) {
				sb.append(" ");
			}
			if (ansi) {
				sb.append(ANSIColors.RESET);
			}
			out.println(sb.toString());
		}

		public static final void info(MessageConsoleStream out, int source, String message) {
			StringBuilder sb = new StringBuilder();
			switch (source) {
			case USER:
				if (ansi) {
					sb.append(ANSIColors.BLUE_BACKGROUND);
					sb.append(ANSIColors.WHITE);
				}
				sb.append("=== ");
				break;
			case INPUT:
				if (ansi) {
					sb.append(ANSIColors.CYAN_BACKGROUND);
					sb.append(ANSIColors.BLACK);
				}
				sb.append("<<< ");
				break;
			case OUTPUT:
				if (ansi) {
					sb.append(ANSIColors.YELLOW_BACKGROUND);
					sb.append(ANSIColors.BLACK);
				}
				sb.append(">>> ");
				break;
			}
			sb.append(message);
			while (sb.length() < 79) {
				sb.append(" ");
			}
			if (ansi) {
				sb.append(ANSIColors.RESET);
			}
			out.println(sb.toString());
		}

}
