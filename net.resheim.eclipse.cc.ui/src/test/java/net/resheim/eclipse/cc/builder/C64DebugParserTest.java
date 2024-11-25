package net.resheim.eclipse.cc.builder;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.File;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.Unmarshaller;
import net.resheim.eclipse.cc.builder.model.Breakpoint;
import net.resheim.eclipse.cc.builder.model.LineMapping;
import net.resheim.eclipse.cc.builder.model.Assembly;

public class C64DebugParserTest {

	private static Assembly debugger;

	@BeforeAll
	static void setup() throws Exception {
		// Create JAXB context for the root class (C64debugger)
		JAXBContext context = JAXBContext.newInstance(Assembly.class);

		// Create Unmarshaller
		Unmarshaller unmarshaller = context.createUnmarshaller();

		debugger = (Assembly) unmarshaller.unmarshal(new File("src/test/resources/itema.dbg"));

	}

	@Test
	void testSegmentStart() throws Exception {
		LineMapping lineMapping = debugger.getLineMapping(Integer.valueOf("0801", 16));
		assertEquals(Integer.valueOf("0801", 16), lineMapping.getStartAddress());
	}

	@Test
	void testSegmentEnd() throws Exception {
		LineMapping lineMapping = debugger.getLineMapping(Integer.valueOf("0802", 16));
		assertEquals(Integer.valueOf("0801", 16), lineMapping.getStartAddress());
	}

	@Test
	void testGetBreakpoints() throws Exception {
		List<Breakpoint> breakpoints = debugger.getBreakpoints();
		assertEquals(2, breakpoints.size());
		assertEquals(Integer.valueOf("c357", 16), breakpoints.get(0).getStartAddress());
	}

}
