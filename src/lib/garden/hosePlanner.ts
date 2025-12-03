// lib/garden/hosePlanner.ts
import { Garden as G } from "./types";
import type { Garden as GardenModel } from "./types";
import { GardenGrid } from "./grid";
import { aStar, Point } from "./pathfinding/aStar";

export interface HosePlannerOptions {
  /**
   * Max Manhattan distance from a hose tile at which a plant
   * is considered "covered".
   * radius = 1 means hose in a direct neighbor tile is enough.
   */
  coverageRadius?: number;
}

/**
 * Plan hoses as a single (or few) tree-like networks starting from water sources.
 *
 * Algorithm (Prim-style):
 *  - Start the "network" with all water_source tiles.
 *  - Any plant is considered covered if at least one network tile is within
 *    `coverageRadius` (Manhattan).
 *  - While there are uncovered plants:
 *      - For each uncovered plant, find a path from the plant to the existing
 *        network (via A* to the nearest network tile).
 *      - Choose the plant whose connection path is cheapest and add that path
 *        to the network as a new hose segment.
 *      - Mark any plants now close to the network as covered.
 *
 * This produces a hose tree with much less redundancy than connecting each
 * plant directly to a source.
 */
export function planHoses(
  baseGarden: GardenModel,
  options: HosePlannerOptions = {}
): GardenModel {
  const coverageRadius = options.coverageRadius ?? 1;

  const grid = new GardenGrid(baseGarden);
  const sources = grid.findWaterSources();
  const plants = grid.findPlantTiles();

  if (!sources.length || !plants.length) {
    return { ...baseGarden, hoses: [] };
  }

  const hoses: G.HosePath[] = [];
  let idCounter = 1;

  const posKey = (x: number, y: number) => `${x},${y}`;

  // --- Network state (current hose tree) ---
  const networkSet = new Set<string>();
  const networkList: G.Position[] = [];

  // Initialize network with all water sources
  for (const src of sources) {
    const k = posKey(src.x, src.y);
    if (!networkSet.has(k)) {
      networkSet.add(k);
      networkList.push({ x: src.x, y: src.y });
    }
  }

  // --- Plant coverage bookkeeping ---
  const coveredPlantKeys = new Set<string>();

  const isPlantCovered = (plant: G.Tile): boolean => {
    for (const pos of networkList) {
      const d = Math.abs(pos.x - plant.x) + Math.abs(pos.y - plant.y);
      if (d <= coverageRadius) return true;
    }
    return false;
  };

  const recomputeCoveredPlants = () => {
    for (const plant of plants) {
      const key = posKey(plant.x, plant.y);
      if (coveredPlantKeys.has(key)) continue;
      if (isPlantCovered(plant)) {
        coveredPlantKeys.add(key);
      }
    }
  };

  // Initial coverage: some plants might be close to sources already
  recomputeCoveredPlants();

  const allPlantsCovered = () =>
    coveredPlantKeys.size >= plants.length;

  // Helper: find the nearest network tile to a given plant
  const findNearestNetworkPos = (plant: G.Tile): G.Position | null => {
    if (!networkList.length) return null;
    let best: G.Position | null = null;
    let bestDist = Infinity;
    for (const pos of networkList) {
      const d = Math.abs(pos.x - plant.x) + Math.abs(pos.y - plant.y);
      if (d < bestDist) {
        bestDist = d;
        best = pos;
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  };

  // --- Main loop: connect uncovered plants one by one with cheapest hose segment ---
  while (!allPlantsCovered()) {
    let bestPlant: G.Tile | null = null;
    let bestPath: Point[] | null = null;
    let bestCost = Infinity;

    for (const plant of plants) {
      const plantKey = posKey(plant.x, plant.y);
      if (coveredPlantKeys.has(plantKey)) continue;

      const target = findNearestNetworkPos(plant);
      if (!target) continue;

      // A* from plant to nearest network tile
      const start: Point = { x: plant.x, y: plant.y };
      const goal: Point = { x: target.x, y: target.y };

      const path = aStar(
        start,
        goal,
        (pos) =>
          grid
            .neighbors4(pos)
            .filter((t) => grid.isWalkableForHose(t))
            .map((t) => ({
              pos: { x: t.x, y: t.y },
              cost: grid.getMovementCost(t),
            })),
        (pos, g) => Math.abs(pos.x - g.x) + Math.abs(pos.y - g.y)
      );

      if (!path || path.length < 2) {
        // no valid path or plant already on the network
        continue;
      }

      // We DON'T want the hose to sit on the plant tile by default.
      // Remove the first tile (the plant itself) so the hose stops near it.
      const effectivePath = path.slice(1);

      // If after slicing there's nothing new, skip.
      if (!effectivePath.length) continue;

      const cost = effectivePath.reduce((sum, p) => {
        const t = grid.getTile(p.x, p.y);
        if (!t) return sum + 9999;
        return sum + grid.getMovementCost(t);
      }, 0);

      if (cost < bestCost) {
        bestCost = cost;
        bestPlant = plant;
        bestPath = effectivePath;
      }
    }

    if (!bestPlant || !bestPath) {
      // No more connectable plants; stop to avoid infinite loop
      break;
    }

    // Create a new hose segment for this plant connection
    const hoseId = `hose-${idCounter++}`;
    const hose: G.HosePath = {
      id: hoseId,
      source: { x: bestPath[0].x, y: bestPath[0].y }, // first tile in the new path (adjacent to network or near plant)
      target: { x: bestPath[bestPath.length - 1].x, y: bestPath[bestPath.length - 1].y },
      tiles: bestPath.map((p) => ({ x: p.x, y: p.y })),
    };
    hoses.push(hose);

    // Merge the new path into the network
    for (const p of bestPath) {
      const k = posKey(p.x, p.y);
      if (!networkSet.has(k)) {
        networkSet.add(k);
        networkList.push({ x: p.x, y: p.y });
      }
    }

    // Some plants (including bestPlant and others nearby) may now be covered
    recomputeCoveredPlants();
  }

  return {
    ...baseGarden,
    hoses,
  };
}
