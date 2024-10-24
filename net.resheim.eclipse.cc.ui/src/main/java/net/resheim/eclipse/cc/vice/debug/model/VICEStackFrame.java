/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim
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
package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.model.IThread;
import org.eclipse.debug.core.model.IVariable;

import net.resheim.eclipse.cc.builder.model.Assembly;
import net.resheim.eclipse.cc.builder.model.LineMapping;

/**
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEStackFrame extends VICEDebugElement implements IStackFrame {

	/** A reusable register group */
	private VICERegisterGroup registerGroup;

	private final IThread thread;

	public VICEStackFrame(IThread thread) {
		super(thread.getDebugTarget());
		this.thread = thread;
		this.registerGroup = new VICERegisterGroup(getDebugTarget());
	}

	@Override
	public boolean canStepInto() {
		return thread.canStepInto();
	}

	@Override
	public boolean canStepOver() {
		return thread.canStepOver();
	}

	@Override
	public boolean canStepReturn() {
		return thread.canStepReturn();
	}

	@Override
	public boolean isStepping() {
		return thread.isStepping();
	}

	@Override
	public void stepInto() throws DebugException {
		thread.stepInto();
	}

	@Override
	public void stepOver() throws DebugException {
		thread.stepOver();
	}

	@Override
	public void stepReturn() throws DebugException {
		thread.stepReturn();
	}

	@Override
	public boolean canResume() {
		return thread.canResume();
	}

	@Override
	public boolean canSuspend() {
		return thread.canSuspend();
	}

	@Override
	public boolean isSuspended() {
		return thread.isSuspended();
	}

	@Override
	public void resume() throws DebugException {
		thread.resume();
	}

	@Override
	public void suspend() throws DebugException {
		thread.suspend();
	}

	@Override
	public boolean canTerminate() {
		return thread.canTerminate();
	}

	@Override
	public boolean isTerminated() {
		return thread.isTerminated();
	}

	@Override
	public void terminate() throws DebugException {
		thread.terminate();
	}

	@Override
	public IThread getThread() {
		return thread;
	}

	@Override
	public IVariable[] getVariables() throws DebugException {
		return new IVariable[0];
	}

	@Override
	public boolean hasVariables() throws DebugException {
		return true;
	}

	@Override
	public int getLineNumber() throws DebugException {
		// determine the address of the program counter
		int pc = Short.toUnsignedInt(getProgramCounter());
		// attempt to determine a line mapping for the program counter
		LineMapping lineMapping = getAssembly().getLineMapping(pc);
		// this may not match anything in the program as it could be in the
		// kernal somewhere
		if (lineMapping != null) {
			return lineMapping.getStartLine();
		}
		return -1;
	}

	/**
	 * Calculates and returns the name of the assembly file that contains the code
	 * for the current program counter.
	 *
	 * @return the file name or <code>null</code>
	 * @throws CoreException
	 */
	public String getFileName() throws CoreException {
		int pc = Short.toUnsignedInt(getProgramCounter());
		Assembly assembly = getAssembly();
		// attempt to determine a line mapping for the program counter
		LineMapping lineMapping = assembly.getLineMapping(pc);
		// this may not match anything in the program as it could be in the
		// kernal somewhere
		if (lineMapping != null) {
			IFile file = assembly.findFile(lineMapping.getFileIndex());
			// remove the project part as we currently do not support dealing
			// with source files in multiple projects
			return file.getFullPath().removeFirstSegments(1).toPortableString();
		}
		return null;
	}

	@Override
	public int getCharStart() throws DebugException {
		// XXX: Ned to calculate the character position in the file, not line
//		int pc = Short.toUnsignedInt(getProgramCounter());
//		Assembly assembly = getAssembly();
//		// attempt to determine a line mapping for the program counter
//		LineMapping lineMapping = assembly.getLineMapping(pc);
//		if (lineMapping != null) {
//			return lineMapping.getStartColumn();
//		}
		return -1;
	}

	@Override
	public int getCharEnd() throws DebugException {
		// XXX: Ned to calculate the character position in the file, not line
//		int pc = Short.toUnsignedInt(getProgramCounter());
//		Assembly assembly = getAssembly();
//		// attempt to determine a line mapping for the program counter
//		LineMapping lineMapping = assembly.getLineMapping(pc);
//		if (lineMapping != null) {
//			return lineMapping.getEndColumn();
//		}
		return -1;
	}

	@Override
	public String getName() throws DebugException {
		// AFAIK we don't really have stack frames on a 6510, so we're using the
		// PROGRAM COUNTER to name this frame
		StringBuilder sb = new StringBuilder();
		if (registerGroup.hasRegisters()) {
			try {
				sb.append(getFileName());
				sb.append(" [line: ");
				sb.append(getLineNumber());
				sb.append("] ");
			} catch (CoreException e) {
				e.printStackTrace();
			}
			sb.append(registerGroup.getRegisterByName("PC").getValue().getValueString());
			return sb.toString();
		} else {
			return "No registers available";
		}
	}

	@Override
	public IRegisterGroup[] getRegisterGroups() throws DebugException {
		return new IRegisterGroup[] { registerGroup };
	}

	@Override
	public boolean hasRegisterGroups() throws DebugException {
		return true;
	}

	public short getProgramCounter() throws NumberFormatException, DebugException {
		return registerGroup.getProgramCounter();
	}

	public Assembly getAssembly() {
		return ((VICEDebugTarget) getDebugTarget()).getAssembly();
	}

	@Override
	public int hashCode() {
		// Make sure we get a different value when the file name has changed
		// so that the UI will update properly and load the correct file. This
		// is required since we are reusing the same IStackFrame instance.
		try {
			return getFileName().hashCode() + getProgramCounter();
		} catch (CoreException e) {
			e.printStackTrace();
		}
		return super.hashCode();
	}

}
