# Simulation System

## Overview

The simulation system manages the dynamic behavior of the garden over time, including moisture physics, weather evolution, irrigation effects, and plant health tracking. It operates on a **tick-based discrete time model** where each tick represents a small time increment in the garden's lifecycle.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Simulation State](#simulation-state)
- [Moisture Physics](#moisture-physics)
- [Weather System](#weather-system)
- [Simulation Loop](#simulation-loop)
- [Metrics and Evaluation](#metrics-and-evaluation)
- [Episode Results and Scoring](#episode-results-and-scoring)

---

## Core Concepts

### Time Model

The simulation uses a **discrete tick-based time system**:

- **Tick**: One simulation step (smallest time unit)
- **Day**: `TICKS_PER_DAY` = 100 ticks
- **Episode**: Complete simulation run, default `EPISODE_LENGTH` = 1000 ticks (10 days)

### Functional Immutability

The simulation follows a functional programming pattern:
- Each tick produces a **new garden state** rather than mutating the existing one
- Enables time-travel debugging and state comparison
- Simplifies reasoning about state changes

```typescript
// Each step creates new garden instance
const newGarden = stepGardenMoisture({
    garden: currentGarden,
    config,
    weather,
    irrigationOn
});
```

---

## Simulation State

The complete simulation state is tracked in `Simulation.State`:

### State Structure

```typescript
interface State {
    // Time tracking
    tick: number;                    // Current simulation tick (0, 1, 2, ...)
    isRunning: boolean;              // Whether simulation is active
    episodeLength: number;           // Total ticks in this episode
    
    // Irrigation control
    irrigationOn: boolean;           // Current irrigation state
    lastIrrigationTick: number;     // Last tick when irrigation was turned on
    irrigationToggleCount: number;   // Times irrigation changed state
    irrigationOnTicks: number;       // Total ticks irrigation was active
    
    // Weather state
    weather: Weather.State;          // Current weather conditions
    forecast: number[];              // Rain forecast for next N ticks
    
    // Water usage tracking
    waterUsedThisTick: number;      // Water consumed in current tick
    cumulativeWaterUsed: number;     // Total water used in episode
    
    // Configuration
    config: Simulation.Config;       // Physics and simulation parameters
    
    // Plant health accumulators (for final scoring)
    dryPlantTicks?: number;          // Sum of (dry plants × ticks)
    floodedPlantTicks?: number;      // Sum of (flooded plants × ticks)
    healthyPlantTicks?: number;      // Sum of (healthy plants × ticks)
    peakSimultaneousDryPlants?: number;      // Max dry plants at any single tick
    peakSimultaneousFloodedPlants?: number;  // Max flooded plants at any single tick
    
    // Final results (populated when episode ends)
    results?: Results;
}
```

### Simulation Configuration

Physics and behavior parameters are controlled via `Simulation.Config`:

```typescript
interface Config {
    irrigationRate: number;         // Moisture added per tick at hose tiles (when ON)
    baseEvaporationRate: number;    // Base moisture lost per tick (modified by weather)
    diffusionRate: number;          // Moisture spread between neighbors (0-0.5)
    rainToMoisture: number;         // Rain intensity → moisture conversion factor
    maxMoisture: number;            // Upper clamp for moisture values
    coverageRadius: number;         // Manhattan distance for hose watering
}
```

**Typical Values**:
```typescript
{
    irrigationRate: 0.05,           // 5% moisture per tick at hose
    baseEvaporationRate: 0.01,      // 1% base evaporation
    diffusionRate: 0.15,            // 15% diffusion coefficient
    rainToMoisture: 0.1,            // Rain adds 10% per intensity unit
    maxMoisture: 2.0,               // Allow up to 200% saturation
    coverageRadius: 1               // Irrigate tiles within distance 1
}
```

---

## Moisture Physics

The core of the simulation is the moisture update equation applied to each soil tile every tick. This is implemented in `stepGardenMoisture()`.

### Four-Phase Update Process

Each tick processes moisture in **four sequential phases**:

---

### Phase 1: Moisture Sources (Irrigation + Rain)

**Purpose**: Add water from irrigation systems and rainfall.

#### 1a. Irrigation

When `irrigationOn === true`, all soil tiles within `coverageRadius` (Manhattan distance) of any hose tile receive moisture.

**Algorithm**:
```typescript
if (irrigationOn) {
    for (const hose of garden.hoses) {
        for (const hoseTile of hose.tiles) {
            // Iterate over coverage area
            for (let dy = -coverageRadius; dy <= coverageRadius; dy++) {
                for (let dx = -coverageRadius; dx <= coverageRadius; dx++) {
                    // Check Manhattan distance
                    if (|dx| + |dy| <= coverageRadius) {
                        const tile = garden.tiles[y + dy][x + dx];
                        if (tile.type === "soil") {
                            moisture[y + dy][x + dx] += irrigationRate;
                        }
                    }
                }
            }
        }
    }
}
```

**Example with `coverageRadius = 1`**:
```
Hose at (5, 5) waters these tiles:
    (4,5) (5,5) (6,5)
    (5,4)   H   (5,6)
    
Coverage pattern:
     X
   X H X
     X
```

**Water Usage Calculation**:
- Count unique soil tiles covered by all hoses
- `waterUsed = uniqueSoilTiles × irrigationRate`

---

#### 1b. Rainfall

Rain adds moisture uniformly to all soil tiles based on current weather.

**Algorithm**:
```typescript
if (weather.rainIntensity > 0) {
    const rainAmount = rainToMoisture × weather.rainIntensity;
    for each soil tile {
        moisture[tile] += rainAmount;
    }
}
```

**Example**:
- `rainIntensity = 0.5` (moderate rain)
- `rainToMoisture = 0.1`
- Result: Each soil tile gains `0.05` moisture per tick

---

### Phase 2: Moisture Sinks (Evaporation)

**Purpose**: Remove water through evapotranspiration.

Evaporation is **climate-dependent** and modified by weather conditions.

**Climate Factor Calculation**:
```typescript
climateFactor = 1 
    + 0.5 × sunIntensity          // More sun → more evaporation
    + 0.02 × (temperature - 20)   // Higher temp → more evaporation
    - 0.5 × humidity;              // Higher humidity → less evaporation

evaporationRate = max(0, baseEvaporationRate × climateFactor);
```

**Component Breakdown**:

| Factor | Range | Effect |
|--------|-------|--------|
| **Sun Intensity** | 0-1 | 0-50% increase in evaporation |
| **Temperature** | 20-30°C | 0-20% increase (assumes 20°C baseline) |
| **Air Humidity** | 0.4-0.7 | 20-35% decrease |

**Example Calculation**:
```
Weather: temperature=25°C, humidity=0.5, sunIntensity=0.8
baseEvaporationRate = 0.01

climateFactor = 1 + 0.5×0.8 + 0.02×(25-20) - 0.5×0.5
              = 1 + 0.4 + 0.1 - 0.25
              = 1.25

evaporationRate = 0.01 × 1.25 = 0.0125
```

**Application**:
```typescript
for each soil tile {
    moisture[tile] -= evaporationRate;
}
```

**Special Cases**:
- Night (sunIntensity ≈ 0): Reduced evaporation
- Rain (high humidity): Further reduced evaporation
- Hot sunny day: Maximum evaporation

---

### Phase 3: Lateral Diffusion

**Purpose**: Spread moisture between adjacent soil tiles to simulate water flow.

Water naturally moves from wetter tiles to drier tiles through capillary action and gravity.

**Algorithm**: Two-pass approach to avoid double-counting

**Pass 1: Calculate Deltas**
```typescript
// Only process right and down neighbors (to avoid counting pairs twice)
const neighborOffsets = [[1, 0], [0, 1]]; // right, down

for each soil tile at (x, y) {
    for each offset [dx, dy] in neighborOffsets {
        neighbor = tiles[y + dy][x + dx];
        if (neighbor.type === "soil") {
            diff = moisture[y][x] - moisture[y + dy][x + dx];
            delta = diffusionRate × diff;
            
            // Apply equal and opposite changes
            diffs[y][x] -= delta;
            diffs[y + dy][x + dx] += delta;
        }
    }
}
```

**Pass 2: Apply Deltas**
```typescript
for each tile {
    moisture[tile] += diffs[tile];
}
```

**Physical Interpretation**:
- `diffusionRate = 0.15` means 15% of moisture difference moves per tick
- Higher values → faster equilibration
- Lower values → more localized moisture zones

**Example**:
```
Before diffusion:
Tile A: 1.0    Tile B: 0.4
Difference: 0.6

Calculation:
delta = 0.15 × 0.6 = 0.09
Tile A: 1.0 - 0.09 = 0.91
Tile B: 0.4 + 0.09 = 0.49

After diffusion:
Tile A: 0.91   Tile B: 0.49
Difference reduced from 0.6 → 0.42
```

**Edge Behavior**:
- Non-soil tiles (paths, pillars) do NOT participate in diffusion
- This creates moisture barriers at path boundaries

---

### Phase 4: Clamping

**Purpose**: Enforce physical constraints on moisture values.

```typescript
for each soil tile {
    moisture[tile] = clamp(moisture[tile], 0, maxMoisture);
}
```

**Bounds**:
- **Lower**: 0 (soil cannot be drier than completely dry)
- **Upper**: `maxMoisture` (typically 2.0, allowing 200% saturation)

**Note**: Visual flooding can still occur above ideal moisture (>1.0) even with clamping at 2.0.

---

### Complete Moisture Update Summary

Each tick, for every soil tile:

1. **Irrigation**: `+irrigationRate` if within hose coverage and irrigation is ON
2. **Rain**: `+rainToMoisture × rainIntensity` always
3. **Evaporation**: `-baseEvaporationRate × climateFactor` always
4. **Diffusion**: `+diffusionRate × (avg_neighbor_moisture - own_moisture)` from neighbors
5. **Clamp**: Constrain to `[0, maxMoisture]`

**Net Change Example**:
```
Initial moisture: 0.5
+ Irrigation: +0.05 (if covered)
+ Rain: +0.05 (moderate rain)
- Evaporation: -0.0125 (sunny day)
+ Diffusion: +0.02 (slightly dry compared to neighbors)
= New moisture: 0.5675 → clamped to [0, 2.0] → 0.5675
```

---

## Weather System

Weather evolves dynamically each tick and affects evaporation rates and rainfall.

### Weather State

```typescript
interface Weather.State {
    temperature: number;      // °C, typically 20-30
    humidity: number;         // 0-1 (relative humidity)
    sunIntensity: number;     // 0-1 (0=night, 1=full sun)
    rainIntensity: number;    // 0-1 (0=no rain, 1=heavy rain)
}
```

### Weather Evolution Algorithm

Implemented in `evolveWeather()`:

#### Day/Night Cycle

Sun intensity follows a **sinusoidal pattern** based on time of day:

```typescript
dayPhase = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;  // 0-1
sunIntensity = max(0, sin(dayPhase × 2π));
```

**Behavior**:
- Tick 0 (dawn): Sun rising, intensity ≈ 0
- Tick 25 (midday): Peak sun, intensity = 1.0
- Tick 50 (dusk): Sun setting, intensity ≈ 0
- Tick 75 (midnight): Night, intensity = 0

**Graph**:
```
Sun Intensity
1.0 |     ╱‾‾╲
    |    ╱    ╲
0.5 |   ╱      ╲
    |  ╱        ╲___
0.0 |_╱____________╲_____
    0   25  50  75  100  (ticks)
    dawn noon dusk night
```

---

#### Temperature Variation

Temperature correlates with sun intensity:

```typescript
temperature = 20 + 10 × sunIntensity;  // Range: 20-30°C
```

**Results**:
- **Night** (sun=0): 20°C
- **Midday** (sun=1): 30°C
- **Dawn/Dusk** (sun≈0.5): 25°C

---

#### Humidity Variation

Humidity inversely correlates with sun (more humid at night):

```typescript
humidity = 0.4 + 0.3 × (1 - sunIntensity);  // Range: 0.4-0.7
```

**Results**:
- **Night** (sun=0): 70% humidity
- **Midday** (sun=1): 40% humidity
- **Dawn/Dusk** (sun≈0.5): 55% humidity

---

#### Rainfall Model

Rain is **stochastic** with persistence:

```typescript
if (rand() < 0.01) {
    rainIntensity = 0.5;  // 1% chance to start moderate rain
} else {
    rainIntensity = max(0, prevRainIntensity - 0.05);  // Decay by 5% per tick
}
```

**Behavior**:
- Rain starts randomly (~1 event per 100 ticks on average)
- When rain starts, intensity = 0.5 (moderate)
- Rain decays linearly over ~10 ticks
- Most of the time: no rain (intensity = 0)

**Example Rain Event**:
```
Tick 100: Start rain (intensity = 0.5)
Tick 101: Decay (intensity = 0.45)
Tick 102: Decay (intensity = 0.40)
...
Tick 110: Decay (intensity = 0.00)
```

---

### Weather Forecast

The simulation provides a **look-ahead forecast** for rain intensity:

```typescript
forecast: number[]  // Array of rainIntensity values for next FORECAST_TICK_WINDOW ticks
```

**Generation**:
```typescript
function generateForecast() {
    let tempWeather = currentWeather;
    return Array.from({ length: 10 }, (_, k) => {
        const futureWeather = evolveWeather(seed, tempWeather, currentTick + k);
        tempWeather = futureWeather;
        return futureWeather.rainIntensity;
    });
}
```

**Usage**:
- Advanced controllers can use forecasts to optimize irrigation
- Example: Don't irrigate if heavy rain is forecasted
- Default window: 10 ticks ahead

---

## Simulation Loop

The main simulation loop is managed by the `GardenSimulation` class.

### Initialization

```typescript
const simulation = new GardenSimulation({
    width: 30,
    height: 20,
    pillarDensity: 0.04,
    plantChanceNearPath: 0.25,
    seed: 42,
    coverageRadius: 1,
    simConfig: { /* custom config */ },
    controller: new SomeController()
});
```

**Initialization Steps**:
1. Generate garden terrain (`generateGarden`)
2. Plan hose network (`planHoses`)
3. Initialize simulation state with default values
4. Set up controller (or use default always-off controller)

---

### Step Function

Each call to `simulation.step()` advances the simulation by one tick:

```typescript
step() {
    // 1. Check episode end condition
    if (tick >= episodeLength && !overrideEpisodeEnd) {
        compileResults();
        state.isRunning = false;
        return;
    }
    
    // 2. Controller decision
    const metrics = computeGardenMetrics(state, garden);
    const newIrrigationState = controller.decide(metrics, state);
    
    // 3. Track irrigation state changes
    if (newIrrigationState !== prevIrrigationState) {
        state.irrigationToggleCount += 1;
        if (newIrrigationState) {
            state.lastIrrigationTick = tick;
        }
    }
    if (newIrrigationState) {
        state.irrigationOnTicks += 1;
    }
    state.irrigationOn = newIrrigationState;
    
    // 4. Evolve weather
    state.weather = evolveWeather(seed, state.weather, tick);
    
    // 5. Update garden moisture (physics simulation)
    garden = stepGardenMoisture({
        garden,
        config: state.config,
        weather: state.weather,
        irrigationOn: state.irrigationOn
    });
    
    // 6. Calculate water usage
    state.waterUsedThisTick = computeWaterUsedThisTick();
    state.cumulativeWaterUsed += state.waterUsedThisTick;
    
    // 7. Update plant health accumulators
    updatePlantAccumulators();
    
    // 8. Generate forecast
    state.forecast = generateForecast();
    
    // 9. Increment tick counter
    state.tick += 1;
}
```

### Execution Flow

```
┌─────────────────────────────────────────┐
│ Start Tick N                            │
└────────────────┬────────────────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Check Episode End    │
      └──────────┬───────────┘
                 │ Continue
                 ▼
      ┌──────────────────────┐
      │ Compute Metrics      │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Controller Decision  │
      │ (irrigationOn?)      │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Track Irrigation     │
      │ State Changes        │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Evolve Weather       │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Update Moisture      │
      │ (4-phase physics)    │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Calculate Water Use  │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Update Plant Health  │
      │ Accumulators         │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Generate Forecast    │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Increment Tick       │
      └──────────┬───────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ End Tick N, Ready for Tick N+1        │
└────────────────────────────────────────┘
```

---

## Metrics and Evaluation

The simulation tracks various metrics to evaluate garden health and controller performance.

### Real-Time Metrics

Computed every tick via `computeGardenMetrics()`:

```typescript
interface Metrics {
    // Moisture statistics
    avgMoisture: number;            // Average moisture across all plant tiles
    minMoisture: number;            // Driest plant tile
    maxMoisture: number;            // Wettest plant tile
    
    // Plant health percentages
    percentTooDry: number;          // % plants with moisture < IDEAL_MIN_MOISTURE (0.1)
    percentTooWet: number;          // % plants with moisture > IDEAL_MAX_MOISTURE (1.0)
    
    // Irrigation state
    irrigationOn: boolean;          // Current irrigation state
    ticksSinceLastIrrigation: number; // 0 if currently on, else ticks since last on
    
    // Time context
    timeOfDay: number;              // Normalized time [0-1] within day cycle
    episodeProgress: number;        // Normalized progress [0-1] through episode
    
    // Water usage
    waterUsedThisTick: number;      // Water consumed in this tick
    cumulativeWaterUsed: number;    // Total water used so far
}
```

### Metric Calculations

#### Moisture Statistics

```typescript
for each plant tile {
    sum += tile.moisture;
    if (tile.moisture < min) min = tile.moisture;
    if (tile.moisture > max) max = tile.moisture;
    if (tile.moisture < IDEAL_MIN_MOISTURE) dryCount++;
    if (tile.moisture > IDEAL_MAX_MOISTURE) wetCount++;
}

avgMoisture = sum / totalPlants;
percentTooDry = (dryCount / totalPlants) × 100;
percentTooWet = (wetCount / totalPlants) × 100;
```

#### Time-Based Metrics

```typescript
// Time of day (0 = dawn, 0.5 = noon, 1.0 = next dawn)
timeOfDay = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;

// Episode progress (0 = start, 1.0 = end)
episodeProgress = tick / episodeLength;

// Ticks since irrigation was last on
ticksSinceLastIrrigation = irrigationOn ? 0 : (tick - lastIrrigationTick);
```

---

### Plant Health Accumulators

Throughout the episode, the simulation tracks cumulative plant health:

```typescript
updatePlantAccumulators() {
    let dryPlants = 0;
    let floodedPlants = 0;
    let healthyPlants = 0;
    
    for each plant tile {
        if (moisture < IDEAL_MIN_MOISTURE) {
            dryPlants++;
        } else if (moisture > IDEAL_MAX_MOISTURE) {
            floodedPlants++;
        } else {
            healthyPlants++;
        }
    }
    
    // Accumulate over episode
    state.dryPlantTicks += dryPlants;
    state.floodedPlantTicks += floodedPlants;
    state.healthyPlantTicks += healthyPlants;
    
    // Track peak simultaneous problems
    state.peakSimultaneousDryPlants = max(state.peakSimultaneousDryPlants, dryPlants);
    state.peakSimultaneousFloodedPlants = max(state.peakSimultaneousFloodedPlants, floodedPlants);
}
```

**Accumulator Meaning**:
- `dryPlantTicks`: Sum of (number of dry plants at each tick)
- Example: 5 plants dry for 10 ticks = 50 dry plant-ticks
- Used for final scoring and evaluation

---

## Episode Results and Scoring

When an episode completes (or `compileResults()` is called), final results are computed.

### Results Structure

```typescript
interface Results {
    // Water usage
    totalWaterUsed: number;              // Total water consumed in episode
    
    // Plant health totals
    dryPlantTicks: number;               // Cumulative dry plant-ticks
    floodedPlantTicks: number;           // Cumulative flooded plant-ticks
    healthyPlantTicks: number;           // Cumulative healthy plant-ticks
    totalPlantTicks: number;             // Total possible plant-ticks
    
    // Peak problems
    peakSimultaneousDryPlants: number;   // Worst dry plant count at any tick
    peakSimultaneousFloodedPlants: number; // Worst flooded plant count at any tick
    
    // Irrigation statistics
    irrigationToggleCount: number;       // Times irrigation changed state
    irrigationOnTicks: number;           // Ticks irrigation was active
    
    // Episode info
    tickCount: number;                   // Ticks completed
    
    // Overall performance
    finalScore: number;                  // Composite score [0-100]
}
```

### Scoring Algorithm

The final score is a weighted combination of multiple factors:

#### Score Components

```typescript
// 1. Calculate ratios
totalPlantTicks = totalPlants × tickCount;
healthRatio = healthyPlantTicks / totalPlantTicks;   // [0-1]
dryRatio = dryPlantTicks / totalPlantTicks;          // [0-1]
floodRatio = floodedPlantTicks / totalPlantTicks;    // [0-1]

// 2. Water efficiency
waterPerPlantTick = totalWaterUsed / totalPlantTicks;
waterPenalty = min(1, waterPerPlantTick / WATER_USAGE_PER_TICK);
waterScore = 1 - waterPenalty;  // [0-1], 1 = efficient, 0 = wasteful

// 3. Weighted combination
rawScore = 
    + SCORE_WEIGHT_HEALTH_RATIO × healthRatio        // 0.6 × [0-1]
    - SCORE_WEIGHT_DRY_PENALTY × dryRatio            // 0.2 × [0-1]
    - SCORE_WEIGHT_FLOOD_PENALTY × floodRatio        // 0.1 × [0-1]
    + SCORE_WEIGHT_WATER_EFFICIENCY × waterScore;    // 0.1 × [0-1]

// 4. Normalize to [0-100]
maxPossibleRaw = SCORE_WEIGHT_HEALTH_RATIO + SCORE_WEIGHT_WATER_EFFICIENCY; // 0.7
normalizedScore = (rawScore / maxPossibleRaw) × 100;

// 5. Clamp and round
finalScore = round(clamp(normalizedScore, 0, 100));
```

#### Weight Constants

From `consts.ts`:
```typescript
SCORE_WEIGHT_HEALTH_RATIO = 0.6      // Primary objective: keep plants healthy
SCORE_WEIGHT_DRY_PENALTY = 0.2       // Penalty for dryness (worse than flooding)
SCORE_WEIGHT_FLOOD_PENALTY = 0.1     // Penalty for flooding
SCORE_WEIGHT_WATER_EFFICIENCY = 0.1  // Reward water conservation
```

#### Scoring Examples

**Perfect Score (100)**:
- All plants always in ideal range (healthRatio = 1.0)
- No dry or flooded plants (dryRatio = 0, floodRatio = 0)
- Minimal water usage (waterScore = 1.0)
- Result: `(0.6×1 + 0 + 0 + 0.1×1) / 0.7 × 100 = 100`

**Moderate Score (70)**:
- 80% healthy, 15% dry, 5% flooded
- Average water efficiency (waterScore = 0.5)
- Result: `(0.6×0.8 - 0.2×0.15 - 0.1×0.05 + 0.1×0.5) / 0.7 × 100 ≈ 73`

**Poor Score (30)**:
- 50% healthy, 40% dry, 10% flooded
- Wasteful water usage (waterScore = 0.2)
- Result: `(0.6×0.5 - 0.2×0.4 - 0.1×0.1 + 0.1×0.2) / 0.7 × 100 ≈ 30`

---

### Interpretation Guide

| Score | Quality | Typical Characteristics |
|-------|---------|------------------------|
| 90-100 | Excellent | >95% healthy plants, efficient water use |
| 70-89 | Good | >75% healthy plants, some dry spells but managed |
| 50-69 | Fair | 50-75% healthy, significant dry or flood events |
| 30-49 | Poor | <50% healthy, frequent problems |
| 0-29 | Failed | Severe neglect or over-watering, most plants unhealthy |

---

## Summary

The simulation system provides a realistic, physics-based environment for testing irrigation strategies:

### Key Features

1. **Moisture Physics**: Four-phase update (irrigation, rain, evaporation, diffusion)
2. **Dynamic Weather**: Day/night cycles, temperature variation, stochastic rainfall
3. **Functional Design**: Immutable state updates enable debugging and analysis
4. **Comprehensive Metrics**: Real-time health tracking and cumulative statistics
5. **Sophisticated Scoring**: Multi-factor evaluation balancing plant health and resource efficiency

### Realism Elements

- **Physical accuracy**: Diffusion, evaporation, climate effects
- **Temporal dynamics**: Day/night cycles affect evaporation
- **Stochastic elements**: Random rainfall events
- **Resource constraints**: Water usage tracking encourages efficiency

### Use Cases

- **Controller testing**: Evaluate irrigation strategies
- **AI training**: Provide environment for reinforcement learning
- **Optimization**: Find optimal parameters for different conditions
- **Educational**: Demonstrate agricultural irrigation principles

The system strikes a balance between physical realism and computational efficiency, making it suitable for both simulation studies and machine learning applications.
