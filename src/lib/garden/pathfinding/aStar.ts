
export interface Point {
    x: number;
    y: number;
}

/** Represents a neighboring node with its position and traversal cost */
interface Neighbor {
    pos: Point;
    cost: number;
}

type GetNeighbors = (pos: Point) => Neighbor[];
type Heuristic = (a: Point, b: Point) => number;

/**
 * A* Pathfinding Algorithm Implementation
 * 
 * Finds the shortest path from start to goal on a grid using A* search.
 * 
 * @param start - The starting position
 * @param goal - The target position
 * @param getNeighbors - Function that returns valid neighbors for any given position with their costs
 * @param heuristic - Heuristic function to estimate distance to goal (e.g., Manhattan distance)
 * @returns Array of points representing the shortest path (inclusive of start and goal), 
 *          or null if no path exists
 * 
 * Algorithm flow:
 * 1. Initialize open set with start node
 * 2. While nodes exist in open set:
 *    a. Pick node with lowest fScore (most promising)
 *    b. If it's the goal, reconstruct and return path
 *    c. Otherwise, evaluate all neighbors
 *    d. Update their costs if a better path is found
 * 3. Return null if open set empties without reaching goal
 */
export function aStar(
    start: Point,
    goal: Point,
    getNeighbors: GetNeighbors,
    heuristic: Heuristic
): Point[] | null {
    const openSet: Point[] = [start];
    
    // cameFrom: tracks the best parent of each node for path reconstruction
    const cameFrom = new Map<string, Point>();

    // gScore: actual cost from start to each node
    const gScore = new Map<string, number>();
    
    // fScore: estimated total cost (gScore + heuristic estimate to goal)
    const fScore = new Map<string, number>();

    // key: converts Point to string for Map lookups
    const key = (p: Point) => `${p.x},${p.y}`;

    // Initialize start node: zero cost from start, estimate to goal is heuristic
    gScore.set(key(start), 0);
    fScore.set(key(start), heuristic(start, goal));

    /**
     * Finds the node in openSet with the lowest fScore.
     * This node is the most promising to explore next.
     */
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

    /**
     * Reconstructs the path from start to current by following parent pointers.
     * Works backwards from current through cameFrom map, then reverses the result.
     */
    const reconstructPath = (current: Point): Point[] => {
        const path: Point[] = [current];
        let k = key(current);
        // Walk backwards through parents
        while (cameFrom.has(k)) {
            const prev = cameFrom.get(k)!;
            path.push(prev);
            k = key(prev);
        }
        return path.reverse();
    };

    // Main A* loop
    while (openSet.length > 0) {
        // Step 1: Get the most promising node from openSet
        const currentIdx = getLowestF();
        const current = openSet[currentIdx];

        // Step 2: Check if we've reached the goal
        if (current.x === goal.x && current.y === goal.y) {
            return reconstructPath(current);
        }

        // Step 3: Mark current as evaluated by removing from openSet
        openSet.splice(currentIdx, 1);

        const currentKey = key(current);
        const currentG = gScore.get(currentKey) ?? Infinity;

        // Step 4: Evaluate all neighbors of current node
        for (const neighbor of getNeighbors(current)) {
            // Calculate tentative cost if we go through current to reach neighbor
            const tentativeG = currentG + neighbor.cost;
            const nKey = key(neighbor.pos);
            const existingG = gScore.get(nKey);

            // Step 5: If this path to neighbor is better than any found before,
            // update the neighbor's costs and add it to the open set
            if (existingG === undefined || tentativeG < existingG) {
                cameFrom.set(nKey, current);
                gScore.set(nKey, tentativeG);
                fScore.set(nKey, tentativeG + heuristic(neighbor.pos, goal));

                // Add neighbor to openSet for future evaluation if not already there
                if (!openSet.some((p) => p.x === neighbor.pos.x && p.y === neighbor.pos.y)) {
                    openSet.push(neighbor.pos);
                }
            }
        }
    }

    // No path found
    return null;
}

/**
 * Manhattan Distance Heuristic
 * 
 * Calculates the distance between two points assuming only horizontal and vertical movement.
 * Used as the heuristic for A* on grid-based pathfinding.
 * 
 * Formula: |a.x - b.x| + |a.y - b.y|
 * 
 * This heuristic is "admissible" (never overestimates), making it valid for A*.
 */
export const manhattanHeuristic: Heuristic = (a, b) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
