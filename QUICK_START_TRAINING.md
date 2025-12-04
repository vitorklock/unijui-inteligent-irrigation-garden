# How to Train SmartIrrigationController Parameters

Your `SmartIrrigationController` uses **three AI techniques** combined with a **Genetic Algorithm** that evolves its parameters. Here's everything you need to know about training.

## TL;DR: Quick Start

```typescript
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';

// Train with a single line
const bestParams = await trainSmartController({
  width: 20,
  height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
});

console.log('Optimized params:', bestParams);
// Result: ControllerParams ready to use
```

## What Gets Trained?

The GA evolves these 8 parameters:

| Parameter | Role | Range | Example |
|-----------|------|-------|---------|
| `drynessWeight` | Penalty per unit of dryness in prediction | 0-3 | 1.8 |
| `floodWeight` | Penalty per unit of flood risk | 0-2 | 0.9 |
| `waterWeight` | Penalty for using water | 0-1 | 0.35 |
| `predictionHorizonTicks` | How far ahead NN predicts | 5-35 | 12 |
| `fuzzyDrynessScale` | How sensitive fuzzy rules are to dryness | 0-1 | 0.55 |
| `fuzzyFloodScale` | How sensitive fuzzy rules are to flooding | 0-1 | 0.38 |
| `minTicksBetweenToggles` | Minimum ticks between irrigation changes | 1-11 | 4 |
| `maxDutyCycle` | Max % of episode with irrigation ON | 0.3-0.7 | 0.62 |

The algorithm finds the **best combination** that balances plant health, water efficiency, and stability.

## Training Approaches

### Approach 1: One-Liner (Fastest)

```typescript
const params = await trainSmartController(gardenConfig);
```

Uses defaults: 20 individuals, 15 generations, 2 episodes per individual.

---

### Approach 2: Custom GA Settings

```typescript
const params = await trainSmartController(gardenConfig, {
  populationSize: 30,      // More thorough
  generations: 25,         // Longer evolution
  elitismRate: 0.2,        // Keep best 20%
  mutationStdDev: 0.15,    // How much to tweak genes
  mutationRate: 0.7,       // 70% chance each gene mutates
});
```

---

### Approach 3: Full Control

For maximum flexibility, use `GeneticAlgorithmTrainer` directly:

```typescript
import { GeneticAlgorithmTrainer } from '@/lib/garden/controllers/SmartIrrigationController';

const trainer = new GeneticAlgorithmTrainer({
  populationSize: 30,
  generations: 20,
  elitismRate: 0.3,
  mutationStdDev: 0.2,
  mutationRate: 0.65,
  seed: 12345,  // For reproducibility
});

const results = trainer.train({
  episodesPerIndividual: 3,  // More robust if slow
  gardenOptions: {...},
  nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
});

console.log('Best params:', results.bestChromosome.params);
console.log('Fitness history:', results.fitnessHistory);
console.log('Top performers:', results.finalPopulation.slice(0, 5));
```

---

### Approach 4: Multi-Scenario Training

Train on **diverse gardens** to get robust parameters:

```typescript
const trainer = new GeneticAlgorithmTrainer({...});

let scenario = 0;
const gardenFactory = () => {
  const configs = [
    { width: 15, height: 15, pillarDensity: 0.15, seed: 1001 },
    { width: 20, height: 20, pillarDensity: 0.10, seed: 1002 },
    { width: 30, height: 30, pillarDensity: 0.05, seed: 1003 },
  ];
  return {
    ...configs[scenario++ % configs.length],
    plantChanceNearPath: 0.6,
    coverageRadius: 2,
  };
};

const results = trainer.train({
  episodesPerIndividual: 3,
  gardenOptions: gardenFactory,  // Factory = train on diverse gardens
  nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
});
```

Trained on diverse scenarios → more robust parameters.

---

## Understanding the GA

The algorithm works in generations:

```
Gen 1:  Random population (20 individuals)
        ↓ Evaluate (run episodes, compute fitness)
        ↓ Keep top 30% (elite)
        ↓ Create offspring via mutation/crossover
        ↓ Replace rest of population

Gen 2:  Elite + Offspring
        ↓ Evaluate
        ↓ Keep top 30%
        ...

Gen N:  Best population found
        → Return best individual
```

**Fitness = episode finalScore** (balances health, dryness, flooding, water use)

---

## Configuration Tuning

### If training is too slow:
- ↓ Reduce `populationSize` (15 instead of 25)
- ↓ Reduce `generations` (10 instead of 20)
- ↓ Reduce `episodesPerIndividual` (1 instead of 2)

### If results plateau early (not improving):
- ↑ Increase `mutationStdDev` (0.3 instead of 0.15)
- ↓ Reduce `elitismRate` (0.2 instead of 0.3)
- ↑ Increase `populationSize` (more variation)

### If you want better robustness:
- ↑ Increase `episodesPerIndividual` (3-4 instead of 1)
- Use `gardenFactory` to train on diverse configs

