import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  COMMODORE_COMMANDER_TOOL_PREFERENCE_SCHEMA,
  COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE,
  COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE,
  COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE,
  COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE,
  getCommodoreCommanderToolPreferences
} from '../common/commodore-commander-tool-preferences';
import {
  resolveViceRuntime
} from '../node/vice-runtime-resolver';
import {
  COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION,
  COMMODORE_COMMANDER_PATCHED_VICE_SOURCE_TAG,
  COMMODORE_COMMANDER_PATCHED_VICE_SOURCE_URL,
  DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE
} from '../common/commodore-vice-embed';

test('VICE settings expose runtime path and hide legacy executable and resources preferences', () => {
  const properties = COMMODORE_COMMANDER_TOOL_PREFERENCE_SCHEMA.properties;

  assert.equal(
    COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE,
    'commodoreCommander.VICE.runtimePath'
  );
  assert.ok(properties[COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE]);
  assert.equal(
    properties[COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE]?.default,
    DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE
  );
  assert.deepEqual(
    properties[COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE]?.enum,
    ['embedded', 'external']
  );
  assert.equal(
    properties[COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE]?.hidden,
    true
  );
  assert.equal(
    properties[COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE]?.hidden,
    true
  );
  assert.equal(
    properties[COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE]?.hidden,
    true
  );
  assert.equal(properties['commodoreCommander.VICE.embedded.controlPort1Device'], undefined);
  assert.equal(properties['commodoreCommander.VICE.embedded.controlPort2Device'], undefined);
  assert.equal(properties['commodoreCommander.VICE.embedded.joystick1Device'], undefined);
  assert.equal(properties['commodoreCommander.VICE.embedded.joystick2Device'], undefined);
  assert.equal(properties['commodoreCommander.VICE.embedded.mousePaddlePort'], undefined);
  assert.equal(properties['commodoreCommander.VICE.embedded.mouseGrab'], undefined);
  assert.equal(properties['commodoreCommander.VICE.embedded.keyboardMapping'], undefined);
});

test('patched VICE metadata is pinned to the 3.10.0 release tag', () => {
  assert.equal(COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION, '3.10.0');
  assert.equal(COMMODORE_COMMANDER_PATCHED_VICE_SOURCE_TAG, 'v3.10');
  assert.equal(
    COMMODORE_COMMANDER_PATCHED_VICE_SOURCE_URL,
    'https://sourceforge.net/p/vice-emu/code/HEAD/tree/tags/v3.10/vice/'
  );
});

