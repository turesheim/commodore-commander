package net.resheim.eclipse.cc.builder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IResource;

public class AssemblyFile {

	private IResource resource;
	private List<AssemblyFile> parents = new ArrayList<>();
	private HashMap<IResource, AssemblyFile> inclusions = new HashMap<>();

	public AssemblyFile(IResource resource, AssemblyFile parent) {
		this.resource = resource;
	}

	public void addInclusion(AssemblyFile file) {
		assert (file.getResource() != null);
		inclusions.put(file.getResource(), file);
	}

	public HashMap<IResource, AssemblyFile> getInclusions() {
		return inclusions;
	}

	public List<AssemblyFile> getParents() {
		return parents;
	}

	public void addParent(AssemblyFile parent) {
		this.parents.add(parent);
	}

	public IResource getResource() {
		return resource;
	}

	public void printTree(String indent) {
		if (resource != null)
			System.out.println(indent + resource.getName());
		for (Map.Entry<IResource, AssemblyFile> entry : inclusions.entrySet()) {
			entry.getValue().printTree(indent + "  ");
		}
	}

	public String toString() {
		return resource.toString();
	}

	public boolean containsResource(IResource targetResource) {
		if (resource != null) {
			if (this.resource.equals(targetResource)) {
				return true;
			}
			for (AssemblyFile child : inclusions.values()) {
				if (child.containsResource(targetResource)) {
					return true;
				}
			}
		}
		return false;
	}
}
