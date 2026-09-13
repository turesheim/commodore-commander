/*
 * Copyright (c) 2026 Torkild Ulvøy Resheim.
 * SPDX-License-Identifier: EPL-2.0
 */
package net.resheim.cc.sidscore.kickass;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import kickass.plugins.interf.IPlugin;
import kickass.plugins.interf.archive.IArchive;
import kickass.plugins.interf.autoincludefile.AutoIncludeFileDefinition;
import kickass.plugins.interf.autoincludefile.IAutoIncludeFile;
import net.resheim.sidscore.export.SIDScoreModuleExporter;

/**
 * KickAssembler plugin that assembles configured SIDScore modules in the host build.
 *
 * Each configured module is an auto-include source. KickAssembler opens these
 * sources independently of the host source, so each one declares its own origin.
 */
public final class SIDScoreArchive implements IArchive {
  private static final String PROPERTY_PREFIX = "cc.sidscore.";
  private static final String PLUGIN_JAR_NAME = "sidscore-kickass-plugin.jar";

  @Override
  public List<IPlugin> getPluginObjects() {
    int count = readCount();
    List<IPlugin> plugins = new ArrayList<>(count);
    Set<String> namespaces = new HashSet<>();
    Set<Integer> origins = new HashSet<>();
    Set<Path> generatedPaths = new HashSet<>();
    for (int index = 0; index < count; index++) {
      ModuleSettings settings = readSettings(index);
      if (!namespaces.add(settings.namespace())) {
        throw configurationError("duplicate namespace '" + settings.namespace() + "'");
      }
      if (!origins.add(settings.origin())) {
        throw configurationError("duplicate origin " + toHex(settings.origin()));
      }
      if (settings.generatedAsm() != null && !generatedPaths.add(settings.generatedAsm())) {
        throw configurationError("duplicate generatedAsm path " + settings.generatedAsm());
      }
      plugins.add(new SIDScoreAutoIncludeFile(settings));
    }
    return plugins;
  }

  private static int readCount() {
    String raw = requiredProperty(PROPERTY_PREFIX + "count");
    try {
      int count = Integer.parseInt(raw);
      if (count > 0 && count <= 256) {
        return count;
      }
    } catch (NumberFormatException ignored) {
      // Report a single, actionable property error below.
    }
    throw configurationError(PROPERTY_PREFIX + "count must be between 1 and 256");
  }

  private static ModuleSettings readSettings(int index) {
    String prefix = PROPERTY_PREFIX + index + ".";
    String sourceValue = requiredProperty(prefix + "source");
    Path source;
    try {
      source = Path.of(sourceValue);
    } catch (RuntimeException exception) {
      throw configurationError(prefix + "source is not a valid path: " + sourceValue, exception);
    }
    if (!source.isAbsolute()) {
      throw configurationError(prefix + "source must be an absolute path: " + sourceValue);
    }
    if (source.getFileName() == null || !source.getFileName().toString()
        .toLowerCase(java.util.Locale.ROOT).endsWith(".sidscore")) {
      throw configurationError(prefix + "source must be a .sidscore file: " + sourceValue);
    }
    if (!Files.isRegularFile(source) || !Files.isReadable(source)) {
      throw configurationError(prefix + "source is not a readable file: " + sourceValue);
    }

    String namespace = requiredProperty(prefix + "namespace");
    if (!namespace.matches("[A-Za-z_][A-Za-z_0-9]*")) {
      throw configurationError(prefix + "namespace must be a KickAssembler identifier: " + namespace);
    }
    int origin = parseOrigin(prefix + "origin", requiredProperty(prefix + "origin"));
    Path generatedAsm = optionalGeneratedAsm(prefix + "generatedAsm", source);
    return new ModuleSettings(source, namespace, origin, generatedAsm);
  }

