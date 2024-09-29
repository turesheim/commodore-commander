/**
 * Copyright (c) 2024 Torkild Ulvøy Resheim.
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
package net.resheim.eclipse.cc.launch;
public interface ICCLaunchConfigurationConstants {
    public final String ATTR_PROJECT_NAME 		= "LC_ATTR_PROJECT_NAME";
    public final String ATTR_FILE_NAME 			= "LC_ATTR_FILE_NAME";
	public final String ATTR_TARGET 			= "LC_ATTR_TARGET";
	public final String[] TARGET_IDS = new String[] {
    		"vsid","x128","x64dtv","x64sc","xcbm2","xcbm5x0","xpet",
    		"xplus4","xscpu64","xvic"
    };
}
