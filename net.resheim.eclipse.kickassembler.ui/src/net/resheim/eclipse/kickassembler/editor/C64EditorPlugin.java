package net.resheim.eclipse.kickassembler.editor;

import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

import jakarta.xml.bind.JAXBException;

public class C64EditorPlugin extends AbstractUIPlugin {

	private IOMap ioMap;

	private static C64EditorPlugin plugin;

	public C64EditorPlugin() {
		// TODO Auto-generated constructor stub
	}

	@Override
	public void start(BundleContext context) throws Exception {
		super.start(context);
		ioMap = new IOMap();
		try {
			ioMap.load();
		} catch (JAXBException e) {
			e.printStackTrace();
		}
		plugin = this;

	}

	public IOMap getIOMap() {
		return ioMap;
	}

	public static C64EditorPlugin getPlugin() {
		return plugin;
	}

}
