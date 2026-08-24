import FFT = require('fft.js');

export const SID_SCORE_SPECTROGRAM_FFT_SIZE = 2048;
export const SID_SCORE_SPECTROGRAM_HOP_SIZE = 256;
export const SID_SCORE_SPECTROGRAM_HEIGHT = 96;
export const SID_SCORE_SPECTROGRAM_MIN_FREQUENCY = 50;
export const SID_SCORE_SPECTROGRAM_MIN_DECIBELS = -96;
export const SID_SCORE_SPECTROGRAM_MAX_DECIBELS = 0;

export interface SidScoreSpectrogramOptions {
  readonly fftSize?: number;
  readonly hopSize?: number;
  readonly height?: number;
  readonly minFrequency?: number;
  readonly minDecibels?: number;
  readonly maxDecibels?: number;
}

export interface SidScoreSpectrogram {
  readonly width: number;
  readonly height: number;
  readonly intensities: Float32Array;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly minDecibels: number;
  readonly maxDecibels: number;
  readonly timeSpanSeconds: number;
}

export function createSidScoreSpectrogram(
  samples: readonly number[],
  sampleRate: number,
  options: SidScoreSpectrogramOptions = {}
): SidScoreSpectrogram {
  const fftSize = options.fftSize ?? SID_SCORE_SPECTROGRAM_FFT_SIZE;
  const hopSize = options.hopSize ?? SID_SCORE_SPECTROGRAM_HOP_SIZE;
  const height = options.height ?? SID_SCORE_SPECTROGRAM_HEIGHT;
  const minDecibels =
    options.minDecibels ?? SID_SCORE_SPECTROGRAM_MIN_DECIBELS;
  const maxDecibels =
    options.maxDecibels ?? SID_SCORE_SPECTROGRAM_MAX_DECIBELS;
  const requestedMinFrequency =
    options.minFrequency ?? SID_SCORE_SPECTROGRAM_MIN_FREQUENCY;
  validateOptions(
    fftSize,
    hopSize,
    height,
    sampleRate,
    requestedMinFrequency,
    minDecibels,
    maxDecibels
  );

  const maxFrequency = sampleRate / 2;
  const minFrequency = Math.max(
    sampleRate / fftSize,
    Math.min(requestedMinFrequency, maxFrequency / 2)
  );
  if (samples.length === 0) {
    return {
      width: 0,
      height,
      intensities: new Float32Array(0),
      minFrequency,
      maxFrequency,
      minDecibels,
      maxDecibels,
      timeSpanSeconds: 0
    };
  }

  const frameCount = samples.length <= fftSize
    ? 1
    : Math.floor((samples.length - fftSize) / hopSize) + 1;
  const coveredSamples = fftSize + (frameCount - 1) * hopSize;
  const firstFrameStart = samples.length - coveredSamples;
  const intensities = new Float32Array(frameCount * height);
  const window = createHannWindow(fftSize);
  const windowSum = window.reduce((sum, value) => sum + value, 0);
  const fft = new FFT(fftSize);
  const input = new Array<number>(fftSize).fill(0);
  const spectrum = fft.createComplexArray() as number[];
  const magnitudes = new Float64Array(fftSize / 2 + 1);

  for (let column = 0; column < frameCount; column += 1) {
    const frameStart = firstFrameStart + column * hopSize;
    for (let index = 0; index < fftSize; index += 1) {
      const sourceIndex = frameStart + index;
      input[index] =
        sourceIndex >= 0 && sourceIndex < samples.length
          ? (samples[sourceIndex] ?? 0) * (window[index] ?? 0)
          : 0;
    }

    fft.realTransform(spectrum, input);
    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      const real = spectrum[bin * 2] ?? 0;
      const imaginary = spectrum[bin * 2 + 1] ?? 0;
      const oneSidedScale = bin === 0 || bin === fftSize / 2 ? 1 : 2;
      magnitudes[bin] =
        oneSidedScale * Math.hypot(real, imaginary) / windowSum;
    }

    for (let row = 0; row < height; row += 1) {
      const frequency = frequencyForSpectrogramRow(
        row,
        height,
        minFrequency,
        maxFrequency
      );
      const magnitude = interpolateMagnitude(
        magnitudes,
        frequency * fftSize / sampleRate
      );
      const decibels = 20 * Math.log10(Math.max(magnitude, 1e-12));
      intensities[row * frameCount + column] = clamp01(
        (decibels - minDecibels) / (maxDecibels - minDecibels)
      );
    }
  }

  return {
    width: frameCount,
    height,
    intensities,
    minFrequency,
    maxFrequency,
    minDecibels,
    maxDecibels,
    timeSpanSeconds: coveredSamples / sampleRate
  };
}

export function frequencyForSpectrogramRow(
  row: number,
  height: number,
  minFrequency: number,
  maxFrequency: number
): number {
  if (height <= 1) {
    return maxFrequency;
  }
  const position = Math.max(0, Math.min(1, row / (height - 1)));
  return maxFrequency * Math.pow(minFrequency / maxFrequency, position);
}

export function spectrogramRowForFrequency(
  frequency: number,
  height: number,
  minFrequency: number,
  maxFrequency: number
): number {
  if (height <= 1 || frequency >= maxFrequency) {
    return 0;
  }
  if (frequency <= minFrequency) {
    return Math.max(0, height - 1);
  }
  const position =
    Math.log(frequency / maxFrequency) /
    Math.log(minFrequency / maxFrequency);
  return position * (height - 1);
}

function createHannWindow(size: number): readonly number[] {
  return Array.from(
    { length: size },
    (_value, index) =>
      0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)))
  );
}

function interpolateMagnitude(
  magnitudes: Float64Array,
  binPosition: number
): number {
  const lower = Math.max(
    0,
    Math.min(magnitudes.length - 1, Math.floor(binPosition))
  );
  const upper = Math.min(magnitudes.length - 1, lower + 1);
  const fraction = Math.max(0, Math.min(1, binPosition - lower));
  return (
    (magnitudes[lower] ?? 0) * (1 - fraction) +
    (magnitudes[upper] ?? 0) * fraction
  );
}

function validateOptions(
  fftSize: number,
  hopSize: number,
  height: number,
  sampleRate: number,
  minFrequency: number,
  minDecibels: number,
  maxDecibels: number
): void {
  if (
    !Number.isInteger(fftSize) ||
    fftSize <= 1 ||
    (fftSize & (fftSize - 1)) !== 0
  ) {
    throw new RangeError('Spectrogram FFT size must be a power of two.');
  }
  if (!Number.isInteger(hopSize) || hopSize <= 0 || hopSize > fftSize) {
    throw new RangeError('Spectrogram hop size must be between 1 and FFT size.');
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError('Spectrogram height must be a positive integer.');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('Spectrogram sample rate must be positive.');
  }
  if (!Number.isFinite(minFrequency) || minFrequency <= 0) {
    throw new RangeError('Spectrogram minimum frequency must be positive.');
  }
  if (
    !Number.isFinite(minDecibels) ||
    !Number.isFinite(maxDecibels) ||
    maxDecibels <= minDecibels
  ) {
    throw new RangeError(
      'Spectrogram maximum decibels must exceed minimum decibels.'
    );
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
