package net.resheim.eclipse.cc.editor;

import java.lang.ProcessBuilder.Redirect;
import java.util.ArrayList;
import java.util.List;

import org.eclipse.core.runtime.IPath;
import org.eclipse.ui.IEditorLauncher;

public class VICELauncher implements IEditorLauncher {

	private IPath findViceConfig(IPath file) {
		IPath folder = file.removeLastSegments(1);
		IPath config = folder.append("vice.config");
		if (config.toFile().exists()) {
			return config;
		}
		if (folder.isRoot()) {
			return null;
		} else
			return findViceConfig(folder);

	}

	@Override
	public void open(IPath file) {
		try {
			List<String> args = new ArrayList<String>();
			// The file can be anywhere in the file system so we cannot rely
			// on IWorkspace and related types. So we're assuming that there is
			// a viceconfig somewhere in the file's folder or in one of the
			// parent folders.
			IPath viceconfig = findViceConfig(file);
			IPath vicelog = file.removeLastSegments(1).append("vice.log");
			// XXX: Add preferences for executable location
			args.add("/opt/homebrew/bin/x64sc");
			if (viceconfig != null) {
				args.add("-config");
				args.add(viceconfig.toOSString());
			}
			args.add(file.toOSString()); // $NON-NLS-1$
			StringBuilder sb = new StringBuilder();
			for (String string : args) {
				sb.append(string);
				sb.append(' ');
			}
			// Execute the command line
			ProcessBuilder pb = new ProcessBuilder(args.toArray(new String[args.size()]))
					.redirectOutput(Redirect.to(vicelog.toFile())).redirectError(Redirect.to(vicelog.toFile()));
			pb.start();

		} catch (Exception e) {
			e.printStackTrace();
		}
	}

}
