import { Garden } from "./types";

export interface GenerateGardenParams {
    width: number
    height: number
    pillarDensity: number       // 0–1
    plantChanceNearPath: number // 0–1
    seed: number
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

export function generateGarden(options?: Partial<GenerateGardenParams>): Garden {
    const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
    const rand = mulberry32(opts.seed);

    const { width, height } = opts;

    // 1. initialize all soil
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

    // Helper to safely access tiles
    const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height;

    const setType = (x: number, y: number, type: Garden.Tile.Type) => {
        if (!inBounds(x, y)) return;
        tiles[y][x].type = type;
    };

    // 2. carve a simple cross path (one vertical, one horizontal)
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);

    for (let y = 0; y < height; y++) {
        setType(midX, y, "path");
    }
    for (let x = 0; x < width; x++) {
        setType(x, midY, "path");
    }

    // 3. add some random side paths from the main cross
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

    // 4. sprinkle some pillars (obstacles) on soil tiles
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            if (tile.type === "soil" && rand() < opts.pillarDensity) {
                tile.type = "pillar";
            }
        }
    }

    // Helper: check if any neighbor is path
    const neighbors4 = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];

    const isNearPath = (x: number, y: number): boolean => {
        return neighbors4.some(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (!inBounds(nx, ny)) return false;
            return tiles[ny][nx].type === "path";
        });
    };

    // 5. place plants near paths
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            if (tile.type === "soil" && isNearPath(x, y)) {
                if (rand() < opts.plantChanceNearPath) {
                    tile.hasPlant = true;
                }
            }
        }
    }

    // 6. place water sources on borders, attached to paths
    // e.g. 3 sources: top, bottom, left or right
    const maybePlaceSource = (x: number, y: number) => {
        if (!inBounds(x, y)) return;
        const tile = tiles[y][x];
        if (tile.type === "path") {
            tile.type = "water_source";
        }
    };

    // find some candidate path tiles on edges
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
    };
}
