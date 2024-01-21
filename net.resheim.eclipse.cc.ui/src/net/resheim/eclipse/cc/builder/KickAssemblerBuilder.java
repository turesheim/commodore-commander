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
import net.resheim.eclipse.cc.core.KickAssemblerWrapper;
import net.resheim.eclipse.cc.ui.ConsoleFactory;

public class KickAssemblerBuilder extends IncrementalProjectBuilder {

	class ResourceDeltaVisitor implements IResourceDeltaVisitor {
		@Override
		public boolean visit(IResourceDelta delta) throws CoreException {
			IResource resource = delta.getResource();
			switch (delta.getKind()) {
			case IResourceDelta.ADDED:
				// handle added resource
				buildAssembly(resource);
				break;
			case IResourceDelta.REMOVED:
				// handle removed resource
				break;
			case IResourceDelta.CHANGED:
				// handle changed resource
				buildAssembly(resource);
				break;
			}
			// return true to continue visiting children.
			return true;
		}
	}

	class SampleResourceVisitor implements IResourceVisitor {
		public boolean visit(IResource resource) {
			buildAssembly(resource);
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

	@Override
	protected IProject[] build(int kind, Map<String, String> args, IProgressMonitor monitor) throws CoreException {
		if (kind == FULL_BUILD) {
			fullBuild(monitor);
		} else {
			IResourceDelta delta = getDelta(getProject());
			if (delta == null) {
				fullBuild(monitor);
			} else {
				incrementalBuild(delta, monitor);
			}
		}
		return null;
	}

	protected void clean(IProgressMonitor monitor) throws CoreException {
		// delete markers set and files created
		getProject().deleteMarkers(MARKER_TYPE, true, IResource.DEPTH_INFINITE);
	}

	void buildAssembly(IResource resource) {
		if (resource instanceof IFile && resource.getName().endsWith(".asm")) {
			IFile file = (IFile) resource;
			deleteMarkers(file);
			KickAssemblerWrapper wrapper = new KickAssemblerWrapper();
			MessageConsole console = ConsoleFactory.findConsole();
			MessageConsoleStream out = console.newMessageStream();
			wrapper.execute(new String[] { "-libdir", file.getProject().getFolder("library").getLocation().toOSString(),
					file.getLocation().toOSString(), "-asminfo", "all", "-symbolfile" }, out);
			for (IDiagnostic iDiagnostic : wrapper.getState().diagnosticMgr.getErrors()) {
				addDiagnosticMessage(iDiagnostic);
			}
			for (IDiagnostic iDiagnostic : wrapper.getState().diagnosticMgr.getWarnings()) {
				addDiagnosticMessage(iDiagnostic);
			}
			// Make sure any changes in the file systems are reflected in the
			// Eclipse viewers.
			try {
				resource.getProject().refreshLocal(IResource.DEPTH_INFINITE, new NullProgressMonitor());
			} catch (CoreException e) {
				e.printStackTrace();
			}
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

	private void deleteMarkers(IFile file) {
		try {
			file.deleteMarkers(MARKER_TYPE, false, IResource.DEPTH_ZERO);
		} catch (CoreException ce) {
		}
	}

	protected void fullBuild(final IProgressMonitor monitor) throws CoreException {
		try {
			getProject().accept(new SampleResourceVisitor());
		} catch (CoreException e) {
		}
	}

	protected void incrementalBuild(IResourceDelta delta, IProgressMonitor monitor) throws CoreException {
		// the visitor does the work.
		delta.accept(new ResourceDeltaVisitor());
	}
}
