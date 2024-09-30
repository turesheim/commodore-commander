package net.resheim.eclipse.cc.builder;

import java.util.HashMap;

import org.eclipse.core.resources.IFile;

import net.resheim.eclipse.cc.builder.model.Assembly;

public class Assemblies {

	private HashMap<IFile, Assembly> assembly;

	private static Assemblies model = null;

	private Assemblies() {
		assembly = new HashMap<>();
	}

	public static Assemblies getDefault() {
		if (model == null) {
			model = new Assemblies();
		}
		return model;
	}

	public Assembly getAssembly(IFile file) {
		return assembly.get(file);
	}

	public void setAssembly(IFile file, Assembly program) {
		assembly.put(file, program);
	}
}
