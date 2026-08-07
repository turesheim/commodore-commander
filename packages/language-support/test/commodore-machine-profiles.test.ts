import assert from 'node:assert/strict';
import { constants, existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  COMMODORE_MACHINE_PROFILES,
  COMMODORE_MACHINE_PROFILE_IDS,
  DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
  getCommodoreViceModel,
  getCommodoreMachineProfile,
  getViceExecutableForMachineProfile,
  isCommodoreViceModelForMachineProfile,
  resolveCommodoreMachineProfileId
} from '../src/machines/commodore-machine-profiles.ts';

const expectedProfileIds = [
  'c64',
  'c128',
  'vic20',
  'plus4',
  'c16',
  'pet',
  'cbm2',
  'cbm5x0',
  'c64dtv'
] as const;

type ViceVideoChipName = 'VICII' | 'TED' | 'VIC' | 'VDC' | 'Crtc';

function expectedPlainViceVideoArgs(
  ...chips: readonly ViceVideoChipName[]
): string[] {
  const args: string[] = [];
  for (const chip of chips) {
    args.push(
      `+${chip}dsize`,
      `+${chip}dscan`,
      `-${chip}filter`,
      '0',
      `-${chip}glfilter`,
      '0'
    );
    if (chip === 'VDC') {
      args.push('+VDCstretchvertical');
    } else if (chip === 'Crtc') {
      args.push('+CRTCstretchvertical');
    }
  }
  return args;
}

test('Commodore machine profile registry covers the initial machine range', () => {
  assert.deepEqual(COMMODORE_MACHINE_PROFILE_IDS, expectedProfileIds);
  assert.equal(COMMODORE_MACHINE_PROFILES.length, expectedProfileIds.length);
  assert.equal(DEFAULT_COMMODORE_MACHINE_PROFILE_ID, 'c64');

  const uniqueIds = new Set(COMMODORE_MACHINE_PROFILES.map((profile) => profile.id));
  assert.equal(uniqueIds.size, COMMODORE_MACHINE_PROFILES.length);
});

test('Commodore machine profiles provide required editor/runtime facts', () => {
  for (const profile of COMMODORE_MACHINE_PROFILES) {
    assert.equal(profile.displayName.length > 0, true, profile.id);
    assert.equal(profile.cpu.primary.length > 0, true, profile.id);
    assert.equal(profile.cpu.instructionSet.length > 0, true, profile.id);
    assert.equal(profile.cpu.clock.length > 0, true, profile.id);

    assert.equal(profile.memoryMaps.length > 0, true, profile.id);
    assert.equal(
      profile.memoryMaps.every((memoryMap) => memoryMap.regions.length > 0),
      true,
      profile.id
    );
    for (const memoryMap of profile.memoryMaps) {
      for (const region of memoryMap.regions) {
        assert.equal(region.start <= region.end, true, `${profile.id}:${region.name}`);
      }
    }

    assert.equal(profile.ioRegisters.length > 0, true, profile.id);
    assert.equal(profile.roms.length > 0, true, profile.id);
    assert.equal(
      profile.romSymbols.some((symbol) => symbol.module === 'basic'),
      true,
      `${profile.id}: missing BASIC symbols`
    );
    assert.equal(
      profile.romSymbols.some((symbol) => symbol.module === 'kernal'),
      true,
      `${profile.id}: missing KERNAL symbols`
    );
    assert.equal(profile.zeroPage.length > 0, true, profile.id);
    assert.equal(profile.screenLayouts.length > 0, true, profile.id);
    assert.equal(profile.characterSets.length > 0, true, profile.id);
    assert.equal(profile.bankSwitching.length > 0, true, profile.id);
    assert.match(profile.vice.executable, /^x/u, profile.id);
    assert.equal(profile.vice.resourceDirectory.length > 0, true, profile.id);
    assert.equal(profile.vice.models?.length ? true : false, true, profile.id);
    assert.equal(
      profile.vice.models?.some((model) => model.id === profile.vice.defaultModel),
      true,
      profile.id
    );
    assert.equal(profile.sourceNotes.length > 0, true, profile.id);
  }
});

