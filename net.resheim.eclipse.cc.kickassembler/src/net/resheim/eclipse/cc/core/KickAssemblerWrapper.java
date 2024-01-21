package net.resheim.eclipse.cc.core;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.ProcessBuilder.Redirect;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringTokenizer;


import kickass.AssemblerToolbox;
import kickass.common.assmbleinfo.AssembleInfoManager;
import kickass.common.assmbleinfo.IAssembleInfoWriter;
import kickass.common.assmbleinfo.OstreamAssembleInfoWriter;
import kickass.common.assmbleinfo.StdOutAssembleInfoWriter;
import kickass.common.diagnostics.IDiagnostic;
import kickass.common.errors.printers.OneLineErrorPrinter;
import kickass.common.errors.printers.StackTraceErrorPrinter;
import kickass.common.exceptions.AsmErrorException;
import kickass.common.output.SymbolFile;
import kickass.common.output.ViceSymbolFile;
import kickass.common.outputmanager.FileOutputManager;
import kickass.nonasm.tools.FileUtil;
import kickass.nonasm.tools.StringUtil;
import kickass.nonasm.tools.Timer;
import kickass.parsing.sourcelocation.SourceRange;
import kickass.pass.asmnode.AsmNode;
import kickass.pass.asmnode.metanodes.AsmNodeList;
import kickass.pass.asmnode.metanodes.AsmNodePair;
import kickass.pass.asmnode.metanodes.NamespaceNode;
import kickass.pass.asmnode.metanodes.ScopeAndSymbolPageNode;
import kickass.pass.asmnode.output.reciever.MainOutputReciever;
import kickass.pass.function.Function;
import kickass.pass.valueholder.ConstantValueHolder;
import kickass.pass.values.HashtableValue;
import kickass.plugins.interf.autoincludefile.AutoIncludeFile;
import kickass.plugins.interf.autoincludefile.IAutoIncludeFile;
import kickass.setup.KickAssemblerSetup;
import kickass.setup.configuration.optionparser.KickAssemblerConfigFileUtil;
import kickass.setup.configuration.optionparser.KickAssemblerOptionsConfigParser;
import kickass.setup.configuration.optionparser.KickAssemblerPluginConfigParser;
import kickass.setup.configuration.parameters.KickAssemblerParameters;
import kickass.setup.configuration.parameters.KickAssemblerParametersParser;
import kickass.state.AssertManager;
import kickass.state.EvaluationState;
import kickass.state.libraries.ILibrary;
import kickass.state.libraries.LibConstant;
import kickass.state.miscoutput.ByteDumpWriter;
import kickass.state.scope.symboltable.SymbolStatus;

/**
 * A copy of KickAssembler with a few members exposed for the benefit of @see
 * {@link KickAssemblerBuilder}.
 */
public class KickAssemblerWrapper {

	private static final String AUTO_INCLUDED_FILE = "/include/autoinclude.asm";
	private static final String CONFIG_FILE = "/KickAss.cfg";
	private static final String PLUGIN_FILE = "/KickAss.plugin";
	private EvaluationState state = new EvaluationState();

    public int execute(String[] var1, OutputStream out) {
		this.getState().log.addPrintStream(new PrintStream((OutputStream) out));
        this.getState().log.println("Kick Assembler v" + KickAssemblerSetup.versionString + " by Mads Nielsen");
		int var2 = 0;

		try {
			this.gatherParameters(this.getState(), var1);
			this.assemble(this.getState());
		} catch (AsmErrorException var5) {
			IDiagnostic var4 = var5.getError();
			if (!var5.isRegistered) {
				this.getState().diagnosticMgr.add(var4);
				var4.setCallStack(this.getState().callStack);
			}

			this.getState().log.error(StackTraceErrorPrinter.instance.printError(var4, this.getState()));
			var2 = 1;
		} catch (Exception var6) {
			this.getState().log.error(var6);
			var2 = 1;
		}

		var2 |= this.printAsmInfo(this.getState());
		return var2;
	}

