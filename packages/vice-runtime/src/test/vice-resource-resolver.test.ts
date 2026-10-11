import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createEmbeddedViceArgs } from '../vice-launch-flags';
import { resolveViceRuntime } from '../vice-resource-resolver';

test('createEmbeddedViceArgs enables VICE mouse grab for captured input', () => {
  assert.deepEqual(
    createEmbeddedViceArgs(['-model', 'c64']),
    ['-mouse', '-model', 'c64', '-keymap', '0', '-keyboardmapping', '0']
  );
  assert.deepEqual(
    createEmbeddedViceArgs(['+mouse', '-model', 'c64']),
    ['+mouse', '-model', 'c64', '-keymap', '0', '-keyboardmapping', '0']
  );
  assert.deepEqual(
    createEmbeddedViceArgs(['-mouse', '-model', 'c64']),
    ['-mouse', '-model', 'c64', '-keymap', '0', '-keyboardmapping', '0']
  );
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
      runtimeDirectory: tempRoot,
      resourcesPath: configuredRoot
    });

    assert.equal(resolved.resourcesPath, path.resolve(configuredRoot));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('an invalid explicit runtime cannot silently fall back to a valid bundled copy', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-override-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bundled = path.join(root, 'assets', 'vice', `${process.platform}-${process.arch}`);
  await mkdir(path.join(bundled, 'share', 'vice'), { recursive: true });
  await assert.rejects(resolveViceRuntime({
    runtimeDirectory: root, resourcesPath: path.join(root, 'missing')
  }), /Correct the configured path or clear it/u);
  assert.equal((await resolveViceRuntime({ runtimeDirectory: root })).resourcesPath, bundled);
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