  private static Path optionalGeneratedAsm(String name, Path source) {
    String value = System.getProperty(name);
    if (value == null) {
      return null;
    }
    if (value.isBlank()) {
      throw configurationError(name + " cannot be empty");
    }
    Path path;
    try {
      path = Path.of(value.trim()).normalize();
    } catch (RuntimeException exception) {
      throw configurationError(name + " is not a valid path: " + value, exception);
    }
    if (!path.isAbsolute() || !path.getFileName().toString().endsWith(".asm")) {
      throw configurationError(name + " must be an absolute .asm path: " + value);
    }
    if (path.equals(source.normalize())) {
      throw configurationError(name + " must differ from the SIDScore source path");
    }
    return path;
  }

  private static String requiredProperty(String name) {
    String value = System.getProperty(name);
    if (value == null || value.isBlank()) {
      throw configurationError("missing JVM property -D" + name + "=<value>");
    }
    return value.trim();
  }

  private static int parseOrigin(String name, String value) {
    int radix = 10;
    String digits = value;
    if (value.startsWith("$")) {
      radix = 16;
      digits = value.substring(1);
    } else if (value.startsWith("0x") || value.startsWith("0X")) {
      radix = 16;
      digits = value.substring(2);
    }
    try {
      int origin = Integer.parseInt(digits, radix);
      if (origin >= 0 && origin <= 0xffff) {
        return origin;
      }
    } catch (NumberFormatException ignored) {
      // Report a single, actionable property error below.
    }
    throw configurationError(name + " must be a C64 address (decimal, $hex, or 0xhex): " + value);
  }

  private static String toHex(int address) {
    return String.format(java.util.Locale.ROOT, "$%04x", address);
  }

  private static IllegalArgumentException configurationError(String message) {
    return new IllegalArgumentException("SIDScore KickAssembler plugin: " + message);
  }

  private static IllegalArgumentException configurationError(String message, Throwable cause) {
    return new IllegalArgumentException("SIDScore KickAssembler plugin: " + message, cause);
  }

  private record ModuleSettings(Path source, String namespace, int origin, Path generatedAsm) {}

  private static final class SIDScoreAutoIncludeFile implements IAutoIncludeFile {
    private final ModuleSettings settings;
    private final AutoIncludeFileDefinition definition;
    private byte[] generatedBytes;

    private SIDScoreAutoIncludeFile(ModuleSettings settings) {
      this.settings = settings;
      definition = new AutoIncludeFileDefinition();
      if (settings.generatedAsm() != null) {
        definition.setJarName("file");
        definition.setFilePath(settings.generatedAsm().toUri().getRawSchemeSpecificPart());
      } else {
        definition.setJarName(PLUGIN_JAR_NAME);
        definition.setFilePath("/generated/" + settings.namespace() + ".asm");
      }
    }

    @Override
    public AutoIncludeFileDefinition getDefinition() {
      return definition;
    }

    @Override
    public synchronized InputStream openStream() {
      if (generatedBytes == null) {
        try {
          String moduleAsm = new SIDScoreModuleExporter().generate(
              settings.source(), settings.namespace());
          String source = "// Generated SIDScore module\n"
              + "*=" + toHex(settings.origin()) + " \"SIDScore " + settings.namespace() + "\"\n"
              + moduleAsm;
          byte[] bytes = source.getBytes(StandardCharsets.UTF_8);
          if (settings.generatedAsm() != null) {
            writeGeneratedAsm(settings.generatedAsm(), bytes);
          }
          generatedBytes = bytes;
        } catch (Exception | LinkageError exception) {
          throw new IllegalStateException("SIDScore KickAssembler plugin: failed to generate "
              + settings.namespace() + " from " + settings.source() + ": " + exception.getMessage(), exception);
        }
      }
      return new ByteArrayInputStream(generatedBytes);
    }

    private static void writeGeneratedAsm(Path path, byte[] bytes) throws java.io.IOException {
      Files.createDirectories(path.getParent());
      Path temporary = Files.createTempFile(path.getParent(), ".sidscore-", ".asm.tmp");
      try {
        Files.write(temporary, bytes);
        try {
          Files.move(temporary, path, StandardCopyOption.ATOMIC_MOVE,
              StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException exception) {
          Files.move(temporary, path, StandardCopyOption.REPLACE_EXISTING);
        }
      } finally {
        Files.deleteIfExists(temporary);
      }
    }
  }
}