test('patched VICE keeps refreshing hidden embedded SDL canvases', async () => {
  const patch = await readFile(
    path.resolve(
      __dirname,
      '../../../../tools/vice-embed/vice-3.10.0-commodore-embed.patch'
    ),
    'utf8'
  );

  assert.match(patch, /SDL_WINDOW_HIDDEN/u);
  assert.match(
    patch,
    /sdl_canvas_is_visible\(canvas\) == 0 && !cc_embed_is_enabled\(\)/u
  );
  assert.match(patch, /CC_EMBED_BINARY_MAGIC "CCB1"/u);
  assert.match(patch, /CC_EMBED_MIN_FRAME_INTERVAL_MS 16/u);
  assert.match(patch, /CC_EMBED_FRAME_SOCKET_SEND_BUFFER_BYTES \(4 \* 1024 \* 1024\)/u);
  assert.match(patch, /CC_EMBED_FRAME_PORT_FLAG "-cc-frame-port"/u);
  assert.match(patch, /length = \(size_t\)width \* \(size_t\)height \* 4/u);
  assert.doesNotMatch(patch, /sample_step/u);
  assert.match(patch, /cc_embed_connect_frame_socket/u);
  assert.match(patch, /cc_embed_write_binary_frame_header/u);
  assert.match(patch, /cc_embed_write_frame_bytes/u);
  assert.match(patch, /cc_embed_last_frame_ticks = 0;/u);
  assert.match(patch, /cc_embed_force_next_frame = 1;/u);
  assert.match(patch, /cc_embed_skip_current_frame = 1;/u);
  assert.match(
    patch,
    /!cc_embed_force_next_frame && cc_embed_frame_id > 0/u
  );
  assert.match(patch, /sdl_ui_activate\(\);/u);
  assert.match(patch, /cc_embed_handle_mouse\(payload\);/u);
  assert.match(patch, /#include "mouse\.h"/u);
  assert.match(patch, /#include "mousedrv\.h"/u);
  assert.match(patch, /cc_embed_apply_mouse_motion\(xrel, yrel\);/u);
  assert.match(patch, /mouse_move\(\(float\)xrel, \(float\)yrel\);/u);
  assert.match(patch, /mouse_button\(button, pressed\);/u);
  assert.doesNotMatch(patch, /cc_embed_push_sdl_mouse_motion/u);
  assert.doesNotMatch(patch, /SDL_MOUSEMOTION/u);
  assert.match(patch, /diff --git a\/src\/sid\/sid\.c/u);
  assert.match(patch, /if \(cc_embed_is_enabled\(\)\) \{\n\+        return value;/u);
  assert.match(patch, /return SDLK_F12/u);
  assert.match(patch, /send\(cc_embed_frame_socket/u);
  assert.doesNotMatch(patch, /cc_embed_write_base64/u);
  assert.doesNotMatch(patch, /fwrite\(rgba, 1, length, stdout\)/u);
  assert.match(patch, /cc_embed_publish_frame/u);

  const renderIndex = patch.indexOf(
    'video_canvas_render(canvas, (uint8_t *)canvas->screen->pixels'
  );
  const publishIndex = patch.indexOf(
    'cc_embed_publish_frame(canvas->screen->w'
  );
  const recreateTexturesIndex = patch.indexOf(
    'if (recreate_textures)',
    publishIndex
  );
  assert.ok(renderIndex >= 0);
  assert.ok(publishIndex > renderIndex);
  assert.ok(recreateTexturesIndex > publishIndex);
});

test('tool preferences prefer VICE runtime path and keep legacy fallbacks', () => {
  const values = new Map<string, string>([
    [COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE, ' /new-vice '],
    [COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE, '/legacy-vice'],
    [COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE, ' external '],
    [COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE, ' x64sc-custom ']
  ]);

  const preferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (values.has(preferenceName)
        ? values.get(preferenceName)
        : defaultValue) as T | undefined
  });

  assert.equal(preferences.viceResourcesPath, '/new-vice');
  assert.equal(preferences.viceExecutable, 'x64sc-custom');
  assert.equal(preferences.viceLaunchMode, 'external');
});

test('tool preferences default VICE launch mode to the embedded view', () => {
  const preferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      _preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined => defaultValue
  });

  assert.equal(preferences.viceLaunchMode, 'embedded');
  assert.equal('viceEmbeddedInput' in preferences, false);
});

test('tool preferences ignore legacy embedded VICE input settings', () => {
  const values = new Map<string, string | boolean>([
    ['commodoreCommander.VICE.embedded.controlPort1Device', ' joystick '],
    ['commodoreCommander.VICE.embedded.controlPort2Device', 'mouse1351'],
    ['commodoreCommander.VICE.embedded.joystick1Device', 'keyset1'],
    ['commodoreCommander.VICE.embedded.joystick2Device', 'analog0'],
    ['commodoreCommander.VICE.embedded.mousePaddlePort', '2'],
    ['commodoreCommander.VICE.embedded.mouseGrab', true],
    ['commodoreCommander.VICE.embedded.keyboardMapping', 'positional']
  ]);

  const preferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (values.has(preferenceName)
        ? values.get(preferenceName)
        : defaultValue) as T | undefined
  });

  assert.equal('viceEmbeddedInput' in preferences, false);
});

