export interface ViceCanvasDisplaySize {
  width: number;
  height: number;
  scale: number;
}

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
  const scale = fitScale;

  return {
    width: Math.max(1, Math.round(frameWidth * scale)),
    height: Math.max(1, Math.round(frameHeight * scale)),
    scale
  };
}
