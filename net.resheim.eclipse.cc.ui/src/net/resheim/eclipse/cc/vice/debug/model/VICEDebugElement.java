package net.resheim.eclipse.cc.vice.debug.model;

import org.eclipse.debug.core.model.DebugElement;
import org.eclipse.debug.core.model.IDebugTarget;

/**
 * Shared features for the VICE debug model.
 *
 * @since 1.0
 * @author Torkild Ulvøy Resheim
 */
public class VICEDebugElement extends DebugElement {

	public static final String DEBUG_MODEL_ID = "net.resheim.eclipse.cc.vice.debug";

	public VICEDebugElement(IDebugTarget target) {
		super(target);
	}

	@Override
	public String getModelIdentifier() {
		return DEBUG_MODEL_ID;
	}

}
