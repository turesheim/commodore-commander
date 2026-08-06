import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SID_SFX_PRESETS,
  buildSidSfxSource,
  createSidSfxSettings,
  formatSidSfxHexWord,
  sanitizeSidSfxEffectName
} from '../common/sid-sfx-effect';

test('SID SFX source generator emits a playable effect block', () => {
  const source = buildSidSfxSource(createSidSfxSettings('blip'));

  assert.match(source, /^TITLE "Blip SFX"/u);
  assert.match(source, /\nEFFECT Blip \{\n/u);
  assert.match(source, /\n  VOICE ANY\n/u);
  assert.match(source, /\n  LENGTH 8 TICKS\n/u);
  assert.match(source, /\n  WAVE=TRI\n/u);
  assert.match(source, /\n  ADSR=0,2,12,1\n/u);
  assert.match(source, /\n  GATE=ON\n/u);
  assert.match(source, /\n  GATE=OFF @6\n/u);
});

test('SID SFX source generator sanitizes effect names', () => {
  assert.equal(sanitizeSidSfxEffectName('coin hit!'), 'CoinHit');
  assert.equal(sanitizeSidSfxEffectName('64 coin'), 'SFX64Coin');

  const settings = {
    ...createSidSfxSettings('blip'),
    name: 'coin hit!'
  };

  assert.match(buildSidSfxSource(settings), /\nEFFECT CoinHit \{\n/u);
});

test('SID SFX source generator uses sequence sweep syntax for pitch', () => {
  const source = buildSidSfxSource(createSidSfxSettings('laser'));

  assert.match(source, /\n  PITCH=C7\n/u);
  assert.match(source, /\n  PITCH C7 TO C3 @24 EXP\n/u);
  assert.doesNotMatch(source, /\n  PITCH C7 TO C3 AT 24/u);
});

test('SID SFX source generator emits pulse width sweeps only for pulse effects', () => {
  const laser = buildSidSfxSource(createSidSfxSettings('laser'));
  const blip = buildSidSfxSource(createSidSfxSettings('blip'));

  assert.match(laser, /\n  PW=\$0800\n/u);
  assert.match(laser, /\n  PW \$0800 TO \$0100 @24 LINEAR\n/u);
  assert.doesNotMatch(blip, /\n  PW=/u);
});

test('SID SFX source generator clamps values to SID/player ranges', () => {
  const source = buildSidSfxSource({
    ...createSidSfxSettings('pickup'),
    lengthTicks: 999,
    gateOffTick: 999,
    attack: 99,
    decay: -4,
    sustain: 16,
    release: 9,
    pulseWidth: -1,
    pulseEnd: 0xffff
  });

  assert.match(source, /\n  LENGTH 255 TICKS\n/u);
  assert.match(source, /\n  ADSR=15,0,15,9\n/u);
  assert.match(source, /\n  PW=\$0000\n/u);
  assert.match(source, /\n  PW \$0000 TO \$0FFF @255 LINEAR\n/u);
  assert.match(source, /\n  GATE=OFF @255\n/u);
  assert.equal(formatSidSfxHexWord(0x12345), '$0FFF');
});

test('SID SFX source generator emits scripted complex preset steps', () => {
  const powerUp = buildSidSfxSource(createSidSfxSettings('powerUp'));
  const teleport = buildSidSfxSource(createSidSfxSettings('teleport'));
  const rumble = buildSidSfxSource(createSidSfxSettings('rumble'));

  assert.match(powerUp, /\n  PITCH=E4 @4\n/u);
  assert.match(powerUp, /\n  PW=\$0400 @12\n/u);
  assert.match(teleport, /\n  WAVE=SAW @8\n/u);
  assert.match(teleport, /\n  VOLUME=9 @32\n/u);
  assert.match(rumble, /\n  FREQ=\$5000\n/u);
  assert.match(rumble, /\n  FREQ=\$0C00 @36\n/u);
});

test('SID SFX source generator keeps frequency effects separate from pitch', () => {
  const rumble = buildSidSfxSource(createSidSfxSettings('rumble'));
  const engineStart = buildSidSfxSource(createSidSfxSettings('engineStart'));

  assert.doesNotMatch(rumble, /\n  PITCH=/u);
  assert.doesNotMatch(engineStart, /\n  PITCH=/u);
  assert.match(engineStart, /\n  FREQ=\$0400\n/u);
  assert.match(engineStart, /\n  FREQ=\$2200 @38\n/u);
});

test('SID SFX source generator emits additional complex preset steps', () => {
  const coinCascade = buildSidSfxSource(createSidSfxSettings('coinCascade'));
  const shield = buildSidSfxSource(createSidSfxSettings('shield'));
  const zapBurst = buildSidSfxSource(createSidSfxSettings('zapBurst'));

  assert.match(coinCascade, /\n  PITCH=C8 @18\n/u);
  assert.match(coinCascade, /\n  VOLUME=11 @22\n/u);
  assert.match(shield, /\n  WAVE=TRI @18\n/u);
  assert.match(shield, /\n  PW=\$0800 @10\n/u);
  assert.match(zapBurst, /\n  ADSR=0,5,4,4 @15\n/u);
  assert.match(zapBurst, /\n  WAVE=SAW @5\n/u);
});

test('SID SFX preset catalog includes expanded complex effects', () => {
  const presetIds = SID_SFX_PRESETS.map((preset) => preset.id);
  const expectedPresetIds = [
    'bossHit',
    'doorOpen',
    'doorClose',
    'footstep',
    'splash',
    'magicCast',
    'warpDown',
    'confirmChord',
    'errorBuzz',
    'typeClick',
    'missileLaunch',
    'powerDrain'
  ] as const;

  assert.deepEqual(
    expectedPresetIds.filter((presetId) => !presetIds.includes(presetId)),
    []
  );
});

test('SID SFX source generator emits expanded complex preset steps', () => {
  const bossHit = buildSidSfxSource(createSidSfxSettings('bossHit'));
  const magicCast = buildSidSfxSource(createSidSfxSettings('magicCast'));
  const warpDown = buildSidSfxSource(createSidSfxSettings('warpDown'));
  const missileLaunch = buildSidSfxSource(createSidSfxSettings('missileLaunch'));

  assert.match(bossHit, /\n  FREQ=\$7000\n/u);
  assert.match(bossHit, /\n  FREQ=\$1400 @18\n/u);
  assert.match(magicCast, /\n  WAVE=TRI @18\n/u);
  assert.match(magicCast, /\n  PITCH=C6 @36\n/u);
  assert.match(warpDown, /\n  WAVE=NOISE @30\n/u);
  assert.match(missileLaunch, /\n  FREQ=\$4A00 @42\n/u);
});

test('SID SFX source generator omits note pitch for frequency-driven presets', () => {
  const frequencyPresetIds = [
    'rumble',
    'engineStart',
    'bossHit',
    'doorOpen',
    'doorClose',
    'footstep',
    'splash',
    'typeClick',
    'missileLaunch'
  ] as const;

  for (const presetId of frequencyPresetIds) {
    assert.doesNotMatch(
      buildSidSfxSource(createSidSfxSettings(presetId)),
      /\n  PITCH=/u,
      presetId
    );
  }
});
