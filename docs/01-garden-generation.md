# Garden Generation System

## Overview

The garden generation system creates procedurally generated garden layouts with configurable parameters. Each garden is a deterministic grid-based environment with various tile types, paths, obstacles, plants, and irrigation infrastructure. The system uses a seeded random number generator to ensure reproducibility.

## Table of Contents

- [Generation Parameters](#generation-parameters)
- [Generation Process](#generation-process)
- [Tile Types](#tile-types)
- [Grid System](#grid-system)
- [Hose Planning](#hose-planning)
- [Constants and Configuration](#constants-and-configuration)

---

## Generation Parameters

The garden generation accepts the following parameters via `GenerateGardenParams`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | `number` | `30` | Width of the garden grid (number of tiles) |
| `height` | `number` | `20` | Height of the garden grid (number of tiles) |
| `pillarDensity` | `number` (0-1) | `0.04` | Probability that any soil tile becomes a pillar obstacle (4% by default) |
| `plantChanceNearPath` | `number` (0-1) | `0.25` | Base probability for plant placement near paths |
| `seed` | `number` | `42` | Random seed for deterministic generation |

### Example Usage

```typescript
import { generateGarden } from './lib/garden/generator';

const garden = generateGarden({
    width: 40,
    height: 30,
    pillarDensity: 0.06,
    plantChanceNearPath: 0.3,
    seed: 12345
});
```

---

## Generation Process

Garden generation follows a **7-step procedural algorithm**. Each step builds upon the previous ones to create a realistic, navigable garden layout.

### Step 1: Initialize Grid with Soil

**Purpose**: Create the base canvas for the garden.

**Process**:
- Creates a 2D array `tiles[y][x]` of dimensions `height × width`
- Each tile is initialized as:
  - `type`: `"soil"`
  - `hasPlant`: `false`
  - `moisture`: `0`
  - `x`, `y`: Position coordinates

**Result**: A rectangular grid filled entirely with soil tiles.

```typescript
// Pseudocode
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        tiles[y][x] = {
            x, y,
            type: "soil",
            hasPlant: false,
            moisture: 0
        };
    }
}
```

---

### Step 2: Soften Edges with Erosion

**Purpose**: Create natural, irregular garden boundaries instead of perfect rectangles.

**Process**: Applies two types of erosion:

#### 2a. Corner Erosion

- **Probability**: 80% per corner
- **Size**: Random between 2 and `min(width, height) / 5`
- **Shape**: Diagonal triangle "bite" removing tiles from each corner
- **Result**: Softens sharp 90° corners into angled edges

```
Before:          After:
┌────────┐      ┌───────┐
│        │       \      │
│        │        │     │
│        │        │     │
└────────┘        └────┘
```

**Algorithm**:
```typescript
// For each corner (tl, tr, bl, br)
const size = 2 + Math.floor(rand() * (maxSize - 1));
for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
        if (dx + dy >= size) continue; // Creates diagonal shape
        tiles[adjustedY][adjustedX].type = "pillar";
    }
}
```

#### 2b. Edge Erosion

- **Probability**: 50% per edge
- **Depth**: Random between 1 and `min(width, height) / 10`
- **Span**: 20% of the perpendicular dimension
- **Location**: Random position along each edge
- **Result**: Creates small indent "notches" along edges

```
Before:    After:
┌─────┐    ┌──┐──┐
│     │    │  │  │
│     │    │     │
└─────┘    └─────┘
```

**Implementation**:
- Applies to all four sides: top, bottom, left, right
- Each erosion selects a random segment and carves inward
- Eroded tiles are marked as `"pillar"` type (impassable terrain)

---

### Step 3: Carve Main Cross Path

**Purpose**: Establish primary navigation routes through the garden center.

**Process**:
- Calculates garden center: `midX = floor(width / 2)`, `midY = floor(height / 2)`
- Creates vertical path: All tiles at `x = midX` become `"path"`
- Creates horizontal path: All tiles at `y = midY` become `"path"`
- **Constraint**: Will not overwrite existing `"pillar"` tiles from erosion

**Result**: A cross-shaped path network dividing the garden into four quadrants.

```
Garden with cross paths:
┌────────────┐
│     │      │
│     │      │
├─────┼──────┤
│     │      │
│     │      │
└────────────┘
```

---

### Step 4: Create Secondary Branch Paths

**Purpose**: Add complexity and additional access routes.

**Process**:
- Creates `GARDEN_PATH_BRANCH_COUNT` (default: 6) random branch paths
- Each branch:
  - **Origin**: Random point on either the vertical or horizontal main path
  - **Direction**: Random (left/right for vertical branches, up/down for horizontal)
  - **Length**: Random between 20% and 50% of the garden dimension
  
**Algorithm**:
```typescript
for (let i = 0; i < 6; i++) {
    if (rand() < 0.5) {
        // Vertical branch (extends left or right from vertical axis)
        const y = randomY;
        const direction = rand() < 0.5 ? -1 : 1;
        const length = floor(width * (0.2 + rand() * 0.3));
        // Extend from midX in direction
    } else {
        // Horizontal branch (extends up or down from horizontal axis)
        const x = randomX;
        const direction = rand() < 0.5 ? -1 : 1;
        const length = floor(height * (0.2 + rand() * 0.3));
        // Extend from midY in direction
    }
}
```

**Result**: A more organic path network with multiple routes.

---

### Step 5: Scatter Random Obstacles

**Purpose**: Add navigational challenges and visual variety.

**Process**:
- Iterates through all tiles
- For each tile that is still `"soil"`:
  - Converts to `"pillar"` with probability = `pillarDensity`
- **Constraint**: Never converts `"path"` tiles

**Result**: Random pillar obstacles scattered throughout garden beds.

**Note**: Default density is 4%, meaning roughly 1 in 25 soil tiles becomes a pillar.

---

### Step 6: Plant Vegetation in Clusters

**Purpose**: Create realistic plant distributions near paths (garden beds).

This is the most complex step, using a **cluster-based planting algorithm**.

#### 6a. Identify Planting Candidates

**Criterion**: Soil tiles adjacent (4-directional) to paths or water sources.

```typescript
const isNearPath = (x, y) => {
    // Check all 4 neighbors (up, down, left, right)
    return neighbors4.some(([dx, dy]) => {
        const neighbor = tiles[y + dy][x + dx];
        return neighbor?.type === "path" || neighbor?.type === "water_source";
    });
};
```

**Rationale**: Real gardens typically have plants in beds bordering paths, not scattered randomly throughout.

#### 6b. Generate Plant Clusters

**Cluster Count Calculation**:
```typescript
baseCount = max(3, floor(candidateCount × plantChanceNearPath × 0.12))
finalCount = baseCount + randomInt(0, 2)  // Add 0-2 extra clusters
```

**For Each Cluster**:
1. **Select Center**: Random tile from candidates
2. **Set Radius**: Random between 2-3 tiles (Manhattan distance)
3. **Plant Distribution**: Radial density falloff
   - **Maximum probability at center**: 90%
   - **Minimum probability at edge**: 25%
   - **Falloff function**: `prob = minProb + (maxProb - minProb) × (1 - distance/radius)`

**Algorithm**:
```typescript
for each cluster {
    const center = randomCandidate();
    const radius = 2 + randomInt(0, 1); // 2 or 3
    
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const distance = sqrt(dx² + dy²);
            if (distance > radius) continue;
            
            const factor = 1 - distance / radius;
            const probability = 0.25 + 0.65 × factor;
            
            if (rand() < probability) {
                tile.hasPlant = true;
            }
        }
    }
}
```

#### 6c. Scatter Isolated Plants

**Purpose**: Add natural variation, prevent overly regular patterns.

**Process**:
- Iterates through all planting candidates
- For each unplanted candidate:
  - Sets `hasPlant = true` with probability = `plantChanceNearPath × 0.2`
  
**Result**: ~5% of path-adjacent tiles (default) get individual scattered plants.

**Final Result**: Natural-looking plant distributions with dense clusters and sparse isolated plants.

---

### Step 7: Place Water Sources

**Purpose**: Establish entry points for irrigation hoses.

**Constraint**: Water sources can only exist at **border-edge path intersections**.

#### Process

**7a. Identify Border Path Tiles**

Scans all four edges and collects path tiles that reach the border:
- **Top edge**: `y = 0`, paths at various `x`
- **Bottom edge**: `y = height - 1`, paths at various `x`
- **Left edge**: `x = 0`, paths at various `y`
- **Right edge**: `x = width - 1`, paths at various `y`

**7b. Select Water Source Locations**

1. Randomly picks one candidate from each edge (if available)
2. Combines all selected candidates into a pool
3. Determines count: Random between 2-4, capped at available candidates
4. **Shuffles** candidates using Fisher-Yates algorithm (ensures unbiased selection)
5. Converts first `count` shuffled candidates to `"water_source"` type

**Algorithm**:
```typescript
// Collect one random candidate per edge
const corners = [];
if (topCandidates.length) corners.push(random(topCandidates));
if (bottomCandidates.length) corners.push(random(bottomCandidates));
if (leftCandidates.length) corners.push(random(leftCandidates));
if (rightCandidates.length) corners.push(random(rightCandidates));

// Select 2-4 water sources
const count = min(corners.length, 2 + randomInt(0, 2));
fisherYatesShuffle(corners, rand);

for (let i = 0; i < count; i++) {
    corners[i].type = "water_source";
}
```

**Result**: 2-4 water sources strategically placed at garden borders where paths exit.

**Rationale**: Water sources represent connections to external water supplies, so they must be accessible from outside the garden.

---

## Tile Types

Each tile in the garden has a specific type that determines its behavior and appearance.

### Type Definitions

```typescript
export type TileType = "soil" | "path" | "pillar" | "water_source";

export interface Tile {
    x: number;           // X coordinate (0 to width-1)
    y: number;           // Y coordinate (0 to height-1)
    type: TileType;      // Tile classification
    hasPlant: boolean;   // Whether a plant exists on this tile
    moisture: number;    // Current moisture level (0 = dry, 1 = ideal, >1 = flooded)
}
```

### 1. Soil Tiles (`"soil"`)

**Primary Purpose**: Plantable ground where vegetation can grow.

**Characteristics**:
- **Walkable by hoses**: Yes
- **Can have plants**: Yes
- **Moisture dynamics**: Full simulation (irrigation, evaporation, diffusion)
- **Movement cost**: 1.3 (slightly harder than paths)

**Behavior**:
- Receives water from irrigation systems
- Affected by weather (rain, evaporation)
- Participates in moisture diffusion with neighboring soil
- Primary tile type for plant placement

---

### 2. Path Tiles (`"path"`)

**Primary Purpose**: Navigation routes and access corridors.

**Characteristics**:
- **Walkable by hoses**: Yes
- **Can have plants**: No
- **Moisture dynamics**: None (stays at 0)
- **Movement cost**: 1.0 (preferred routing)

**Behavior**:
- Forms the main navigation network
- Hoses prefer routing through paths (lower cost)
- Never holds moisture
- Never has plants
- Connects different garden areas

**Visual**: Typically rendered differently from soil to show walkable areas.

---

### 3. Pillar Tiles (`"pillar"`)

**Primary Purpose**: Impassable obstacles and decorative features.

**Characteristics**:
- **Walkable by hoses**: No
- **Can have plants**: No
- **Moisture dynamics**: None
- **Movement cost**: Infinity (blocks movement)

**Behavior**:
- Created during edge erosion
- Randomly scattered based on `pillarDensity`
- Forces hoses to route around them
- Adds navigational complexity

**Use Cases**:
- Decorative garden structures
- Terrain obstacles (rocks, fountains, structures)
- Border irregularities

---

### 4. Water Source Tiles (`"water_source"`)

**Primary Purpose**: Entry points for irrigation hose networks.

**Characteristics**:
- **Walkable by hoses**: Yes
- **Can have plants**: No
- **Moisture dynamics**: None
- **Movement cost**: 1.0 (same as paths)

**Behavior**:
- Serves as the origin point for hose pathfinding
- 2-4 sources placed per garden
- Always located at garden borders
- Must intersect with path tiles

**Special Properties**:
- Hose planning algorithm starts from these tiles
- Represents connection to external water supply
- Cannot be converted to other types after placement

---

## Grid System

The grid system provides efficient access and manipulation of the garden layout.

### GardenGrid Class

Located in `src/lib/garden/grid.ts`, this class wraps the garden data structure with utility methods.

#### Constructor

```typescript
class GardenGrid {
    constructor(garden: Garden) {
        this.width = garden.width;
        this.height = garden.height;
        this.tiles = garden.tiles;
    }
}
```

#### Core Methods

##### `inBounds(x: number, y: number): boolean`

Checks if coordinates are within the garden grid.

```typescript
inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
}
```

**Usage**: Prevents out-of-bounds access during iteration or pathfinding.

---

##### `getTile(x: number, y: number): Tile | undefined`

Safe tile access with bounds checking.

```typescript
getTile(x, y) {
    if (!this.inBounds(x, y)) return undefined;
    return this.tiles[y][x];
}
```

**Returns**: The tile at `(x, y)`, or `undefined` if out of bounds.

---

##### `neighbors4(pos: Position): Tile[]`

Returns all valid 4-directional neighbors (up, down, left, right).

```typescript
neighbors4(pos) {
    const deltas = [
        { dx: 1, dy: 0 },   // right
        { dx: -1, dy: 0 },  // left
        { dx: 0, dy: 1 },   // down
        { dx: 0, dy: -1 }   // up
    ];
    
    return deltas
        .map(d => this.getTile(pos.x + d.dx, pos.y + d.dy))
        .filter(tile => tile !== undefined);
}
```

**Usage**: 
- Moisture diffusion calculations
- Path adjacency checks
- Neighbor-based logic

---

##### `isWalkableForHose(tile: Tile): boolean`

Determines if a hose can traverse this tile.

```typescript
isWalkableForHose(tile) {
    return tile.type !== "pillar";
}
```

**Returns**: 
- `true` for: soil, path, water_source
- `false` for: pillar

---

##### `getMovementCost(tile: Tile): number`

Returns pathfinding cost for traversing a tile.

```typescript
getMovementCost(tile) {
    switch (tile.type) {
        case "path":
        case "water_source":
            return 1.0;
        case "soil":
            return 1.3;
        default:
            return Infinity; // pillar
    }
}
```

**Impact on Pathfinding**:
- Hoses **prefer** routing through paths (cost 1.0)
- Hoses **avoid** soil when possible (cost 1.3)
- Hoses **cannot** cross pillars (cost Infinity)

**Rationale**: This creates realistic hose layouts that follow existing paths rather than cutting directly across garden beds.

---

##### `findTilesByType(type: TileType): Tile[]`

Finds all tiles of a specific type.

```typescript
findTilesByType(type) {
    const result = [];
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            if (this.tiles[y][x].type === type) {
                result.push(this.tiles[y][x]);
            }
        }
    }
    return result;
}
```

**Usage**: Locating all paths, water sources, or pillars.

---

##### `findPlantTiles(): Tile[]`

Returns all tiles that have plants.

```typescript
findPlantTiles() {
    return this.tiles.flat().filter(t => t.hasPlant);
}
```

**Usage**: 
- Calculating plant statistics
- Irrigation coverage analysis
- Health metrics computation

---

##### `findWaterSources(): Tile[]`

Convenience method to find all water source tiles.

```typescript
findWaterSources() {
    return this.findTilesByType("water_source");
}
```

**Usage**: Hose planning initialization.

---

## Hose Planning

After the garden terrain is generated, an irrigation hose network must be planned to water all plants. This is handled by the **Prim-style tree algorithm** in `src/lib/garden/hosePlanner.ts`.

### Algorithm Overview

The hose planner creates an **efficient tree-like network** connecting water sources to all plants with minimal redundancy.

#### Key Concepts

1. **Coverage Radius**: Manhattan distance within which a hose tile can water plants
   - Default: 1 (hose must be directly adjacent to plant)
   - Configurable via `HosePlannerOptions.coverageRadius`

2. **Network**: Set of tiles currently covered by hose infrastructure
   - Initialized with all water source tiles
   - Grows incrementally by adding paths to uncovered plants

3. **Plant Coverage**: A plant is "covered" if any network tile is within `coverageRadius`

### Algorithm Steps

#### Initialization

```typescript
// 1. Start network with all water sources
const network = new Set<string>();
for (const source of waterSources) {
    network.add(`${source.x},${source.y}`);
}

// 2. Mark plants already within radius of sources as covered
const coveredPlants = new Set<string>();
for (const plant of allPlants) {
    if (isWithinRadiusOfNetwork(plant)) {
        coveredPlants.add(`${plant.x},${plant.y}`);
    }
}
```

#### Main Loop: Iterative Connection

Repeat until all plants are covered:

**Step 1: Find Best Connection**

For each uncovered plant:
- Find nearest tile in existing network
- Run **A\* pathfinding** from plant to that network tile
- Calculate path cost (sum of movement costs)
- Track the plant with the **cheapest connection path**

**Step 2: Add Best Path to Network**

- Create new hose segment from the optimal path
- Add all path tiles to the network
- **Important**: Path excludes the plant's own tile (hose stops adjacent)

**Step 3: Update Coverage**

- Recompute which plants are now covered by expanded network
- Mark newly covered plants (including those near the new hose)

**Step 4: Repeat**

Continue until `coveredPlants.size >= totalPlants` or no valid paths remain.

### Pathfinding Details

The algorithm uses **A\* search** (from `src/lib/garden/pathfinding/aStar.ts`) for each connection:

**Start**: Plant position  
**Goal**: Nearest network tile  
**Heuristic**: Manhattan distance  
**Cost Function**: `GardenGrid.getMovementCost(tile)`

**Path Characteristics**:
- Prefers routing through paths (cost 1.0)
- Avoids crossing soil unnecessarily (cost 1.3)
- Cannot cross pillars (cost ∞)
- Results in natural-looking hose layouts following existing paths

### Hose Path Structure

Each planned hose segment is represented as:

```typescript
interface HosePath {
    id: string;              // Unique identifier (e.g., "hose-1")
    source: Position;        // Starting point of this segment
    target: Position;        // Ending point of this segment
    tiles: Position[];       // Ordered array of all tiles in the path
}
```

### Coverage Calculation

A plant at position `(px, py)` is covered if there exists a network tile at `(nx, ny)` such that:

```
|px - nx| + |py - ny| <= coverageRadius
```

This uses **Manhattan distance** (city-block distance), meaning:
- `coverageRadius = 1`: Hose must be directly adjacent (4-directional)
- `coverageRadius = 2`: Hose can be up to 2 tiles away (including diagonals)

### Algorithm Complexity

- **Time**: O(P × N × log V) where:
  - P = number of plants
  - N = number of network tiles (grows during execution)
  - V = total garden tiles (for A\* search)
  
- **Space**: O(V + H) where:
  - V = garden tiles
  - H = hose path tiles

### Example

```
Legend:
  S = water source
  P = plant
  # = pillar
  . = soil
  - = path
  H = hose

Step 1: Initialize        Step 2: Connect Plant 1    Step 3: Connect Plant 2
┌──────────┐             ┌──────────┐              ┌──────────┐
│S         │             │S H       │              │S H─────H │
│  P     P │             │  P     P │              │  P     P │
│    #     │             │    #     │              │    #     │
│        S │             │        S │              │        S │
└──────────┘             └──────────┘              └──────────┘

Final: Both plants covered with minimal hose usage
```

---

## Constants and Configuration

### Garden Constants

Defined in `src/lib/garden/consts.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `IDEAL_MIN_MOISTURE` | `0.1` | Minimum moisture for healthy plants |
| `IDEAL_MAX_MOISTURE` | `1.0` | Maximum moisture before flooding |
| `TICKS_PER_DAY` | `100` | Number of simulation ticks in one day cycle |
| `WATER_USAGE_PER_TICK` | `1` | Water units consumed per active irrigation tick |
| `EPISODE_LENGTH` | `1000` | Default simulation episode duration (ticks) |
| `FORECAST_TICK_WINDOW` | `10` | Number of future ticks for weather forecast |
| `TILE_MOISTURE_DRY` | `0` | Moisture level considered "dry" |
| `TILE_MOISTURE_GOOD` | `0.7` | Moisture level considered "optimal" |
| `TILE_MOISTURE_FLOODED` | `1.3` | Moisture level considered "flooded" |
| `GARDEN_PATH_BRANCH_COUNT` | `6` | Number of secondary path branches to generate |

### Simulation Configuration

The simulation behavior is controlled by `Simulation.Config`:

```typescript
interface Config {
    irrigationRate: number;         // Moisture added per tick at hose tiles (when ON)
    baseEvaporationRate: number;    // Base moisture lost per tick
    diffusionRate: number;          // Moisture spread to neighbors (0-0.5)
    rainToMoisture: number;         // Rain intensity → moisture conversion
    maxMoisture: number;            // Clamp ceiling for moisture values
    coverageRadius: number;         // Manhattan distance for hose watering
}
```

**Default Values** (from typical usage):
- `irrigationRate`: 0.3 - 0.5
- `baseEvaporationRate`: 0.02 - 0.05
- `diffusionRate`: 0.1 - 0.3
- `rainToMoisture`: 0.5 - 1.0
- `maxMoisture`: 1.5 - 2.0
- `coverageRadius`: 1 - 2

---

## Garden Data Structure

### Final Garden Model

After all generation steps complete, the garden is represented as:

```typescript
interface Garden {
    width: number;           // Grid width
    height: number;          // Grid height
    tiles: Tile[][];        // 2D array [y][x] of tiles
    hoses: HosePath[];      // Array of planned hose segments
    seed?: number;          // Random seed used for generation
}
```

### Coordinate System

- **Origin**: Top-left corner (0, 0)
- **X-axis**: Increases rightward (0 to width-1)
- **Y-axis**: Increases downward (0 to height-1)
- **Access Pattern**: `tiles[y][x]` (row-major order)

```
    x → 
  ┌─────────────────────
y │ (0,0)  (1,0)  (2,0)
↓ │ (0,1)  (1,1)  (2,1)
  │ (0,2)  (1,2)  (2,2)
```

### Immutability Pattern

The simulation creates **new garden instances** each tick rather than mutating in place:

```typescript
// Simulation step creates new garden with updated moisture
const newGarden = stepGardenMoisture({
    garden: currentGarden,
    config,
    weather,
    irrigationOn
});
```

This functional approach:
- Enables time-travel debugging
- Prevents unintended side effects
- Simplifies state management
- Allows comparison between ticks

---

## Summary

The garden generation system creates realistic, playable environments through a multi-stage procedural process:

1. **Base grid initialization** - Creates the canvas
2. **Edge erosion** - Adds natural boundaries
3. **Path network** - Establishes navigation
4. **Obstacles** - Adds complexity
5. **Plant clustering** - Creates garden beds
6. **Water sources** - Enables irrigation
7. **Hose planning** - Optimizes irrigation coverage

Each stage is configurable, deterministic (via seeding), and designed to produce varied but consistent gardens suitable for irrigation simulation and AI training.