	private void gatherParameters(EvaluationState var1, String[] var2) throws IOException {
		KickAssemblerParameters var3 = var1.parameters;
		File var4 = new File(".");
		var3.libPath.add(var4);
		KickAssemblerPluginConfigParser.parsePluginFile("/KickAss.plugin", var1);
		String[] var5 = KickAssemblerOptionsConfigParser.parseOptionConfigFile("/KickAss.cfg");
		KickAssemblerParametersParser var6 = new KickAssemblerParametersParser(var1.log);
		var6.parseArgs(var5, var3);
		var6.parseArgs(var2, var3);
		if (var3.inputFileName == null) {
			throw new AsmErrorException("No inputfile supplied.");
		} else if (!(new File(var3.inputFileName)).exists()) {
			throw new AsmErrorException("Inputfile '" + var3.inputFileName + "' doesn't exist.");
		} else {
			File var7 = var1.fileMgr.getFileOrFail(var3.inputFileName, true, (SourceRange) null);
			File var8 = var7.getCanonicalFile().getParentFile();
			var1.fileMgr.setCurrentDirectory(var8);
			String[] var9 = (String[]) var3.extraCfgFilenames.toArray(new String[0]);
			String[] var10 = var9;
			int var11 = var9.length;

			for (int var12 = 0; var12 < var11; ++var12) {
				String var13 = var10[var12];
				File var14 = KickAssemblerConfigFileUtil.getUserSpecifiedConfigFile(var13, var8);
				if (var14 == null) {
					var1.log.println("Warning. Can't find configfile : " + var13);
				} else {
					String[] var15 = KickAssemblerOptionsConfigParser.parseOptionConfigFile(var14);
					(new KickAssemblerParametersParser(var1.log)).parseArgs(var15, var3);
				}
			}

		}
	}

