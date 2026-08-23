import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSidScorePlayerServerArgs,
  formatCommandLine,
  formatSidScoreLaunchDiagnostic
} from '../node/sidscore-launch';

test('SIDScore player server launch disables macOS AWT MIDI event pump before jar execution', () => {
  const args = createSidScorePlayerServerArgs({
    kickAssemblerJarPath: '/Applications/Commodore Commander/KickAss.jar',
    sidScoreCliJarPath: '/Applications/Commodore Commander/sidscore-cli.jar',
    platform: 'darwin'
  });

  const jarIndex = args.indexOf('-jar');

  assert.ok(jarIndex > 0);
  assert.equal(args.includes('-Djava.awt.headless=false'), false);
  assert.equal(args.includes('-Dapple.awt.UIElement=true'), false);
  assert.equal(args.includes('-Dsidscore.midi.awtEventPump=true'), false);
  assert.ok(args.indexOf('-Dsidscore.midi.awtEventPump.disabled=true') > -1);
  assert.ok(args.indexOf('-Dsidscore.midi.awtEventPump.disabled=true') < jarIndex);
  assert.equal(args[jarIndex + 1], '/Applications/Commodore Commander/sidscore-cli.jar');
  assert.deepEqual(args.slice(-3), ['--player-server', '--port', '0']);
});

test('SIDScore player server launch keeps macOS-only MIDI properties off other platforms', () => {
  const args = createSidScorePlayerServerArgs({
    kickAssemblerJarPath: '/opt/commodore/KickAss.jar',
    sidScoreCliJarPath: '/opt/commodore/sidscore-cli.jar',
    platform: 'linux'
  });

  assert.equal(args.includes('-Djava.awt.headless=false'), false);
  assert.equal(args.includes('-Dapple.awt.UIElement=true'), false);
  assert.equal(args.includes('-Dsidscore.midi.awtEventPump=true'), false);
  assert.equal(args.includes('-Dsidscore.midi.awtEventPump.disabled=true'), false);
  assert.ok(args.includes('-Dsidscore.midi.monitor.startOnInput=false'));
});

test('SIDScore launch diagnostic records command and Java environment signals', () => {
  const javaHome = '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home';
  const javaToolOptions = '-Dhttp.proxyPassword=secret-token';
  const diagnostic = formatSidScoreLaunchDiagnostic({
    command: '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java',
    args: ['-Djava.awt.headless=false', '-jar', '/Applications/Commodore Commander/sidscore-cli.jar'],
    cwd: '/Users/test/Commodore Project',
    env: {
      JAVA_HOME: javaHome,
      JAVA_TOOL_OPTIONS: javaToolOptions
    },
    platform: 'darwin',
    arch: 'arm64',
    processExecPath: '/Applications/Commodore Commander.app/Contents/MacOS/Commodore Commander'
  });

  assert.match(diagnostic, /^\[Commodore Commander\] launching SIDScore player server/u);
  assert.match(diagnostic, /command=/u);
  assert.match(diagnostic, /-Djava\.awt\.headless=false/u);
  assert.match(
    diagnostic,
    new RegExp(`JAVA_HOME=<set:length=${javaHome.length}>`, 'u')
  );
  assert.match(
    diagnostic,
    new RegExp(`JAVA_TOOL_OPTIONS=<set:length=${javaToolOptions.length}>`, 'u')
  );
  assert.match(diagnostic, /JDK_JAVA_OPTIONS=<unset>/u);
  assert.match(diagnostic, /COMMODORE_COMMANDER_JAVA_RUNTIME=<unset>/u);
  assert.doesNotMatch(diagnostic, /secret-token/u);
  assert.doesNotMatch(diagnostic, /proxyPassword/u);
});

test('SIDScore launch command formatting quotes paths with spaces', () => {
  assert.equal(
    formatCommandLine('/usr/bin/java', ['-jar', '/Applications/Commodore Commander/sidscore-cli.jar']),
    "/usr/bin/java -jar '/Applications/Commodore Commander/sidscore-cli.jar'"
  );
});
