package net.resheim.eclipse.cc.vice.debug;

import org.eclipse.debug.core.model.DebugElement;
import org.eclipse.debug.core.model.IDebugTarget;

/**
 * Shared features for the VICE debug model.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEDebugElement extends DebugElement {

	public VICEDebugElement(IDebugTarget target) {
		super(target);
	}

	@Override
	public String getModelIdentifier() {
		return "net.resheim.eclipse.cc.vice.debug";
	}

}
