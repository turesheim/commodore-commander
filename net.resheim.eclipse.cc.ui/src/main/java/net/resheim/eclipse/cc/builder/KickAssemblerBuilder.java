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
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IResourceDelta;
import org.eclipse.core.resources.IResourceDeltaVisitor;
import org.eclipse.core.resources.IResourceVisitor;
import org.eclipse.core.resources.IncrementalProjectBuilder;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.core.runtime.Status;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.ui.console.MessageConsole;
import org.eclipse.ui.console.MessageConsoleStream;

import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.JAXBException;
import jakarta.xml.bind.Unmarshaller;
import kickass.common.diagnostics.DiagnosticType;
import kickass.common.diagnostics.IDiagnostic;
import net.resheim.eclipse.cc.builder.model.Breakpoint;
import net.resheim.eclipse.cc.builder.model.LineMapping;
import net.resheim.eclipse.cc.builder.model.Program;
import net.resheim.eclipse.cc.builder.model.SourceFile;
import net.resheim.eclipse.cc.kickassembler.KickAssemblerWrapper;
import net.resheim.eclipse.cc.ui.ConsoleFactory;
import net.resheim.eclipse.cc.vice.debug.model.Checkpoint;
import net.resheim.eclipse.cc.vice.debug.model.Checkpoint.Source;
import net.resheim.eclipse.cc.vice.debug.model.VICEDebugElement;

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
					assemble(assemblyFile);
				}
			} else {
				for (AssemblyFile assemblyFile : roots) {
					if (assemblyFile.containsResource(resource)) {
						assemble(assemblyFile);
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

	/**
	 * Detmines the
	 */
	public class AssemblyFileManager {

		// a list of all assembly files found
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

		/**
		 * Build a tree structure of all the assembly files found. The file not included
		 * in any other files, will be the root.
		 *
		 * @return a tree structure of all assembly files in the program
		 */
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

	private void assemble(AssemblyFile assemblyFile) throws CoreException {
		clearMarkers(assemblyFile);
		IFile file = (IFile) assemblyFile.getResource();
		// use our KickAssembler wrapper
		KickAssemblerWrapper wrapper = new KickAssemblerWrapper();
		MessageConsole console = ConsoleFactory.findConsole();
		MessageConsoleStream out = console.newMessageStream();
		// which still needs program arguments and do the build
		wrapper.execute(new String[] { "-libdir", file.getProject().getFolder("library").getLocation().toOSString(),
				file.getLocation().toOSString(), "-odir", "out", "-showmem", "-vicesymbols", "-debugdump" }, out);

		for (IDiagnostic iDiagnostic : wrapper.getState().diagnosticMgr.getErrors()) {
			addDiagnosticMessage(iDiagnostic);
		}
		for (IDiagnostic iDiagnostic : wrapper.getState().diagnosticMgr.getWarnings()) {
			addDiagnosticMessage(iDiagnostic);
		}
		// add any breakpoints found
		addCompiledCheckpoints(file);

		// Make sure any changes in the file systems are reflected in the
		// Eclipse viewers.
		file.getProject().refreshLocal(IResource.DEPTH_INFINITE, new NullProgressMonitor());
	}

	/**
	 * Parses the debug file that is resulting from compiling the root assembly file
	 * and generates {@link Checkpoint}s corresponding to the use of
	 * <code>.break</code> and <code>.watch</code> commands. Any existing
	 * checkpoints also origination from using these commands are first removed.
	 *
	 * @param file the root assembly file
	 * @throws CoreException
	 */
	private void addCompiledCheckpoints(IFile file) throws CoreException {
		try {
			// determine the output folder
			IFolder output = (IFolder) file.getParent().findMember("out");
			// find the debug file created by KickAssembler
			IPath newFilePath = file.getFullPath().removeFileExtension().addFileExtension("dbg");
			IResource debugFile = output.findMember(newFilePath.lastSegment());
			// parse the debug file
			JAXBContext context = JAXBContext.newInstance(Program.class);
			Unmarshaller unmarshaller = context.createUnmarshaller();
			Program debug = (Program) unmarshaller.unmarshal(debugFile.getRawLocation().toFile());
			clearOldCompiledCheckpoints(debug);
			// create breakpoints and watchpoints
			// TODO: Also add watchpoints
			List<Breakpoint> breakpoints = debug.getBreakpoints();
			for (Breakpoint breakpoint : breakpoints) {
				int address = breakpoint.getAddress();
				LineMapping lineMapping = debug.getLineMapping(address);
				int fileIndex = lineMapping.getFileIndex();
				IPath checkpointFile = getFile(debug, fileIndex);
				IFile fileForLocation = ResourcesPlugin.getWorkspace().getRoot().getFileForLocation(checkpointFile);
				Checkpoint lineBreakpoint = new Checkpoint(fileForLocation, lineMapping.getStartLine(), Source.CODE);
				DebugPlugin.getDefault().getBreakpointManager().addBreakpoint(lineBreakpoint);
			}
		} catch (JAXBException e) {
			throw new CoreException(Status.error("Could not parse debug file", e));
		}
	}

	private void clearOldCompiledCheckpoints(Program debug) throws CoreException {
		List<Breakpoint> breakpoints = debug.getBreakpoints();
		for (Breakpoint breakpoint : breakpoints) {
			int address = breakpoint.getAddress();
			LineMapping lineMapping = debug.getLineMapping(address);
			int fileIndex = lineMapping.getFileIndex();
			IPath checkpointFile = getFile(debug, fileIndex);
			IFile fileForLocation = ResourcesPlugin.getWorkspace().getRoot().getFileForLocation(checkpointFile);
			IBreakpoint[] existing = DebugPlugin.getDefault().getBreakpointManager()
					.getBreakpoints(VICEDebugElement.DEBUG_MODEL_ID);
			for (int i = 0; i < existing.length; i++) {
				IBreakpoint bp = existing[i];
				if (bp.getMarker().getResource().equals(fileForLocation)) {
					String attribute = (String) bp.getMarker().getAttribute("source");
					if (attribute != null && attribute.equals("CODE")) {
						DebugPlugin.getDefault().getBreakpointManager().removeBreakpoint(bp, true);
					}
				}
			}
		}
	}

	private IPath getFile(Program debug, int fileIndex) {
		List<SourceFile> sourceFiles = debug.getSources().getSourceFiles();
		for (SourceFile files : sourceFiles) {
			if (files.getFileNumber() == fileIndex) {
				return files.getPath();
			}
		}
		return null;
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

	/**
	 * Clear KickAssembler problem markers for the file and all it's included files.
	 *
	 * @param file the root file
	 */
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
			assemble(assemblyFile);
		}
	}

	private void incrementalBuild(IResourceDelta delta, IProgressMonitor monitor, List<AssemblyFile> roots)
			throws CoreException {
		delta.accept(new ResourceDeltaVisitor(roots));
	}

}