	private void assemble(EvaluationState var1) {
		File var2 = FileUtil.getCanonicalFile(new File("."));
		KickAssemblerParameters var3 = var1.parameters;
		var1.segmentMgr.defaultSegment.setAllowOverlappingMemoryBlocks(var3.allowOverlappingMemoryblocks);
		File var4 = var1.fileMgr.getCurrentDirectory();
		if (var3.outputDir != null) {
			boolean var5 = (new File(var3.outputDir)).isAbsolute();
			if (var5) {
				var4 = new File(var3.outputDir);
			} else {
				var4 = new File(var4, var3.outputDir);
			}
		}

		var1.outputMgr = new FileOutputManager(var4, var3.allowFileOutput, var3.noOutput);
		var1.log.println("Output dir: " + var4.getAbsolutePath());
		if (var3.displayLibraries) {
			this.displayLibraries(KickAssemblerSetup.getStdLibararies());
		} else {
			var1.log.setDebugging(var3.debug);
			var1.log.setWarnings(var3.warnings);
			var1.fileMgr.setSourceLibraryPath(var3.libPath);
			var1.fileMgr.setFileReplacementMap(var3.fileReplacementMap);
			HashtableValue var45 = (new HashtableValue()).addStringValues(var3.cmdLineArguments);
			var45.lock((SourceRange) null);
			var1.pluginMgr
					.registerPlugin(new AutoIncludeFile("KickAss.jar", this.getClass(), "/include/autoinclude.asm"));
			var1.namespaceMgr.getSystemNamespace().getScope().defineErrorIfExist("cmdLineVars", (var1x) -> {
				return new ConstantValueHolder(var45);
			}, var1, "ERROR! cmdLineVars is already defined", (SourceRange) null).setStatus(SymbolStatus.defined);
			Iterator var6 = KickAssemblerSetup.getStdLibararies().iterator();

			while (var6.hasNext()) {
				ILibrary var7 = (ILibrary) var6.next();
				var1.namespaceMgr.addLibrary(var7, var1.namespaceMgr.getSystemNamespace());
			}

			var6 = KickAssemblerSetup.getStdPlugins().iterator();

			while (var6.hasNext()) {
				Object var47 = var6.next();
				var1.pluginMgr.registerPlugin(var47);
			}

			Set var46 = var1.preprocessorMgr.getDefinedSymbols();
			var46.addAll(var1.parameters.defines);
			String var48 = (new File(var3.inputFileName)).getName();
			int var8 = var48.lastIndexOf(46);
			if (var8 >= 0) {
				var48 = var48.substring(0, var8);
			}

			var1.c64OutputMgr.inputfileWithoutExt = var48;
			if (var3.outputfile == null) {
				String var9 = var3.binFile ? ".bin" : ".prg";
				var3.outputfile = var48 + var9;
			} else {
				File var49 = new File(var3.outputfile);
				if (!var49.isAbsolute()) {
					var49 = new File(var2, var3.outputfile);
				}

				var3.outputfile = var49.toPath().normalize().toString();
			}

			long var50 = System.nanoTime();
			boolean var11 = true;
			StringBuffer var12 = new StringBuffer();
			var12.append("User Arguments: ");

			Map.Entry var14;
			for (Iterator var13 = var3.cmdLineArguments.entrySet().iterator(); var13.hasNext(); var12
					.append((String) var14.getKey() + "=" + (String) var14.getValue())) {
				var14 = (Map.Entry) var13.next();
				if (var11) {
					var11 = false;
				} else {
					var12.append(", ");
				}
			}

			if (!var11) {
				var1.log.println(var12.toString());
			}

			var1.log.println("parsing");
			long var51 = System.nanoTime();
			var1.prepareNewPass();
			AsmNode var15 = AssemblerToolbox.loadAndLexOrError(var3.inputFileName, var1, (SourceRange) null);
			if (var15 != null) {
				NamespaceNode var52 = new NamespaceNode(var15, var1.namespaceMgr.getRootNamespace());
				var15 = var52.executeMetaRegistrations(var1);
				ArrayList var16 = new ArrayList();
				Iterator var17 = var1.pluginMgr.getAutoIncludeFiles().iterator();

				while (var17.hasNext()) {
					IAutoIncludeFile var18 = (IAutoIncludeFile) var17.next();
					InputStream var19 = var18.openStream();
					String var20 = var18.getDefinition().getJarName() + ":" + var18.getDefinition().getFilePath();
					AsmNode var21 = AssemblerToolbox.loadAndLexOrError(var19, var20, var1, (SourceRange) null);
					if (var21 != null) {
						NamespaceNode var58 = new NamespaceNode(var21, var1.namespaceMgr.getSystemNamespace());
						var16.add(var58);
					}
				}

				AsmNodeList var53 = new AsmNodeList(var16);
				AsmNode var54 = var53.executeMetaRegistrations(var1);
				AsmNodePair var55 = new AsmNodePair(var54, var15);
				ScopeAndSymbolPageNode var56 = new ScopeAndSymbolPageNode(var55,
						var1.namespaceMgr.getSystemNamespace().getScope());
				long var59 = System.nanoTime();
				AsmNode var57 = var56.executePrepass(var1);
				this.printErrorsAndTerminate(var1, false);
				if (var3.noEval) {
					var1.log.println("Preparse done and no evaluation requested. Exiting.");
				} else {
					long var23 = System.nanoTime();

					do {
						var1.prepareNewPass();
						var1.log.println("flex pass " + var1.getPassNo());
						var57 = var57.executePass(var1);
						var1.segmentMgr.postPassExecution();
						this.printErrorsAndTerminate(var1, false);
						if (!var1.getMadeMetaProgress() && !var57.isFinished()) {
							var1.prepareNewPass();
							var1.setFailOnInvalidValue(true);
							var57.executePass(var1);
							throw new AsmErrorException(
									"Made no progress and can't solve the program.. You should have gotten an error. Contact the author!",
									(SourceRange) null);
						}
					} while (!var57.isFinished());

					var1.log.println("Output pass");
					MainOutputReciever var25 = new MainOutputReciever(var1.outputMgr, var1.log);
					var57.deliverOutput(var25);
					var25.finish();
					long var26 = System.nanoTime();
					var1.segmentMgr.postPassesExecution();
					this.printErrorsAndTerminate(var1, false);
					if (var3.byteDump) {
						(new ByteDumpWriter()).printSegments(var3.byteDumpFile, var1);
					}

					long var28 = System.nanoTime();
					var1.c64OutputMgr.postPassExecution();
					this.printErrorsAndTerminate(var1, false);
					long var30 = System.nanoTime();
					var1.segmentMgr.doOutputAfterPasses();
					this.printErrorsAndTerminate(var1, true);
					long var32 = System.nanoTime();
					if (var3.time) {
						var1.log.println("Parse time  = " + (var59 - var51) / 1000000L + " ms");
						var1.log.println("PrePass time  = " + (var23 - var59) / 1000000L + " ms");
						var1.log.println("Evaluations passes time  = " + (var26 - var23) / 1000000L + " ms");
						var1.log.println("C64 output(disk,files) = " + (var30 - var28) / 1000000L + " ms");
						var1.log.println("Total assemble time = " + (var32 - var50) / 1000000L + " ms");
					}

					Timer.printTimers(var1.log);
					AssertManager var34 = var1.assertMgr;
					String var35;
					if (var34.getNoOfAsserts() > 0) {
						var1.log.println();
						var35 = var34.getNoOfFailedAsserts() == 0 ? " failed" : " FAILED!";
						var1.log.println("Made " + var34.getNoOfAsserts() + " asserts , " + var34.getNoOfFailedAsserts()
								+ var35);
					}

					String var36;
					String var37;
					if (var3.viceSymbols) {
						var35 = (new File(var48)).getName() + ".vs";
						var36 = (new File(var3.outputfile)).getParent();
						var37 = (var36 == null ? "" : var36 + File.separator) + var35;
						var1.log.println("Writing Vice symbol file: " + var37);
						(new ViceSymbolFile()).writeFile(var37, var1);
					}

					if (var3.symbolFile) {
						if (var3.symbolFileOutputDir == null) {
							var35 = var48 + ".sym";
						} else {
							var36 = (new File(var48)).getName() + ".sym";
							var35 = var3.symbolFileOutputDir + File.separator + var36;
						}

						var1.log.println("Writing Symbol file: " + var35);
						var1.namespaceMgr.getSystemNamespace().getScope().getSymbolTable()
								.setCurrentPage(var56.getSymbolPage());
						(new SymbolFile(var1.namespaceMgr.getRootNamespace())).writeFile(var35, var1);
					}

					if (var3.executeOnSuccess != null) {
						var35 = null;
						if (var35 == null) {
							var35 = var1.c64OutputMgr.getExecuteFileCandidate();
						}

						if (var35 == null) {
							var35 = "";
						}

						boolean var60 = (new File(var35)).isAbsolute();
						var37 = var60 ? var35 : (new File(var4, var35)).toPath().toString();
						String var38 = var3.executeOnSuccess;

						try {
							StringTokenizer var39 = new StringTokenizer(var38);
							String[] var40 = new String[var39.countTokens() + 1];

							for (int var41 = 0; var39.hasMoreTokens(); ++var41) {
								var40[var41] = var39.nextToken();
							}

							var40[var40.length - 1] = var37;
							ProcessBuilder var61 = new ProcessBuilder(var40);
							var61.directory(var4);
							if (var3.executeLog != null) {
								File var42 = new File(var3.executeLog);
								if (!var42.isAbsolute()) {
									var42 = new File(var4, var3.executeLog);
								}

								ProcessBuilder.Redirect var43 = Redirect.to(var42);
								var61.redirectOutput(var43);
								var61.redirectError(var43);
							}

							var61.start();
						} catch (Exception var44) {
							var1.log.error("Error while executing external program: " + var44);
						}
					}

				}
			}
		}
	}

