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
  const scale = Math.max(1, Math.floor(fitScale));

  return {
    width: frameWidth * scale,
    height: frameHeight * scale,
    scale
  };
}
