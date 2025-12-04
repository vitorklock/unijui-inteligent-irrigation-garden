import { mulberry32, fisherYatesShuffle } from "../utils";
import { GARDEN_PATH_BRANCH_COUNT } from "./consts";
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

export function generateGarden(
    options?: Partial<GenerateGardenParams>
): Garden {
    const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
    const rand = mulberry32(opts.seed);

    const { width, height } = opts;
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);

    /**
     * Step 1: Initialize garden grid with all soil tiles
     * 
     * Creates a 2D array of tiles representing the entire garden area.
     * Each tile starts as "soil" type with no plants and zero moisture.
     * This forms the base canvas that will be modified in subsequent steps.
     */
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

    /**
     * Step 2: Soften garden edges and corners with erosion
     * 
     * Creates an irregular garden boundary by "biting" into corners and edges.
     * This makes the garden look more natural and less like a perfect rectangle.
     * Eroded areas are marked as "pillar" tiles to represent impassable terrain.
     */

    /**
     * Erodes a corner of the garden with a small diagonal bite.
     * Each corner has a chance to be eroded, creating a triangle-like notch.
     * The size of the erosion is random but bounded to maintain garden integrity.
     */
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

    // Apply erosion to all four corners with randomness
    erodeCorner("tl");
    erodeCorner("tr");
    erodeCorner("bl");
    erodeCorner("br");

    /**
     * Erodes an edge segment with a random bite indent.
     * Creates small notches along the top, bottom, left, or right edges.
     * This adds visual variety to the garden's perimeter.
     */
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

    // Apply random erosion to all four edges
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

    /**
     * Step 3: Carve main cross-shaped path network
     * 
     * Creates a primary navigation grid consisting of vertical and horizontal paths
     * that intersect at the garden center. This forms the main walking/access routes.
     * The path respects eroded pillar areas and won't overwrite them.
     */
    for (let y = 0; y < height; y++) {
        setType(midX, y, "path");
    }
    for (let x = 0; x < width; x++) {
        setType(x, midY, "path");
    }

    /**
     * Step 4: Create secondary branch paths from the main cross
     * 
     * Extends the path network with random branches that emanate from the main cross.
     * Each branch starts from a random point on either the vertical or horizontal axis,
     * extends in a random direction, and has a random length. This creates a more
     * complex, organic path layout for garden navigation.
     */
    for (let i = 0; i < GARDEN_PATH_BRANCH_COUNT; i++) {
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

    /**
     * Step 5: Scatter random obstacles (pillars) across the garden
     * 
     * Randomly converts some soil tiles into pillar obstacles based on the
     * pillarDensity parameter. This creates randomly distributed terrain features
     * that hoses must navigate around. Existing paths are never converted.
     */
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            // only convert remaining soil (don't override paths)
            if (tile.type === "soil" && rand() < opts.pillarDensity) {
                tile.type = "pillar";
            }
        }
    }

    /**
     * Step 6: Plant vegetation clusters near paths
     * 
     * This process creates plant placements focused on garden beds adjacent to paths.
     * First, it identifies all soil tiles that neighbor paths or water sources.
     * Then, it creates clustered plant groups centered around random candidate tiles,
     * with density decreasing from cluster centers. Finally, a small number of
     * isolated plants are scattered throughout for natural variation.
     */
    // Find soil tiles that are adjacent (4-directional) to paths or water sources
    const neighbors4 = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ] as const;

    /**
     * Checks if a tile is adjacent to any path or water source tile.
     * Uses 4-directional adjacency (up, down, left, right).
     */
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

    // Collect all soil tiles that neighbor paths (candidates for planting)
    const plantCandidates: Garden.Tile[] = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            if (tile.type === "soil" && isNearPath(x, y)) {
                plantCandidates.push(tile);
            }
        }
    }

    // Calculate how many plant clusters to create based on available candidates
    const baseClusterCount = Math.max(
        3,
        Math.floor(
            plantCandidates.length * opts.plantChanceNearPath * 0.12
        )
    );
    const clusterCount = baseClusterCount + Math.floor(rand() * 3);

    const pickRandomTile = (arr: Garden.Tile[]) =>
        arr[Math.floor(rand() * arr.length)];

    // Create clustered plant groups with radial density falloff
    for (let i = 0; i < clusterCount && plantCandidates.length > 0; i++) {
        const center = pickRandomTile(plantCandidates);
        const radius = 2 + Math.floor(rand() * 2); // 2–3 tiles radius

        // Place plants in a circular pattern around the cluster center
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = center.x + dx;
                const ny = center.y + dy;
                if (!inBounds(nx, ny)) continue;

                const t = tiles[ny][nx];
                if (t.type !== "soil") continue;

                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;

                // Probability decreases with distance from cluster center
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

    /**
     * Scatter additional isolated plants throughout path-adjacent areas
     * to add natural variation and prevent overly regular clustering.
     */
    for (let i = 0; i < plantCandidates.length; i++) {
        const tile = plantCandidates[i];
        if (!tile.hasPlant && rand() < opts.plantChanceNearPath * 0.2) {
            tile.hasPlant = true;
        }
    }

    /**
     * Step 7: Place water sources at border-edge path intersections
     * 
     * Water sources represent entry points for irrigation hoses into the garden.
     * They are placed only where paths reach the garden's outer edges, ensuring
     * hoses can be connected from external water supplies. The algorithm:
     * 1. Finds all path tiles on each of the four borders
     * 2. Randomly selects 2-4 of these boundary tiles to become water sources
     * 3. Uses Fisher-Yates shuffling to ensure unbiased selection
     */

    // Collect path tiles that touch each border edge
    const topCandidates: Garden.Tile[] = [];
    const bottomCandidates: Garden.Tile[] = [];
    const leftCandidates: Garden.Tile[] = [];
    const rightCandidates: Garden.Tile[] = [];

    // Check top and bottom edges for path tiles
    for (let x = 0; x < width; x++) {
        if (tiles[0][x].type === "path") topCandidates.push(tiles[0][x]);
        if (tiles[height - 1][x].type === "path")
            bottomCandidates.push(tiles[height - 1][x]);
    }

    // Check left and right edges for path tiles
    for (let y = 0; y < height; y++) {
        if (tiles[y][0].type === "path") leftCandidates.push(tiles[y][0]);
        if (tiles[y][width - 1].type === "path")
            rightCandidates.push(tiles[y][width - 1]);
    }

    /**
     * Helper function to safely select a random tile from an array.
     * Returns undefined if the array is empty.
     */
    const pickRandom = (arr: Garden.Tile[]) =>
        arr.length ? arr[Math.floor(rand() * arr.length)] : undefined;

    // Randomly select one candidate from each edge that has a path tile
    const top = pickRandom(topCandidates);
    const bottom = pickRandom(bottomCandidates);
    const left = pickRandom(leftCandidates);
    const right = pickRandom(rightCandidates);

    // Collect only the water source candidates that actually exist
    const corners = [];
    if (top) corners.push(top);
    if (bottom) corners.push(bottom);
    if (left) corners.push(left);
    if (right) corners.push(right);

    /**
     * Randomly decide how many water sources to create (2-4).
     * Capped at the number of available border path candidates.
     */
    const count = Math.min(
        corners.length,
        2 + Math.floor(rand() * 3) // 2–4
    );

    /**
     * Fisher-Yates shuffle: Randomly shuffle the corners array to ensure
     * unbiased selection of which water sources to activate.
     */
    fisherYatesShuffle(corners, rand);

    // Convert the selected tiles to water source tiles
    for (let i = 0; i < count; i++) {
        corners[i].type = "water_source";
    }

    return {
        width,
        height,
        tiles,
        hoses: [],
        seed: opts.seed,
    };
}
