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
package net.resheim.eclipse.cc.builder;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IResourceDelta;
import org.eclipse.core.resources.IResourceDeltaVisitor;
import org.eclipse.core.resources.IResourceVisitor;
import org.eclipse.core.resources.IncrementalProjectBuilder;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.ui.console.MessageConsole;
import org.eclipse.ui.console.MessageConsoleStream;

import kickass.common.diagnostics.DiagnosticType;
import kickass.common.diagnostics.IDiagnostic;
import net.resheim.eclipse.cc.kickassembler.KickAssemblerWrapper;
import net.resheim.eclipse.cc.ui.ConsoleFactory;

public class KickAssemblerBuilder extends IncrementalProjectBuilder {

	private class ResourceDeltaVisitor implements IResourceDeltaVisitor {

		List<AssemblyFile> roots = null;

		public ResourceDeltaVisitor(List<AssemblyFile> roots) {
			this.roots = roots;
		}

		@Override
		public boolean visit(IResourceDelta delta) throws CoreException {
			IResource resource = delta.getResource();
			if (delta.getKind() == IResourceDelta.REMOVED) {
				// just build all roots, we currently cannot determine the tree
				// of those files that have been removed
				for (AssemblyFile assemblyFile : roots) {
					buildAssembly(assemblyFile);
				}
			} else {
				for (AssemblyFile assemblyFile : roots) {
					if (assemblyFile.containsResource(resource)) {
						buildAssembly(assemblyFile);
					}
				}
			}
			// return true to continue visiting children.
			return true;
		}
	}

	private class TreeBuildingResourceVisitor implements IResourceVisitor {

		public boolean visit(IResource resource) {
			if (resource instanceof IFile && resource.getName().endsWith(".asm")) {
				AssemblyFile file = new AssemblyFile(resource, null);
				KickAssemblerProjectParser parser = new KickAssemblerProjectParser(file);
				afm.addFile(file);
				try {
					parser.parseFile(resource);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			return true;
		}

	}

	public static final String BUILDER_ID = "net.resheim.eclipse.cc.ui.kickassemblerBuilder";

	private static final String MARKER_TYPE = "net.resheim.eclipse.cc.ui.kickAssemblerProblem";

	private void addMarker(IFile file, String message, int lineNumber, int severity) {
		try {
			IMarker marker = file.createMarker(MARKER_TYPE);
			marker.setAttribute(IMarker.MESSAGE, message);
			marker.setAttribute(IMarker.SEVERITY, severity);
			if (lineNumber == -1) {
				lineNumber = 1;
			}
			marker.setAttribute(IMarker.LINE_NUMBER, lineNumber);
		} catch (CoreException e) {
		}
	}

	public class AssemblyFileManager {

		// Contains all assembly files found
		private List<AssemblyFile> allFiles;

		public AssemblyFileManager() {
			this.allFiles = new ArrayList<>();
		}

		public void clear() {
			allFiles.clear();
		}

		public void addFile(AssemblyFile file) {
			allFiles.add(file);
		}

		private void buildTree(AssemblyFile file, List<AssemblyFile> files) {
			HashMap<IResource, AssemblyFile> inclusions = file.getInclusions();
			for (AssemblyFile child : inclusions.values()) {
				buildTree(child, files);
				// determine whether or not the child is contained in the all
				// files list, if so we will remove it since it has a parent
				for (AssemblyFile base : allFiles) {
					if (base.getResource() != null && child.getResource() != null) {
						if (child.getResource().equals(base.getResource())) {
							files.remove(base);
						}
					}
				}
			}
		}

		public List<AssemblyFile> consolidateTrees() {
			List<AssemblyFile> allFilesCopy = new ArrayList<>(allFiles);
			for (AssemblyFile assemblyFile : allFiles) {
				buildTree(assemblyFile, allFilesCopy);
			}
			return allFilesCopy;
		}

	}

	AssemblyFileManager afm = new AssemblyFileManager();

	@Override
	protected IProject[] build(int kind, Map<String, String> args, IProgressMonitor monitor) throws CoreException {
		// Parse all assembly files and determine the import tree structure.
		afm.clear();
		getProject().accept(new TreeBuildingResourceVisitor());
		List<AssemblyFile> roots = afm.consolidateTrees();
		// for debugging only
		roots.forEach(f -> {
			System.out.println("rootfile = " + f.getResource());
			f.printTree("  ");
		});

		if (kind == FULL_BUILD) {
			fullBuild(monitor, roots);
		} else {
			IResourceDelta delta = getDelta(getProject());
			if (delta == null) {
				fullBuild(monitor, roots);
			} else {
				incrementalBuild(delta, monitor, roots);
			}
		}
		return null;
	}

	protected void clean(IProgressMonitor monitor) throws CoreException {
	}

	void buildAssembly(AssemblyFile assemblyFile) {
		clearMarkers(assemblyFile);
		IFile file = (IFile) assemblyFile.getResource();
		KickAssemblerWrapper wrapper = new KickAssemblerWrapper();
		MessageConsole console = ConsoleFactory.findConsole();
		MessageConsoleStream out = console.newMessageStream();
		wrapper.execute(new String[] { "-libdir", file.getProject().getFolder("library").getLocation().toOSString(),
				file.getLocation().toOSString(), "-odir", "out", "-showmem", "-vicesymbols", "-debugdump" }, out);

		for (IDiagnostic iDiagnostic : wrapper.getState().diagnosticMgr.getErrors()) {
			addDiagnosticMessage(iDiagnostic);
		}
		for (IDiagnostic iDiagnostic : wrapper.getState().diagnosticMgr.getWarnings()) {
			addDiagnosticMessage(iDiagnostic);
		}
		// Make sure any changes in the file systems are reflected in the
		// Eclipse viewers.
		try {
			file.getProject().refreshLocal(IResource.DEPTH_INFINITE, new NullProgressMonitor());
		} catch (CoreException e) {
			e.printStackTrace();
		}
	}

	private void addDiagnosticMessage(IDiagnostic iDiagnostic) {
		String fileName = iDiagnostic.getRange().getFileName();
		String message = iDiagnostic.getMessage();
		int startLineNo = iDiagnostic.getRange().getStartLineNo();
		try {
			// This is silly, cannot remember a better way if getting the correct
			// file reference
			IFile file = ResourcesPlugin.getWorkspace().getRoot()
					.findFilesForLocationURI(new URI("file:///" + fileName))[0];
			addMarker(file, message, startLineNo,
					iDiagnostic.getType().equals(DiagnosticType.error) ? IMarker.SEVERITY_ERROR
							: IMarker.SEVERITY_WARNING);
		} catch (URISyntaxException e) {
			e.printStackTrace();
		}
	}

	private void clearMarkers(AssemblyFile file) {
		try {
			IResource r = file.getResource();
			if (r != null) {
				r.deleteMarkers(MARKER_TYPE, false, IResource.DEPTH_ZERO);
			}
			for (AssemblyFile child : file.getInclusions().values()) {
				clearMarkers(child);
			}
		} catch (CoreException ce) {
		}
	}

	private void fullBuild(final IProgressMonitor monitor, List<AssemblyFile> roots) throws CoreException {
		// there is only a need to build the root files
		for (AssemblyFile assemblyFile : roots) {
			buildAssembly(assemblyFile);
		}
	}

	private void incrementalBuild(IResourceDelta delta, IProgressMonitor monitor, List<AssemblyFile> roots)
			throws CoreException {
		delta.accept(new ResourceDeltaVisitor(roots));
	}

}
