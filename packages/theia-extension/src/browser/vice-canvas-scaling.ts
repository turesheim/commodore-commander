export interface ViceCanvasDisplaySize {
  width: number;
  height: number;
  scale: number;
}

const MIN_READABLE_FRAME_WIDTH = 640;
const MIN_READABLE_FRAME_SCALE = 2;

export function calculateViceCanvasDisplaySize(
  frameWidth: number,
  frameHeight: number,
  availableWidth: number,
  availableHeight: number
): ViceCanvasDisplaySize | undefined {
  if (
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return undefined;
  }

  const fitScale = Math.min(
    availableWidth / frameWidth,
    availableHeight / frameHeight
  );
  const fittingScale = Math.max(1, Math.floor(fitScale));
  const readableScale = frameWidth < MIN_READABLE_FRAME_WIDTH
    ? MIN_READABLE_FRAME_SCALE
    : 1;
  const scale = Math.max(fittingScale, readableScale);

  return {
    width: frameWidth * scale,
    height: frameHeight * scale,
    scale
  };
}