test('Commodore machine profile aliases resolve editor and VICE names', () => {
  assert.equal(resolveCommodoreMachineProfileId('Commodore 64'), 'c64');
  assert.equal(resolveCommodoreMachineProfileId('x64sc'), 'c64');
  assert.equal(resolveCommodoreMachineProfileId('C-128'), 'c128');
  assert.equal(resolveCommodoreMachineProfileId('VIC 20'), 'vic20');
  assert.equal(resolveCommodoreMachineProfileId('plus/4'), 'plus4');
  assert.equal(resolveCommodoreMachineProfileId('C64 DTV'), 'c64dtv');
  assert.equal(resolveCommodoreMachineProfileId('unknown'), undefined);
});

test('Commodore machine profile VICE metadata maps shared executables and model args', () => {
  assert.equal(getViceExecutableForMachineProfile('c64'), 'x64sc');
  assert.deepEqual(
    getCommodoreMachineProfile('c64').vice.defaultArgs,
    expectedPlainViceVideoArgs('VICII')
  );
  assert.deepEqual(
    getCommodoreMachineProfile('c128').vice.defaultArgs,
    expectedPlainViceVideoArgs('VICII', 'VDC')
  );
  assert.deepEqual(
    getCommodoreMachineProfile('vic20').vice.defaultArgs,
    expectedPlainViceVideoArgs('VIC')
  );
  assert.deepEqual(getCommodoreMachineProfile('plus4').vice.defaultArgs, [
    ...expectedPlainViceVideoArgs('TED'),
    '-model',
    'plus4'
  ]);
  assert.equal(getViceExecutableForMachineProfile('c16'), 'xplus4');
  assert.deepEqual(getCommodoreMachineProfile('c16').vice.defaultArgs, [
    ...expectedPlainViceVideoArgs('TED'),
    '-model',
    'c16'
  ]);
  assert.equal(getViceExecutableForMachineProfile('pet'), 'xpet');
  assert.deepEqual(getCommodoreMachineProfile('pet').vice.defaultArgs, [
    ...expectedPlainViceVideoArgs('Crtc'),
    '-model',
    '8032'
  ]);
  assert.equal(getViceExecutableForMachineProfile('cbm2'), 'xcbm2');
  assert.deepEqual(getCommodoreMachineProfile('cbm2').vice.defaultArgs, [
    ...expectedPlainViceVideoArgs('Crtc'),
    '-model',
    '610'
  ]);
  assert.equal(getViceExecutableForMachineProfile('cbm5x0'), 'xcbm5x0');
  assert.deepEqual(getCommodoreMachineProfile('cbm5x0').vice.defaultArgs, [
    ...expectedPlainViceVideoArgs('VICII'),
    '-model',
    '510'
  ]);
  assert.deepEqual(
    getCommodoreMachineProfile('c64dtv').vice.defaultArgs,
    expectedPlainViceVideoArgs('VICII')
  );
  assert.equal(getCommodoreMachineProfile('c64').vice.defaultModel, 'c64');
  assert.equal(getCommodoreViceModel('plus4', 'plus4ntsc')?.displayName, 'Plus/4 NTSC');
  assert.equal(isCommodoreViceModelForMachineProfile('c64', 'c128dcr'), false);
});

const generatedViceBinRoot = process.env.COMMODORE_COMMANDER_VICE_BIN_ROOT
  ? path.resolve(process.env.COMMODORE_COMMANDER_VICE_BIN_ROOT)
  : fileURLToPath(
    new URL(
      '../../../tools/vice-embed/dist/darwin-arm64/VICE.app/Contents/Resources/bin/',
      import.meta.url
    )
  );

test('Commodore machine profile VICE executables exist in the generated patched runtime', {
  skip: existsSync(generatedViceBinRoot)
    ? false
    : 'run `make -C tools/vice-embed package` to generate the patched VICE runtime'
}, async () => {
  const executables = new Set(
    COMMODORE_MACHINE_PROFILES.map((profile) => profile.vice.executable)
  );

  for (const executable of executables) {
    await access(path.join(generatedViceBinRoot, executable), constants.X_OK);
  }
});