test('tool preferences map legacy VICE launch modes', () => {
  const embeddedPreferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (preferenceName === COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE
        ? 'patchedView'
        : defaultValue) as T | undefined
  });
  const externalPreferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (preferenceName === COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE
        ? 'externalWindow'
        : defaultValue) as T | undefined
  });

  assert.equal(embeddedPreferences.viceLaunchMode, 'embedded');
  assert.equal(externalPreferences.viceLaunchMode, 'external');
});

test('tool preferences fall back to embedded VICE view for invalid launch modes', () => {
  const values = new Map<string, string>([
    [COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE, 'sidecar']
  ]);

  const preferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (values.has(preferenceName)
        ? values.get(preferenceName)
        : defaultValue) as T | undefined
  });

  assert.equal(preferences.viceLaunchMode, 'embedded');
});

test('tool preferences keep legacy VICE resources path fallback', () => {
  const values = new Map<string, string>([
    [COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE, ' /legacy-vice ']
  ]);

  const preferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (values.has(preferenceName)
        ? values.get(preferenceName)
        : defaultValue) as T | undefined
  });

  assert.equal(preferences.viceResourcesPath, '/legacy-vice');
});

test('tool preferences keep lowercase VICE runtime path fallback', () => {
  const values = new Map<string, string>([
    [COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE, ' /lowercase-vice ']
  ]);

  const preferences = getCommodoreCommanderToolPreferences({
    get: <T>(
      preferenceName: string,
      defaultValue?: T,
      _resourceUri?: string
    ): T | undefined =>
      (values.has(preferenceName)
        ? values.get(preferenceName)
        : defaultValue) as T | undefined
  });

  assert.equal(preferences.viceResourcesPath, '/lowercase-vice');
});

test('resolveViceRuntime prefers configured runtime path over bundled runtime', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-runtime-'));

  try {
    const runtimeDirectory = path.join(tempRoot, 'app-runtime');
    const bundledRoot = path.join(
      runtimeDirectory,
      'assets',
      'vice',
      `${process.platform}-${process.arch}`
    );
    const configuredRoot = path.join(tempRoot, 'configured-vice');

    await mkdir(path.join(bundledRoot, 'share', 'vice'), { recursive: true });
    await mkdir(path.join(configuredRoot, 'share', 'vice'), {
      recursive: true
    });

    const resolved = await resolveViceRuntime({
      runtimeDirectory,
      resourcesPath: configuredRoot
    });

    assert.equal(resolved.resourcesPath, path.resolve(configuredRoot));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('resolveViceRuntime accepts a direct VICE data directory', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-runtime-'));

  try {
    const configuredRoot = path.join(tempRoot, 'vice-data');

    await mkdir(path.join(configuredRoot, 'C64'), { recursive: true });

    const resolved = await resolveViceRuntime({
      resourcesPath: configuredRoot
    });

    assert.equal(resolved.resourcesPath, path.resolve(configuredRoot));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('resolveViceRuntime prefers resources beside explicit executable path over bundled runtime', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-runtime-'));

  try {
    const runtimeDirectory = path.join(tempRoot, 'app-runtime');
    const bundledRoot = path.join(
      runtimeDirectory,
      'assets',
      'vice',
      `${process.platform}-${process.arch}`
    );
    const externalRoot = path.join(tempRoot, 'external-vice');
    const externalExecutable = path.join(externalRoot, 'bin', 'x64sc');

    await mkdir(path.join(bundledRoot, 'share', 'vice'), { recursive: true });
    await mkdir(path.join(externalRoot, 'share', 'vice'), { recursive: true });

    const resolved = await resolveViceRuntime({
      runtimeDirectory,
      executable: externalExecutable
    });

    assert.equal(resolved.resourcesPath, path.resolve(externalRoot));
    assert.equal(resolved.executable, externalExecutable);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