	private int printAsmInfo(EvaluationState var1) {
		boolean var2 = var1.parameters.assembleInfos.isEmpty();
		if (var2) {
			return 0;
		} else {
			Object var3 = null;
			boolean var4 = var1.parameters.assembleInfoToStdOut;
			if (var4) {
				var3 = new StdOutAssembleInfoWriter();
			} else {
				String var5 = var1.parameters.assembleInfoFilename;

				try {
					OutputStream var6 = var1.outputMgr.OpenOutputStream(var5, false);
					var3 = new OstreamAssembleInfoWriter(var6);
				} catch (Exception var7) {
					var1.log.error("Could not create asminfo file: " + var5);
					return 1;
				}
			}

			AssembleInfoManager var8 = new AssembleInfoManager((IAssembleInfoWriter) var3);
			((IAssembleInfoWriter) var3).open();
			var8.WriteInfo(var1);
			((IAssembleInfoWriter) var3).close();
			return 0;
		}
	}

	private void displayLibraries(List<ILibrary> var1) {
		this.getState().log.println("DEFAULT CONSTANTS:");
		Iterator var2 = var1.iterator();

		ILibrary var3;
		Iterator var4;
		while (var2.hasNext()) {
			var3 = (ILibrary) var2.next();
			var4 = var3.getConstants().iterator();

			while (var4.hasNext()) {
				LibConstant var5 = (LibConstant) var4.next();
				this.getState().log.println(var5.getName());
			}
		}

		this.getState().log.println();
		this.getState().log.println("DEFAULT FUNCTIONS:");
		var2 = var1.iterator();

		while (var2.hasNext()) {
			var3 = (ILibrary) var2.next();
			var4 = var3.getFunctions().iterator();

			while (var4.hasNext()) {
				Function var6 = (Function) var4.next();
				this.getState().log.println(var6.getName());
			}
		}

	}

	private void printErrorsAndTerminate(EvaluationState var1, boolean var2) {
		int var3 = var1.diagnosticMgr.getErrors().size();
		int var4 = var1.diagnosticMgr.getWarnings().size();
		boolean var5 = var3 == 0 && (var4 == 0 || !var2);
		if (!var5) {
			int var6 = var3 + var4;
			if (var6 > 1 || var4 > 0 && var2) {
				var1.log.println("Got " + var3 + " errors and " + var4 + " warnings while executing:");
				int var7 = var1.parameters.showMaxNoOfDiagnostics;
				int var8 = var7;

				for (int var9 = 0; var8 > 0 && var9 < var3; ++var9) {
					IDiagnostic var10 = (IDiagnostic) var1.diagnosticMgr.getErrors().get(var9);
					var1.log.println("  " + OneLineErrorPrinter.instance.printError(var10, var1));
					--var8;
				}

				for (int var12 = 0; var8 > 0 && var12 < var4; ++var12) {
					IDiagnostic var11 = (IDiagnostic) var1.diagnosticMgr.getWarnings().get(var12);
					var1.log.println("  " + OneLineErrorPrinter.instance.printError(var11, var1));
					--var8;
				}

				boolean var13 = var6 > var7;
				if (var13) {
					var1.log.println("  ...");
				}
			}

			var1.log.println();
			if (var3 > 0) {
				throw new AsmErrorException((IDiagnostic) var1.diagnosticMgr.getErrors().get(0), true);
			}
		}
	}

	public EvaluationState getState() {
		return state;
	}

}
