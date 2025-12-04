# SmartIrrigationController Training Architecture

## What You Now Have

A complete system for evolving optimal irrigation controller parameters using a **Genetic Algorithm**:

### Core Components

1. **`FuzzyClimateEvaluator.ts`**
   - Fuzzy logic rules to interpret weather + metrics
   - Outputs: drynessRisk [0-1], floodRisk [0-1]

2. **`HumidityPredictorNN.ts`**
   - 2-layer neural network: input → ReLU hidden → sigmoid output
   - Predicts future dryness for irrigation ON/OFF scenarios
   - Weights freeze at runtime (trained offline)

3. **`SmartIrrigationController.ts`**
   - Main controller orchestrating fuzzy + NN + GA params
   - Decision pipeline: evaluate risks → predict future → score actions → apply constraints

4. **`GeneticAlgorithmTrainer.ts`** ⭐ NEW
   - Runs multi-generation evolution
   - Fitness = simulation episode finalScore
   - Selection, crossover, mutation
   - Reproducible with optional seed

5. **`TrainingExamples.ts`** ⭐ NEW
   - 4 complete runnable examples
   - From quick-start to advanced multi-scenario training

## Quick Start

### Minimal Code
```typescript
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';

const params = await trainSmartController({
  width: 20, height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
});

console.log('Optimized params:', params);
// Use in: new SmartIrrigationController(fuzzy, nn, params)
```

### Custom GA Config
```typescript
const params = await trainSmartController(gardenConfig, {
  populationSize: 30,
  generations: 20,
  elitismRate: 0.3,
  mutationStdDev: 0.15,
  mutationRate: 0.7,
});
```

### Full Control
```typescript
const trainer = new GeneticAlgorithmTrainer({...config});
const results = trainer.train({
  episodesPerIndividual: 3,
  gardenOptions: {...},
  nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
});
```

## GA Algorithm Flow

```
1. INITIALIZE
   ├─ Create random population (N individuals)
   └─ Each individual = random ControllerParams

2. REPEAT for G generations
   ├─ EVALUATE
   │  ├─ For each individual:
   │  │  ├─ Create SmartIrrigationController with their params
   │  │  ├─ Run M episodes (different gardens/seeds)
   │  │  └─ Compute average finalScore
   │  └─ Sort population by fitness (descending)
   │
   ├─ TRACK
   │  └─ Record best fitness for this generation
   │
   ├─ SELECT ELITE
   │  └─ Keep top E% (e.g., 30%) of population
   │
   ├─ CREATE OFFSPRING
   │  ├─ While offspring < (N - E)
   │  │  ├─ Pick 2 random parents from elite
   │  │  ├─ Crossover: blend their genes (random interpolation)
   │  │  ├─ Mutate: add Gaussian noise to each gene
   │  │  └─ Clamp: keep params in valid ranges
   │  └─ Add to offspring pool
   │
   └─ REPLACE POPULATION
      └─ Population = Elite + Offspring

3. RETURN
   ├─ Best chromosome found
   ├─ Fitness history (per generation)
   └─ Final population
```

## Parameters That Evolve

```typescript
interface ControllerParams {
  // Cost weights
  drynessWeight: number;        // 0-3 (penalty per unit dry)
  floodWeight: number;          // 0-2 (penalty per unit wet)
  waterWeight: number;          // 0-1 (penalty for ON state)

  // NN lookahead
  predictionHorizonTicks: number; // 5-35 ticks ahead

  // Fuzzy scaling
  fuzzyDrynessScale: number;    // 0-1 (risk sensitivity)
  fuzzyFloodScale: number;      // 0-1 (risk sensitivity)

  // Hysteresis / stability
  minTicksBetweenToggles: number; // 1-11 ticks min gap
  maxDutyCycle: number;         // 0.3-0.7 (water cap)
}
```

## What the Fitness Function Measures

From `GardenSimulation.compileResults()`:

```
finalScore = α * healthRatio
           - β * dryRatio
           - γ * floodRatio
           - δ * waterPenalty
```

Where:
- `healthRatio` = (plants in ideal moisture range) / total plants
- `dryRatio` = (dry plants) / total plants
- `floodRatio` = (flooded plants) / total plants
- `waterPenalty` = relative water use vs baseline

**Higher score = better params**

GA maximizes this across episodes.

## Typical Training Session

| Step | Time | Notes |
|------|------|-------|
| Initialization | <1s | Random params |
| Gen 1-5 | ~30s | Population improves rapidly |
| Gen 6-15 | ~40s | Finer tuning, diminishing returns |
| Gen 16-20 | ~30s | Plateau, not much improvement |
| **Total** | **~2-3 min** | For 25 pop × 20 gen × 2 episodes |

## Why This Approach?

### ✅ Advantages
- **Offline training** – No need to train online, final params are static
- **Interpretable** – Each param has clear meaning
- **Reproducible** – Use seed for consistency
- **Parallelizable** – Can run multiple GA instances, pick best
- **Flexible** – Easy to add new constraints or weights
- **Robust** – GA finds params that work across diverse scenarios

### ⚠️ Limitations
- **Computation time** – Each generation runs many episodes (slow on edge cases)
- **Sensitivity** – Different garden types may need different params
- **No guarantees** – GA is stochastic, may converge to local optima
- **NN is frozen** – Don't train NN weights online; too expensive

## Integration Points

### In Your UI (React/Next.js)

```typescript
// 1. Training page/endpoint
async function trainController() {
  const params = await trainSmartController(gardenConfig);
  setOptimizedParams(params);
}

// 2. Runtime: Use trained params
const controller = new SmartIrrigationController(
  new FuzzyClimateEvaluator(),
  new HumidityPredictorNN(NN_CONFIG),
  optimizedParams  // <-- from training
);
```

### In Your Simulation

```typescript
const sim = new GardenSimulation({
  width: 20,
  height: 20,
  ...otherOptions,
  controller,  // <-- SmartIrrigationController
});

while (sim.state.tick < sim.state.episodeLength) {
  sim.step();
}

const results = sim.compileResults();
```

## Next Steps

1. **Run training** using `TrainingExamples.ts` as template
2. **Save best params** to a constant (e.g., `OPTIMIZED_PARAMS`)
3. **Commit to git** for reproducibility
4. **Compare** against default/baseline controllers
5. **Test robustness** on various garden configurations
6. **Iterate** if needed with different GA settings

## Files Structure

```
controllers/
├── SmartIrrigationController/
│   ├── SmartIrrigationController.ts    (main controller)
│   ├── FuzzyClimateEvaluator.ts        (fuzzy logic)
│   ├── HumidityPredictorNN.ts          (neural net)
│   ├── types.ts                        (interfaces + defaults)
│   ├── GeneticAlgorithmTrainer.ts      (GA trainer) ⭐ NEW
│   ├── TrainingExamples.ts             (examples) ⭐ NEW
│   └── index.ts                        (exports)
└── ... (other controllers)

/ (repo root)
├── TRAINING_GUIDE.md                   (detailed guide) ⭐ NEW
└── ...
```

## Documentation

- **`TRAINING_GUIDE.md`** – Comprehensive training guide with all options
- **`TrainingExamples.ts`** – 4 runnable examples, from simple to advanced
- **`GeneticAlgorithmTrainer.ts`** – Inline comments explaining GA mechanics

Good luck training! 🌱🤖✨
