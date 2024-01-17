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
package net.resheim.eclipse.kickassembler.editor;

import org.eclipse.jface.internal.text.html.BrowserInformationControl;
import org.eclipse.jface.resource.JFaceResources;
import org.eclipse.jface.text.AbstractInformationControl;
import org.eclipse.jface.text.IInformationControl;
import org.eclipse.jface.text.IInformationControlCreator;
import org.eclipse.jface.text.IInformationControlExtension5;
import org.eclipse.swt.SWT;
import org.eclipse.swt.browser.Browser;
import org.eclipse.swt.graphics.Point;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Menu;
import org.eclipse.swt.widgets.Shell;

/**
 * A browser based tooltip for better control of presentation. This is used for
 * the rich description elements that is used for the MOS 6510 and C64
 * documentation that is embedded.
 */
public class DocumentationInformationControl extends AbstractInformationControl
		implements IInformationControlExtension5 {

	private Browser fBrowser;

	public DocumentationInformationControl(Shell parent) {
		super(parent, "Commodore 64 I/O Map (press F2 for focus)", true);
		create();
	}

	@Override
	protected void createContent(Composite parent) {
		fBrowser = new Browser(parent, SWT.NONE);
		fBrowser.setJavascriptEnabled(false);

		// Cancel opening of new windows
		fBrowser.addOpenWindowListener(event -> event.required = true);

		// Replace browser's built-in context menu with none
		fBrowser.setMenu(new Menu(getShell(), SWT.NONE));

	}

	@Override
	public void setInformation(String input) {
		fBrowser.setText(input);
	}

	@Override
	public boolean hasContents() {
		return true;
	}

	@Override
	public Point computeSizeHint() {
		return new Point(600, 200);
	}

	// This method will be called when the control gets focus and the enriched
	// version of the control is requested. Should probably re-implement
	// something similar as the BrowserInformationControl instead of using an
	// internal type.
	@Override
	public IInformationControlCreator getInformationPresenterControlCreator() {
		return new IInformationControlCreator() {

			@SuppressWarnings("restriction")
			@Override
			public IInformationControl createInformationControl(Shell parent) {
				return new BrowserInformationControl(parent, JFaceResources.DIALOG_FONT, "Commodore 64 I/O Map");
			}
		};
	}

}