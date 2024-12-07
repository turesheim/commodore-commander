package net.resheim.eclipse.cc.ui.debug;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.ui.memory.IMemoryRendering;
import org.eclipse.debug.ui.memory.IMemoryRenderingTypeDelegate;

public class CCRenderingTypeDelegate implements IMemoryRenderingTypeDelegate {

	public CCRenderingTypeDelegate() {
		// TODO Auto-generated constructor stub
	}

	@Override
	public IMemoryRendering createRendering(String id) throws CoreException {
		CharacterMapRendering hexIntegerRendering = new CharacterMapRendering(id);
		return hexIntegerRendering;
	}

}
