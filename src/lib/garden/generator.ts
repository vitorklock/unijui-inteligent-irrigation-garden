import { Garden } from "./types";

export interface GenerateGardenParams {
  width: number;
  height: number;
  pillarDensity: number;       // 0–1
  plantChanceNearPath: number; // 0–1
  seed: number;
}

const DEFAULT_OPTIONS: Required<GenerateGardenParams> = {
  width: 30,
  height: 20,
  pillarDensity: 0.04,
  plantChanceNearPath: 0.25,
  seed: 42,
};

// simple PRNG for optional reproducibility
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateGarden(
  options?: Partial<GenerateGardenParams>
): Garden {
  const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  const rand = mulberry32(opts.seed);

  const { width, height } = opts;
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);

  // ---- 1. initialize all soil (full rectangle) ----
  const tiles: Garden.Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Garden.Tile[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        type: "soil",
        hasPlant: false,
        moisture: 0,
      });
    }
    tiles.push(row);
  }

  const inBounds = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height;

  // ---- 2. softly erode corners & edges to give the garden a shape ----

  // Helper: erode one corner with a small diagonal bite
  const erodeCorner = (
    corner: "tl" | "tr" | "bl" | "br",
    probability = 0.8
  ) => {
    if (rand() > probability) return;

    const maxSize = Math.max(2, Math.floor(Math.min(width, height) / 5)); // not too big
    const size = 2 + Math.floor(rand() * (maxSize - 1)); // 2..maxSize

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        // diagonal-ish shape: only some of that square
        if (dx + dy >= size) continue;

        let gx = dx;
        let gy = dy;

        if (corner === "tr") {
          gx = width - 1 - dx;
          gy = dy;
        } else if (corner === "bl") {
          gx = dx;
          gy = height - 1 - dy;
        } else if (corner === "br") {
          gx = width - 1 - dx;
          gy = height - 1 - dy;
        }

        if (inBounds(gx, gy)) {
          tiles[gy][gx].type = "pillar";
        }
      }
    }
  };

  // Erode 0–4 corners
  erodeCorner("tl");
  erodeCorner("tr");
  erodeCorner("bl");
  erodeCorner("br");

  // Helper: small "bite" in an edge segment
  const erodeEdge = (side: "top" | "bottom" | "left" | "right") => {
    if (rand() > 0.5) return; // maybe no bite on this side

    const maxDepth = Math.max(1, Math.floor(Math.min(width, height) / 10));
    const depth = 1 + Math.floor(rand() * maxDepth); // 1..maxDepth

    if (side === "top" || side === "bottom") {
      const span = Math.max(3, Math.floor(width * 0.2));
      const startX = Math.floor(rand() * (width - span));
      const endX = startX + span;

      for (let x = startX; x < endX; x++) {
        for (let d = 0; d < depth; d++) {
          const y = side === "top" ? d : height - 1 - d;
          if (!inBounds(x, y)) continue;
          tiles[y][x].type = "pillar";
        }
      }
    } else {
      const span = Math.max(3, Math.floor(height * 0.2));
      const startY = Math.floor(rand() * (height - span));
      const endY = startY + span;

      for (let y = startY; y < endY; y++) {
        for (let d = 0; d < depth; d++) {
          const x = side === "left" ? d : width - 1 - d;
          if (!inBounds(x, y)) continue;
          tiles[y][x].type = "pillar";
        }
      }
    }
  };

  erodeEdge("top");
  erodeEdge("bottom");
  erodeEdge("left");
  erodeEdge("right");

  const setType = (x: number, y: number, type: Garden.Tile.Type) => {
    if (!inBounds(x, y)) return;
    const tile = tiles[y][x];
    // don't carve paths/sources into "missing" garden (pillars)
    if (tile.type === "pillar") return;
    tile.type = type;
  };

  // ---- 3. carve main cross path (but respecting eroded areas) ----
  for (let y = 0; y < height; y++) {
    setType(midX, y, "path");
  }
  for (let x = 0; x < width; x++) {
    setType(x, midY, "path");
  }

  // ---- 4. random side paths from the main cross ----
  const sideBranchCount = 6;
  for (let i = 0; i < sideBranchCount; i++) {
    const fromVertical = rand() < 0.5;
    if (fromVertical) {
      const y = Math.floor(rand() * height);
      const direction = rand() < 0.5 ? -1 : 1;
      let x = midX;
      const length = Math.floor(width * (0.2 + rand() * 0.3));
      for (let step = 0; step < length; step++) {
        x += direction;
        if (!inBounds(x, y)) break;
        setType(x, y, "path");
      }
    } else {
      const x = Math.floor(rand() * width);
      const direction = rand() < 0.5 ? -1 : 1;
      let y = midY;
      const length = Math.floor(height * (0.2 + rand() * 0.3));
      for (let step = 0; step < length; step++) {
        y += direction;
        if (!inBounds(x, y)) break;
        setType(x, y, "path");
      }
    }
  }

  // ---- 5. sprinkle some pillars (obstacles) on soil tiles (interior) ----
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      // only convert remaining soil (don't override paths)
      if (tile.type === "soil" && rand() < opts.pillarDensity) {
        tile.type = "pillar";
      }
    }
  }

  // ---- 6. plant clusters near paths ----
  const neighbors4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  const isNearPath = (x: number, y: number): boolean => {
    return neighbors4.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) return false;
      return (
        tiles[ny][nx].type === "path" ||
        tiles[ny][nx].type === "water_source"
      );
    });
  };

  const plantCandidates: Garden.Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (tile.type === "soil" && isNearPath(x, y)) {
        plantCandidates.push(tile);
      }
    }
  }

  const baseClusterCount = Math.max(
    3,
    Math.floor(
      plantCandidates.length * opts.plantChanceNearPath * 0.12
    )
  );
  const clusterCount = baseClusterCount + Math.floor(rand() * 3);

  const pickRandomTile = (arr: Garden.Tile[]) =>
    arr[Math.floor(rand() * arr.length)];

  for (let i = 0; i < clusterCount && plantCandidates.length > 0; i++) {
    const center = pickRandomTile(plantCandidates);
    const radius = 2 + Math.floor(rand() * 2); // 2–3

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = center.x + dx;
        const ny = center.y + dy;
        if (!inBounds(nx, ny)) continue;

        const t = tiles[ny][nx];
        if (t.type !== "soil") continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        const maxProb = 0.9;
        const minProb = 0.25;
        const factor = 1 - dist / radius;
        const clusterProb = minProb + (maxProb - minProb) * factor;

        if (rand() < clusterProb) {
          t.hasPlant = true;
        }
      }
    }
  }

  // Optional: a few isolated plants
  for (let i = 0; i < plantCandidates.length; i++) {
    const tile = plantCandidates[i];
    if (!tile.hasPlant && rand() < opts.plantChanceNearPath * 0.2) {
      tile.hasPlant = true;
    }
  }

  // ---- 7. water sources on borders where paths touch the edge ----
  const topCandidates: Garden.Tile[] = [];
  const bottomCandidates: Garden.Tile[] = [];
  const leftCandidates: Garden.Tile[] = [];
  const rightCandidates: Garden.Tile[] = [];

  for (let x = 0; x < width; x++) {
    if (tiles[0][x].type === "path") topCandidates.push(tiles[0][x]);
    if (tiles[height - 1][x].type === "path")
      bottomCandidates.push(tiles[height - 1][x]);
  }

  for (let y = 0; y < height; y++) {
    if (tiles[y][0].type === "path") leftCandidates.push(tiles[y][0]);
    if (tiles[y][width - 1].type === "path")
      rightCandidates.push(tiles[y][width - 1]);
  }

  const pickRandom = (arr: Garden.Tile[]) =>
    arr.length ? arr[Math.floor(rand() * arr.length)] : undefined;

  const top = pickRandom(topCandidates);
  const bottom = pickRandom(bottomCandidates);
  const left = pickRandom(leftCandidates);
  const right = pickRandom(rightCandidates);

  if (top) top.type = "water_source";
  if (bottom) bottom.type = "water_source";
  if (left) left.type = "water_source";
  if (right) right.type = "water_source";

  return {
    width,
    height,
    tiles,
    hoses: [],
  };
}
