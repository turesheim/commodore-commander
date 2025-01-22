package net.resheim.eclipse.cc.builder;

import java.util.HashMap;
import java.util.List;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.runtime.IPath;

import net.resheim.eclipse.cc.builder.model.Assembly;
import net.resheim.eclipse.cc.builder.model.SourceFile;

public class Assemblies {

	private HashMap<IFile, Assembly> assemblies;

	private static Assemblies model = null;

	private Assemblies() {
		assemblies = new HashMap<>();
	}

	public synchronized static Assemblies getDefault() {
		if (model == null) {
			model = new Assemblies();
		}
		return model;
	}

	/**
	 * If supplied with the assembly root file, this will be returned, otherwise the
	 * first assembly where the file is used will be returned
	 *
	 * @param file a assembly file
	 *
	 * @return an assembly or <code>null</code>
	 */
	public synchronized Assembly getAssembly(IFile file) {
		if (assemblies.containsKey(file)) {
			return assemblies.get(file);
		}
		for (Assembly a : assemblies.values()) {
			List<SourceFile> sourceFiles = a.getSources().getSourceFiles();
			for (SourceFile sourceFile : sourceFiles) {
				IPath sfile = file.getLocation();
				IPath ifile = sourceFile.getPath();
				if (sfile.equals(ifile)) {
					return a;
				}
			}
		}
		return null;
	}

	public synchronized void setAssembly(IFile file, Assembly program) {
		assemblies.put(file, program);
	}
}
