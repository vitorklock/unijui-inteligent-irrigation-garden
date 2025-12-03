// lib/garden/pathfinding/aStar.ts

export interface Point {
    x: number;
    y: number;
}

interface Neighbor {
    pos: Point;
    cost: number;
}

type GetNeighbors = (pos: Point) => Neighbor[];
type Heuristic = (a: Point, b: Point) => number;

/**
 * Simple A* for small grids.
 * Returns a list of points from start to goal (inclusive) or null if no path.
 */
export function aStar(
    start: Point,
    goal: Point,
    getNeighbors: GetNeighbors,
    heuristic: Heuristic
): Point[] | null {
    const openSet: Point[] = [start];
    const cameFrom = new Map<string, Point>();

    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const key = (p: Point) => `${p.x},${p.y}`;

    gScore.set(key(start), 0);
    fScore.set(key(start), heuristic(start, goal));

    const getLowestF = () => {
        let bestIdx = 0;
        let bestVal = Infinity;
        for (let i = 0; i < openSet.length; i++) {
            const p = openSet[i];
            const k = key(p);
            const f = fScore.get(k) ?? Infinity;
            if (f < bestVal) {
                bestVal = f;
                bestIdx = i;
            }
        }
        return bestIdx;
    };

    const reconstructPath = (current: Point): Point[] => {
        const path: Point[] = [current];
        let k = key(current);
        while (cameFrom.has(k)) {
            const prev = cameFrom.get(k)!;
            path.push(prev);
            k = key(prev);
        }
        return path.reverse();
    };

    while (openSet.length > 0) {
        const currentIdx = getLowestF();
        const current = openSet[currentIdx];

        if (current.x === goal.x && current.y === goal.y) {
            return reconstructPath(current);
        }

        // Remove current from openSet
        openSet.splice(currentIdx, 1);

        const currentKey = key(current);
        const currentG = gScore.get(currentKey) ?? Infinity;

        for (const neighbor of getNeighbors(current)) {
            const tentativeG = currentG + neighbor.cost;
            const nKey = key(neighbor.pos);
            const existingG = gScore.get(nKey);

            if (existingG === undefined || tentativeG < existingG) {
                cameFrom.set(nKey, current);
                gScore.set(nKey, tentativeG);
                fScore.set(nKey, tentativeG + heuristic(neighbor.pos, goal));

                // push to openSet if not already there
                if (!openSet.some((p) => p.x === neighbor.pos.x && p.y === neighbor.pos.y)) {
                    openSet.push(neighbor.pos);
                }
            }
        }
    }

    return null; // no path
}

export const manhattanHeuristic: Heuristic = (a, b) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
