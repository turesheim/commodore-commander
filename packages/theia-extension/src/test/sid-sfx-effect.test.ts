import test from 'node:test';
import assert from 'node:assert/strict';

import {
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
  assert.match(rumble, /\n  FREQ=\$5000 @0\n/u);
  assert.match(rumble, /\n  FREQ=\$0C00 @36\n/u);
});
