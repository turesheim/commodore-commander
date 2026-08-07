import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateViceCanvasDisplaySize
} from '../browser/vice-canvas-scaling';

test('VICE canvas scaling keeps narrow 80-column frames at native size', () => {
  assert.deepEqual(
    calculateViceCanvasDisplaySize(640, 250, 614, 460),
    {
      width: 640,
      height: 250,
      scale: 1
    }
  );
});

test('VICE canvas scaling fills available space when upscaling readable frames', () => {
  assert.deepEqual(
    calculateViceCanvasDisplaySize(320, 200, 900, 700),
    {
      width: 900,
      height: 563,
      scale: 2.8125
    }
  );
});

test('VICE canvas scaling fills the machine view without integer-step gaps', () => {
  assert.deepEqual(
    calculateViceCanvasDisplaySize(384, 272, 907, 668),
    {
      width: 907,
      height: 642,
      scale: 907 / 384
    }
  );
});

test('VICE canvas scaling keeps small native frames readable when height is constrained', () => {
  assert.deepEqual(
    calculateViceCanvasDisplaySize(352, 266, 695, 409),
    {
      width: 704,
      height: 532,
      scale: 2
    }
  );
});

test('VICE canvas scaling ignores incomplete frame or viewport sizes', () => {
  assert.equal(calculateViceCanvasDisplaySize(0, 200, 900, 700), undefined);
  assert.equal(calculateViceCanvasDisplaySize(320, 200, 0, 700), undefined);
});
