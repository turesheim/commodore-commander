package net.resheim.eclipse.cc.vice.debug;

import org.eclipse.ui.console.MessageConsole;
import org.eclipse.ui.console.MessageConsoleStream;

import net.resheim.eclipse.cc.ui.ConsoleFactory;

public class MonitorLogger {

	public static final int USER = 0;
	public static final int INPUT = 1;
	public static final int OUTPUT = 2;

	private static final MessageConsole console = ConsoleFactory.findConsole();
	private static final MessageConsoleStream out = console.newMessageStream();

	public static final void error(int source, String message) {
		StringBuilder sb = new StringBuilder();
			sb.append(ANSIColors.RED_BACKGROUND);
			sb.append(ANSIColors.WHITE);
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
			sb.append(ANSIColors.RESET);
			out.println(sb.toString());
		}

		public static final void info(int source, String message) {
			StringBuilder sb = new StringBuilder();
			switch (source) {
			case USER:
				sb.append(ANSIColors.BLUE_BACKGROUND);
				sb.append(ANSIColors.WHITE);
				sb.append("=== ");
				break;
			case INPUT:
				sb.append(ANSIColors.CYAN_BACKGROUND);
				sb.append(ANSIColors.BLACK);
				sb.append("<<< ");
				break;
			case OUTPUT:
				sb.append(ANSIColors.YELLOW_BACKGROUND);
				sb.append(ANSIColors.BLACK);
				sb.append(">>> ");
				break;
			}
			sb.append(message);
			while (sb.length() < 79) {
				sb.append(" ");
			}
			sb.append(ANSIColors.RESET);
			out.println(sb.toString());
		}

}