---

## Timing Estimates

On a typical laptop:

| Config | Episodes | Time |
|--------|----------|------|
| 15 pop × 5 gen × 1 ep | 75 | ~15s |
| 20 pop × 10 gen × 1 ep | 200 | ~30s |
| **25 pop × 15 gen × 2 ep** | **750** | **~60s** |
| 30 pop × 20 gen × 2 ep | 1200 | ~2-3min |
| 40 pop × 25 gen × 3 ep | 3000 | ~5-8min |

(Each episode ≈ 100 ticks × decision time)

---

## Using Trained Parameters

Once training completes:

```typescript
// 1. Save the params
const trained = await trainSmartController(gardenConfig);

// 2. Export to TypeScript (copy-paste into your code)
export const OPTIMIZED_CONTROLLER_PARAMS = {
  drynessWeight: 1.75,
  floodWeight: 0.92,
  waterWeight: 0.33,
  predictionHorizonTicks: 11,
  fuzzyDrynessScale: 0.54,
  fuzzyFloodScale: 0.39,
  minTicksBetweenToggles: 3,
  maxDutyCycle: 0.61,
};

// 3. Use in simulation
const fuzzy = new FuzzyClimateEvaluator();
const nn = new HumidityPredictorNN(DEFAULT_HUMIDITY_PREDICTOR_CONFIG);
const controller = new SmartIrrigationController(
  fuzzy,
  nn,
  OPTIMIZED_CONTROLLER_PARAMS  // ← use trained params
);

// 4. Run simulation
const sim = new GardenSimulation({
  width: 20,
  height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
  controller,  // ← pass trained controller
});

while (sim.state.tick < sim.state.episodeLength) {
  sim.step();
}

const results = sim.compileResults();
console.log('Results:', results);
```

---

## File Reference

All training code lives in `controllers/SmartIrrigationController/`:

| File | Purpose |
|------|---------|
| `GeneticAlgorithmTrainer.ts` | Core GA implementation |
| `TrainingExamples.ts` | 4 runnable examples |
| `types.ts` | ControllerParams interface + defaults |
| `SmartIrrigationController.ts` | The actual controller |
| `FuzzyClimateEvaluator.ts` | Fuzzy logic component |
| `HumidityPredictorNN.ts` | Neural network component |

---

## Running from Node.js

A complete example Node.js script is in `train.example.ts`:

```bash
# Copy it
cp train.example.ts train.ts

# Run it (requires ts-node)
npx ts-node train.ts
```

This will:
1. Train the GA
2. Print fitness progression
3. Save results to `trained-params.json`
4. Export TypeScript constant to `trained-params.ts`

---

## Best Practices

1. **Start simple, iterate**
   ```typescript
   // First: quick test
   const params1 = await trainSmartController(config);
   
   // Then: more thorough
   const params2 = await trainSmartController(config, {
     populationSize: 30,
     generations: 20,
   });
   ```

2. **Train on diverse scenarios** for robustness
   ```typescript
   // Don't just train on one garden size
   const gardenFactory = () => randomGardenSize();
   ```

3. **Use a seed for reproducibility during development**
   ```typescript
   new GeneticAlgorithmTrainer({
     seed: 42,  // Always gets same results
   })
   ```

4. **Save and version control your results**
   ```typescript
   // In git
   // trained-params.json ← commit this
   // OPTIMIZED_PARAMS.ts ← and this
   ```

5. **Increase `episodesPerIndividual` if you see high variance**
   - More episodes = more stable fitness estimates

6. **Monitor fitness history to spot problems**
   ```typescript
   results.fitnessHistory.forEach((f, gen) => {
     console.log(`Gen ${gen}: ${f}`);
   });
   // Should generally increase with plateaus acceptable
   ```

---

## Advanced: Comparing Strategies

Train multiple controllers and compare:

```typescript
const dryGarden = { width: 15, height: 15, ... };
const wetGarden = { width: 20, height: 20, ... };

const dryParams = await trainSmartController(dryGarden);
const wetParams = await trainSmartController(wetGarden);

// In runtime: choose based on condition
const params = predictedClimate.dryness > 0.5
  ? dryParams
  : wetParams;
```

---

## Why GA Over Direct Search?

- ✅ **No calculus needed** – GA works with discrete, multi-modal search spaces
- ✅ **Handles constraints** – Easy to add bounds and penalties
- ✅ **Parallelizable** – Can run multiple GA instances in parallel
- ✅ **Interpretable** – Results are actual parameter values, not a black box
- ✅ **Reproducible** – With seed, always get same results
- ⚠️ **Not optimal** – GA finds local optima, not global best (but good enough!)

---

## Next Steps

1. **Run a quick training** with defaults
2. **Save the params** to a constant
3. **Compare** against default/baseline controllers
4. **Commit** to git for reproducibility
5. **Iterate** if needed with different GA settings

**See `TRAINING_GUIDE.md` for detailed options and examples!**

Happy training! 🌱🧬✨
