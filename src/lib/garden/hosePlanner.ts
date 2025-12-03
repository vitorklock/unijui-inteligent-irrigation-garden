import { Garden as G } from "./types";
import type { Garden as GardenModel } from "./types";
import { GardenGrid } from "./grid";
import { aStar, manhattanHeuristic, Point } from "./pathfinding/aStar";

export interface HosePlannerOptions {
  // Placeholder for tuning later (max distance, etc.)
}

/**
 * Compute hose paths for the given garden.
 * For now: each plant gets a path to its nearest water source.
 */
export function planHoses(
  baseGarden: GardenModel,
  _options: HosePlannerOptions = {}
): GardenModel {
  const grid = new GardenGrid(baseGarden);
  const sources = grid.findWaterSources();
  const plants = grid.findPlantTiles();

  if (!sources.length || !plants.length) {
    return { ...baseGarden, hoses: [] };
  }

  const hoses: G.HosePath[] = [];
  let idCounter = 1;

  const findNearestSource = (plant: G.Tile): G.Tile | null => {
    let best: G.Tile | null = null;
    let bestDist = Infinity;
    for (const s of sources) {
      const d = Math.abs(s.x - plant.x) + Math.abs(s.y - plant.y);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  };

  for (const plant of plants) {
    const source = findNearestSource(plant);
    if (!source) continue;

    const start: Point = { x: source.x, y: source.y };
    const goal: Point = { x: plant.x, y: plant.y };

    const path = aStar(
      start,
      goal,
      (pos) =>
        grid.neighbors4(pos).filter((t) => grid.isWalkableForHose(t)).map((t) => ({
          pos: { x: t.x, y: t.y },
          cost: grid.getMovementCost(t),
        })),
      manhattanHeuristic
    );

    if (!path) continue;

    hoses.push({
      id: `hose-${idCounter++}`,
      source: { x: start.x, y: start.y },
      target: { x: goal.x, y: goal.y },
      tiles: path.map((p) => ({ x: p.x, y: p.y })),
    });
  }

  return { ...baseGarden, hoses };
}
