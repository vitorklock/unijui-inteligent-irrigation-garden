# Training the SmartIrrigationController

This guide explains how to train and optimize the `SmartIrrigationController` using the **Genetic Algorithm** to evolve its parameters.

## Overview

The `SmartIrrigationController` combines three AI techniques:

1. **Fuzzy Logic** – Interprets weather & metrics into risk scores
2. **Neural Network** – Predicts future dryness scenarios
3. **Genetic Algorithm** – Optimizes controller parameters

The **GA** is where training happens. It evolves `ControllerParams` by:
- Creating a population of random parameter sets
- Running episodes with each individual (using your garden simulation)
- Scoring based on plant health, water efficiency, and stability
- Selecting the best individuals and creating offspring via mutation/crossover
- Repeating for multiple generations until convergence

## What Gets Optimized?

The genetic algorithm tunes these 8 parameters:

```typescript
interface ControllerParams {
  drynessWeight: number;        // Penalty per unit of dryness
  floodWeight: number;          // Penalty per unit of flood risk
  waterWeight: number;          // Penalty for water usage
  predictionHorizonTicks: number; // NN prediction lookahead
  fuzzyDrynessScale: number;    // Fuzzy dryness sensitivity
  fuzzyFloodScale: number;      // Fuzzy flood sensitivity
  minTicksBetweenToggles: number; // Hysteresis constraint
  maxDutyCycle: number;         // Water usage cap (0-1)
}
```

The algorithm searches for weight combinations that balance:
- ✅ Plant health (minimize dry/flooded plants)
- ✅ Water efficiency (minimize waste)
- ✅ Stability (minimize rapid irrigation toggling)

## How to Train

### Option 1: Quick Start (Minimal Code)

```typescript
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';

// Define your garden
const gardenConfig = {
  width: 20,
  height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
};

// Train with defaults (20 individuals, 15 generations)
const bestChromosome = await trainSmartController(gardenConfig);

console.log('Best params:', bestChromosome.params);
console.log('Fitness:', bestChromosome.fitness);
```

### Option 2: Custom GA Configuration

```typescript
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';
import { GATrainerConfig } from '@/lib/garden/controllers/SmartIrrigationController';

const gaConfig: GATrainerConfig = {
  populationSize: 30,      // More thorough search (slower)
  generations: 25,         // Longer evolution
  elitismRate: 0.2,        // Keep top 20%
  mutationStdDev: 0.15,    // Fine-tuning (smaller = finer)
  mutationRate: 0.7,       // 70% of genes mutate each gen
  seed: 99999,             // Reproducible results
};

const bestChromosome = await trainSmartController(gardenConfig, gaConfig);
```

### Option 3: Full Control

```typescript
import {
  GeneticAlgorithmTrainer,
  EvaluationConfig,
} from '@/lib/garden/controllers/SmartIrrigationController';
import { DEFAULT_HUMIDITY_PREDICTOR_CONFIG } from '@/lib/garden/controllers/SmartIrrigationController';

const trainer = new GeneticAlgorithmTrainer({
  populationSize: 25,
  generations: 20,
  elitismRate: 0.3,
  mutationStdDev: 0.2,
  mutationRate: 0.6,
});

const results = trainer.train({
  episodesPerIndividual: 3,  // Run 3 episodes per individual
  gardenOptions: {
    width: 20,
    height: 20,
    pillarDensity: 0.1,
    plantChanceNearPath: 0.6,
    seed: 12345,
    coverageRadius: 2,
  },
  nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
});

console.log('Best chromosome:', results.bestChromosome);
console.log('Fitness history:', results.fitnessHistory);
```

### Option 4: Multi-Scenario Training

Train on diverse garden layouts for robust parameters:

```typescript
import { GeneticAlgorithmTrainer } from '@/lib/garden/controllers/SmartIrrigationController';

const trainer = new GeneticAlgorithmTrainer({
  populationSize: 30,
  generations: 20,
  elitismRate: 0.3,
  mutationStdDev: 0.2,
  mutationRate: 0.6,
});

// Factory function generates different gardens
let scenario = 0;
const gardenFactory = () => {
  const seeds = [1001, 1002, 1003];
  const widths = [15, 20, 25];
  return {
    width: widths[scenario % 3],
    height: widths[scenario % 3],
    pillarDensity: 0.08 + Math.random() * 0.04,
    plantChanceNearPath: 0.55,
    seed: seeds[scenario % 3],
    coverageRadius: 2,
  };
};

const results = trainer.train({
  episodesPerIndividual: 3,
  gardenOptions: gardenFactory,
  nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
});
```

## GA Configuration Guide

### `populationSize`
- **Smaller** (10-15): Fast, less thorough
- **Medium** (20-30): Good balance
- **Larger** (50+): Thorough, very slow

