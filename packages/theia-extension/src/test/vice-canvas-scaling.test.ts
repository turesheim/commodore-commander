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

test('VICE canvas scaling uses the largest integer scale that fits', () => {
  assert.deepEqual(
    calculateViceCanvasDisplaySize(320, 200, 900, 700),
    {
      width: 640,
      height: 400,
      scale: 2
    }
  );
});

test('VICE canvas scaling ignores incomplete frame or viewport sizes', () => {
  assert.equal(calculateViceCanvasDisplaySize(0, 200, 900, 700), undefined);
  assert.equal(calculateViceCanvasDisplaySize(320, 200, 0, 700), undefined);
});
