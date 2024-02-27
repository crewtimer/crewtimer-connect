/**
 * Draws text on the canvas with specified alignment and position relative to a horizontal line.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {string} text - The text to be drawn.
 * @param {number} fontSize - The size of text to be drawn.
 * @param {number} x - The x-coordinate for the text placement.
 * @param {number} y - The y-coordinate for the horizontal line around which the text is aligned.
 * @param {'above' | 'below' | 'center'} position - The position of the text relative to the horizontal line ('above', 'below', or 'center').
 * @param {'left' | 'center' | 'right'} align - The alignment of the text relative to the x-coordinate ('left', 'center', or 'right').
 */
export const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  x: number,
  y: number,
  position: 'above' | 'below' | 'center',
  align: 'left' | 'center' | 'right'
) => {
  ctx.font = `${Math.trunc(fontSize)}px Arial`;
  const textSize = ctx.measureText(text);
  const padding = 12;

  // Adjust X-Coordinate for Alignment
  let textX: number;
  let rectX: number;
  switch (align) {
    case 'center':
      textX = x - textSize.width / 2;
      break;
    case 'right':
      textX = x - textSize.width - padding / 2 - 2;
      break;
    default: // 'left'
      textX = x + padding / 2 + 2;
      break;
  }
  rectX = textX - padding / 2;

  // Adjust Y-Coordinate for Position
  let rectY: number;
  let textY: number;
  if (position === 'above') {
    rectY =
      y -
      textSize.actualBoundingBoxAscent -
      padding -
      padding / 2 -
      textSize.actualBoundingBoxDescent;
    textY = y - padding - textSize.actualBoundingBoxDescent;
  } else if (position === 'below') {
    rectY = y + padding / 2;
    textY = rectY + textSize.actualBoundingBoxAscent + padding / 2;
  } else {
    // 'center'
    rectY =
      y -
      (textSize.actualBoundingBoxAscent +
        textSize.actualBoundingBoxDescent +
        padding) /
        2;
    textY =
      y +
      (textSize.actualBoundingBoxAscent - textSize.actualBoundingBoxDescent) /
        2;
  }

  const rectWidth = textSize.width + padding;
  const rectHeight =
    textSize.actualBoundingBoxAscent +
    textSize.actualBoundingBoxDescent +
    padding;

  // Draw the background rectangle
  ctx.fillStyle = '#ffffff60';
  ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

  // Draw the text
  ctx.fillStyle = 'black';
  ctx.fillText(text, textX, textY);
};

// Define types for points and lines for better type checking and readability
export type Point = { x: number; y: number };
export type Line = { pt1: Point; pt2: Point };

/**
 * Finds the closest line to a given point and its position relative to the point.
 * Can filter the search based on whether the line should be above or below the point.
 *
 * @param point - The reference point to measure distance from.
 * @param lines - An array of lines to consider in the search.
 * @param desiredPosition - Specifies the desired position of the line relative to the point ('above', 'below', 'any').
 * @returns The closest line and its position relative to the point ('above', 'below', 'on').
 */
export function findClosestLineAndPosition(
  point: Point,
  lines: Line[],
  desiredPosition: 'above' | 'below' | 'any'
): { closestLine: number; position: string } {
  let minDistance = Number.MAX_VALUE;
  let closestLine: number = -1;
  let position: 'above' | 'below' | 'on' = 'on';

  lines.forEach((line, index) => {
    const currentLinePosition = pointPositionRelativeToLine(point, line);

    // Skip lines that do not match the desired position if it's specified as 'above' or 'below'
    if (desiredPosition !== 'any' && currentLinePosition !== desiredPosition) {
      return;
    }

    const distance = perpendicularDistance(point, line);
    if (distance < minDistance) {
      minDistance = distance;
      closestLine = index;
      position = currentLinePosition;
    }
  });

  return { closestLine, position };
}

/**
 * Calculates the perpendicular distance from a point to a line.
 *
 * @param point - The point from which to measure distance.
 * @param line - The line to measure distance to.
 * @returns The perpendicular distance from the point to the line.
 */
function perpendicularDistance(point: Point, line: Line): number {
  const { pt1, pt2 } = line;
  return (
    Math.abs(
      (pt2.x - pt1.x) * (pt1.y - point.y) - (pt1.x - point.x) * (pt2.y - pt1.y)
    ) / Math.sqrt((pt2.x - pt1.x) ** 2 + (pt2.y - pt1.y) ** 2)
  );
}

/**
 * Determines the position of a point relative to a line (above, below, or on the line).
 *
 * @param point - The point to check.
 * @param line - The line to compare against.
 * @returns A string indicating whether the point is 'above', 'below', or 'on' the line.
 */
function pointPositionRelativeToLine(
  point: Point,
  line: Line
): 'above' | 'below' | 'on' {
  const { pt1, pt2 } = line;
  const crossProduct =
    (pt2.x - pt1.x) * (point.y - pt1.y) - (pt2.y - pt1.y) * (point.x - pt1.x);

  if (crossProduct > 0) return 'below'; // Note for canvas y=0 is top
  else if (crossProduct < 0) return 'above';
  else return 'on';
}

// // Example usage
// const lines: Line[] = [
//     { pt1: { x: 0, y: 0 }, pt2: { x: 10, y: 10 } },
//     { pt1: { x: 5, y: 0 }, pt2: { x: 15, y: 10 } },
//     // Add more lines as needed
// ];
// const point: Point = { x: 5, y: 5 };
// const desiredPosition = 'above'; // Can be 'above', 'below', or 'any'

// const { closestLine, position } = findClosestLineAndPosition(point, lines, desiredPosition);
// if (closestLine) {
//     console.log(`Closest line: from (${closestLine.pt1.x},${closestLine.pt1.y}) to (${closestLine.pt2.x},${closestLine.pt2.y})`);
//     console.log(`Position: ${position}`);
// } else {
//     console.log('No line found matching the criteria.');
// }