### `generations`
- **Fewer** (5-10): Quick convergence, may miss optimum
- **Medium** (15-25): Usually sufficient
- **More** (40+): Fine-tuning, diminishing returns

### `elitismRate`
- **Higher** (0.4+): Preserves good solutions, slower adaptation
- **Lower** (0.1-0.2): More variation, riskier

### `mutationStdDev`
- **Smaller** (0.05-0.1): Fine-tuning existing good solutions
- **Larger** (0.3-0.5): Broader exploration

### `mutationRate`
- **Lower** (0.3-0.4): Conserve good genes
- **Higher** (0.7-0.9): Promote variation

## Typical Training Times

On a modern laptop (assuming browser/Node.js):

| Config | Time | Notes |
|--------|------|-------|
| 20 pop × 10 gen × 2 episodes | ~30s | Quick test |
| 25 pop × 15 gen × 2 episodes | ~60s | Recommended baseline |
| 30 pop × 20 gen × 3 episodes | ~2-3min | Thorough |
| 50 pop × 25 gen × 4 episodes | ~5-10min | Very thorough |

## Using Trained Parameters

Once you have optimized parameters, use them at runtime:

```typescript
import {
  SmartIrrigationController,
  FuzzyClimateEvaluator,
  HumidityPredictorNN,
  DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
} from '@/lib/garden/controllers/SmartIrrigationController';

const OPTIMIZED_PARAMS = {
  drynessWeight: 1.8,
  floodWeight: 0.9,
  waterWeight: 0.35,
  predictionHorizonTicks: 12,
  fuzzyDrynessScale: 0.55,
  fuzzyFloodScale: 0.38,
  minTicksBetweenToggles: 4,
  maxDutyCycle: 0.62,
};

const fuzzy = new FuzzyClimateEvaluator();
const nn = new HumidityPredictorNN(DEFAULT_HUMIDITY_PREDICTOR_CONFIG);
const controller = new SmartIrrigationController(fuzzy, nn, OPTIMIZED_PARAMS);

// Use in simulation
const sim = new GardenSimulation({
  width: 20,
  height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
  controller,
});
```

## Advanced: Training Multiple Designs

You can train separate parameter sets for different garden types:

```typescript
// Train for small, dense gardens
const smallGardenParams = await trainSmartController({
  width: 10,
  height: 10,
  pillarDensity: 0.15,
  plantChanceNearPath: 0.7,
  seed: 1001,
  coverageRadius: 1,
});

// Train for large, sparse gardens
const largeGardenParams = await trainSmartController({
  width: 40,
  height: 40,
  pillarDensity: 0.05,
  plantChanceNearPath: 0.4,
  seed: 2001,
  coverageRadius: 3,
});

// Runtime: choose based on garden size
const params = gardenWidth < 15 ? smallGardenParams : largeGardenParams;
```

## Tips for Better Results

1. **Increase `episodesPerIndividual`** if you want stable, robust parameters
   - More episodes = better average fitness = more robust to variation

2. **Use a fixed `seed`** for reproducibility during development
   - Debug specific scenarios more easily

3. **Train on diverse scenarios** if you want general-purpose parameters
   - Single-scenario training may overfit

4. **Start conservative, then explore**
   - First: `populationSize: 15, generations: 10, episodesPerIndividual: 1`
   - Then: `populationSize: 30, generations: 20, episodesPerIndividual: 2`

5. **Monitor fitness progression**
   - If plateau early, increase `mutationStdDev` or reduce `elitismRate`
   - If noisy, increase `episodesPerIndividual` and reduce mutation

6. **Export results for comparison**
   - Compare trained params against defaults
   - Use version control to track best params over time

## Fitness Function

The fitness score is derived from simulation results:

```
fitness = α * (healthyPlantTicks / totalPlantTicks)
        - β * (dryPlantTicks / totalPlantTicks)
        - γ * (floodedPlantTicks / totalPlantTicks)
        - δ * (waterUsedPerPlant - baseline) / baseline
        - ε * (toggle_count / episode_length)
```

Where:
- `α` = weight on health (high, ~40%)
- `β` = penalty for dryness (higher than flooding, ~30%)
- `γ` = penalty for flooding (~15%)
- `δ` = water efficiency (~10%)
- `ε` = stability/toggle penalty (~5%)

(These are defined in `consts.ts` as `SCORE_WEIGHT_*`)

## Next Steps

1. **Train** your parameters using one of the examples above
2. **Export** the best `ControllerParams` to a TypeScript constant
3. **Commit** to version control for reproducibility
4. **Test** on diverse garden configs to ensure generalization
5. **Iterate** with different GA configs if needed
6. **Deploy** the optimized controller to your UI

See `TrainingExamples.ts` for runnable examples!
