import type { SVGProps } from "react";

/**
 * Pixel illustrations from the arcade mockups, drawn on a grid: "#" is a filled pixel.
 * Decorative by default (aria-hidden); colour comes from `currentColor`.
 */
function fromRows(rows: readonly string[]) {
  const rects: { x: number; y: number; w: number }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      let w = 0;
      while (row[x + w] === "#") w += 1;
      rects.push({ x, y, w });
      x += w;
    }
  });
  return { rects, width: Math.max(...rows.map((r) => r.length)), height: rows.length };
}

function pixelArt(name: string, rows: readonly string[]) {
  const { rects, width, height } = fromRows(rows);
  function Art(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        fill="currentColor"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {rects.map(({ x, y, w }) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} />
        ))}
      </svg>
    );
  }
  Art.displayName = name;
  return Art;
}

export const PixelHeadphones = pixelArt("PixelHeadphones", [
  "...######...",
  "...######...",
  ".##......##.",
  ".##......##.",
  "##........##",
  "##........##",
  "####....####",
  ".###....###.",
  ".###....###.",
]);

export const PixelPin = pixelArt("PixelPin", [
  ".#####.",
  "#######",
  "#######",
  "#######",
  ".#####.",
  "..###..",
  "...#...",
]);

export const PixelNote = pixelArt("PixelNote", [
  "..######",
  "..######",
  "..#....#",
  "..#....#",
  "..#....#",
  "###..###",
  "###..###",
]);

export const PixelBlob = pixelArt("PixelBlob", [
  "....##....",
  "...####...",
  ".#######..",
  "##########",
  ".#########",
  "##########",
  "..######..",
  "...####...",
  "....##....",
]);

export const PixelSquare = pixelArt("PixelSquare", ["####", "####", "####", "####"]);
