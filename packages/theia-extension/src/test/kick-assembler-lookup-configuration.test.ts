import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { KickAssemblerBuildServiceImpl } from '../node/kick-assembler-build-service-impl';

test('editor configuration reads never create or rewrite build settings and reuse profile library paths', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'cc-lookup-config-'));
  const service = new KickAssemblerBuildServiceImpl();
  // Isolate this test from user/CI environment overrides and preference setup.
  Object.assign(service, { getBuildEnvironment: async () => ({}) });
  const request = { workspaceRootUri: pathToFileURL(temp).toString() };
  try {
    const empty = await service.getWorkspaceLookupConfiguration(request);
    assert.deepEqual(empty.programs, []);
    assert.deepEqual(empty.libraryRootUris, [pathToFileURL(path.join(temp, 'library')).toString()]);
    assert.deepEqual(await readdir(temp), []);
    const config = JSON.stringify({ defaultProfile: 'debug', libraryRoots: ['base-lib'],
      profiles: { debug: { libraryRoots: ['profile-lib'] } },
      programs: [{ root: 'main.asm', libraryRoots: ['../vendor'] }, { root: 'other.asm' }] });
    const file = path.join(temp, 'commodore-commander.build.json');
    await writeFile(file, config);
    const settings = await service.getWorkspaceLookupConfiguration(request);
    assert.deepEqual(settings.libraryRootUris, [pathToFileURL(path.join(temp, 'profile-lib')).toString()]);
    assert.deepEqual(settings.programs[0]!.libraryRootUris, [pathToFileURL(path.resolve(temp, '../vendor')).toString()]);
    assert.deepEqual(settings.programs[1]!.libraryRootUris, settings.libraryRootUris);
    assert.equal(await readFile(file, 'utf8'), config);
  } finally { service.dispose(); await rm(temp, { recursive: true, force: true }); }
});
