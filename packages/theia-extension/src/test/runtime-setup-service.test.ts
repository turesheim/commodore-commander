import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { PreferenceService } from '@theia/core/lib/common/preferences';
import type { RuntimeSetupCheck } from '../common/runtime-setup-service';
import { RuntimeSetupServiceImpl } from '../node/runtime-setup-service-impl';

class SetupService extends RuntimeSetupServiceImpl {
  javaCommand?: string;
  viceCommand?: string;
  embedded?: boolean;
  constructor(values: Record<string, string>, private readonly javaMajor = 21) {
    super();
    Object.assign(this, { preferenceService: {
      ready: Promise.resolve(),
      get: (key: string, defaultValue: unknown) => values[key] ?? defaultValue
    } as unknown as PreferenceService });
  }
  protected override async probeJava(command: string) {
    this.javaCommand = command;
    if (command === 'missing-java') { throw new Error('ENOENT'); }
    return { version: `${this.javaMajor}.0.1`, major: this.javaMajor };
  }
  protected override async probeVice(command: string, embedded: boolean) {
    this.viceCommand = command;
    this.embedded = embedded;
    return { version: '3.10', embedded };
  }
  protected override async checkAssets(): Promise<RuntimeSetupCheck> {
    return { name: 'Bundled tools', state: 'ready', detail: 'Fixture tools' };
  }
}

class JavaProbeService extends RuntimeSetupServiceImpl {
  checkCommand(command: string): Promise<RuntimeSetupCheck> {
    return this.checkJava(command);
  }
}

test('the real Java subprocess check rejects a missing executable', async () => {
  const result = await new JavaProbeService().checkCommand(path.join(os.tmpdir(), 'no-such-cc-java', 'java'));
  assert.equal(result.state, 'error');
  assert.match(result.detail, /ENOENT/u);
  assert.match(result.detail, /commodoreCommander.tools.javaRuntime/u);
});

test('the real Java subprocess check reads stderr and enforces Java 21', { skip: process.platform === 'win32' }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-setup-java-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const command = path.join(root, 'java with spaces');
  await writeFile(command, '#!/bin/sh\nprintf \'openjdk version "17.0.1"\\n\' >&2\n');
  await chmod(command, 0o755);
  const old = await new JavaProbeService().checkCommand(command);
  assert.equal(old.state, 'error');
  assert.match(old.detail, /Java 17.*requires Java 21/u);
  await writeFile(command, '#!/bin/sh\nprintf \'openjdk version "21.0.1"\\n\' >&2\n');
  const supported = await new JavaProbeService().checkCommand(command);
  assert.equal(supported.state, 'ready');
  assert.match(supported.detail, /Java 21.0.1/u);
});

test('runtime report uses the selected machine executable and scoped tool settings', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-setup-report-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'share', 'vice', 'C128'), { recursive: true });
  const service = new SetupService({
    'commodoreCommander.activeMachine': 'c128',
    'commodoreCommander.tools.javaRuntime': '/Java With Spaces/bin/java',
    'commodoreCommander.VICE.runtimePath': root,
    'commodoreCommander.VICE.launchMode': 'embedded'
  });
  const report = await service.check('file:///project');
  assert.equal(service.javaCommand, '/Java With Spaces/bin/java');
  assert.equal(service.viceCommand, 'x128');
  assert.equal(service.embedded, true);
  assert.equal(report.machine, 'c128');
  assert.equal(report.launchMode, 'embedded');
  assert.equal(report.checks.every(check => check.state === 'ready'), true);
});

test('missing Java and invalid VICE paths produce independent actionable errors', async () => {
  const service = new SetupService({
    'commodoreCommander.tools.javaRuntime': 'missing-java',
    'commodoreCommander.VICE.runtimePath': path.join(os.tmpdir(), 'no-such-cc-runtime-setup')
  });
  const report = await service.check();
  assert.equal(report.checks[0].state, 'error');
  assert.match(report.checks[0].detail, /Install Java 21/u);
  assert.equal(report.checks[1].state, 'ready');
  assert.equal(report.checks[2].state, 'error');
  assert.match(report.checks[2].detail, /Correct the configured path/u);
});

test('Java 17 cannot pass the complete runtime setup check', async () => {
  const report = await new SetupService({}, 17).check();
  assert.equal(report.checks[0].state, 'error');
  assert.match(report.checks[0].detail, /Java 17.*requires Java 21/u);
});

test('invalid machine selection is reported without claiming VICE is ready', async () => {
  const report = await new SetupService({ 'commodoreCommander.activeMachine': 'unknown-machine' }).check();
  assert.equal(report.checks[2].state, 'error');
  assert.match(report.checks[2].detail, /Unsupported Commodore machine profile/u);
});

test('a runtime containing only another machine cannot pass selected-machine setup', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-setup-machine-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'share', 'vice', 'C64'), { recursive: true });
  const service = new SetupService({
    'commodoreCommander.activeMachine': 'c128', 'commodoreCommander.VICE.runtimePath': root
  });
  const report = await service.check();
  assert.equal(service.viceCommand, undefined);
  assert.equal(report.checks[2].state, 'error');
  assert.match(report.checks[2].detail, /C128/u);
});
