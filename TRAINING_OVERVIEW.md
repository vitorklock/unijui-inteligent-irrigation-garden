# SmartIrrigationController Training System

Complete solution for training and optimizing controller parameters using a **Genetic Algorithm**.

## 📦 What You Have

### Core Files Created:

```
src/lib/garden/controllers/SmartIrrigationController/
├── GeneticAlgorithmTrainer.ts      (GA engine - NEW)
├── TrainingExamples.ts             (4 runnable examples - NEW)
├── types.ts                         (ControllerParams + defaults)
├── SmartIrrigationController.ts     (main controller)
├── FuzzyClimateEvaluator.ts        (fuzzy logic)
├── HumidityPredictorNN.ts          (neural net)
└── index.ts                         (exports)

src/app/components/
└── GATrainingUI.tsx                 (React UI - NEW)

Root documentation/
├── QUICK_START_TRAINING.md          (Quick reference - NEW)
├── TRAINING_GUIDE.md                (Comprehensive guide - NEW)
├── SMART_CONTROLLER_TRAINING.md     (Architecture overview - NEW)
└── train.example.ts                 (Node.js script template - NEW)
```

## 🚀 Quick Start (3 Steps)

### Step 1: Import
```typescript
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';
```

### Step 2: Run
```typescript
const bestParams = await trainSmartController({
  width: 20,
  height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
});
```

### Step 3: Use
```typescript
const controller = new SmartIrrigationController(fuzzy, nn, bestParams);
```

**Done!** You now have optimized parameters.

---

## 🎯 Training Methods

### Method 1: Simple (One-liner)
```typescript
const params = await trainSmartController(gardenConfig);
```
- Time: ~60s
- Approach: Sensible defaults (20 individuals, 15 generations)

### Method 2: Custom GA Settings
```typescript
const params = await trainSmartController(gardenConfig, {
  populationSize: 30,
  generations: 20,
  elitismRate: 0.2,
  mutationStdDev: 0.15,
  mutationRate: 0.7,
});
```
- Time: ~2-3 min
- Approach: More thorough search

### Method 3: Full Control
```typescript
const trainer = new GeneticAlgorithmTrainer(gaConfig);
const results = trainer.train(evaluationConfig);
```
- Time: Configurable
- Approach: Maximum flexibility, access to full population history

### Method 4: Multi-Scenario
```typescript
trainer.train({
  episodesPerIndividual: 3,
  gardenOptions: () => randomGarden(),  // Factory = diverse
  nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
});
```
- Time: ~5-10 min
- Approach: Train on diverse gardens for robust parameters

---

## 🧬 How the GA Works

```
Initialize: N random individuals
    ↓
For each generation:
    ├─ Evaluate: Run episodes, compute fitness
    ├─ Select: Keep top E% (elite)
    ├─ Crossover: Blend parent params
    ├─ Mutate: Add random noise
    ├─ Replace: Population = Elite + Offspring
    └─ Repeat
    ↓
Return: Best individual found
```

**Fitness = Episode Score** (balances plant health, water use, stability)

---

## 📊 8 Evolved Parameters

| Parameter | Role | Range | Example |
|-----------|------|-------|---------|
| `drynessWeight` | Dryness penalty | 0-3 | 1.8 |
| `floodWeight` | Flood penalty | 0-2 | 0.9 |
| `waterWeight` | Water usage cost | 0-1 | 0.35 |
| `predictionHorizonTicks` | NN lookahead | 5-35 | 12 |
| `fuzzyDrynessScale` | Dryness sensitivity | 0-1 | 0.55 |
| `fuzzyFloodScale` | Flood sensitivity | 0-1 | 0.38 |
| `minTicksBetweenToggles` | Min gap between changes | 1-11 | 4 |
| `maxDutyCycle` | Max irrigation fraction | 0.3-0.7 | 0.62 |

---

## ⏱️ Timing Guide

| Config | Episodes | Total | Notes |
|--------|----------|-------|-------|
| 15 pop, 5 gen | 75 | ~15s | Quick test |
| 20 pop, 10 gen | 200 | ~30s | Fast |
| 25 pop, 15 gen, 2 ep | 750 | ~60s | **Default** |
| 30 pop, 20 gen, 2 ep | 1200 | ~2-3 min | Thorough |
| 40 pop, 25 gen, 3 ep | 3000 | ~5-10 min | Very thorough |

---

## 💾 Using Results

### Export JSON
```typescript
const results = trainer.train(...);
const json = JSON.stringify(results.bestChromosome.params);
// → Save to file, version control, etc.
```

### Export TypeScript
```typescript
export const OPTIMIZED_PARAMS: ControllerParams = {
  drynessWeight: 1.75,
  floodWeight: 0.92,
  waterWeight: 0.33,
  // ...
};
```

### Use in Production
```typescript
const controller = new SmartIrrigationController(
  fuzzy,
  nn,
  OPTIMIZED_PARAMS
);
```

---

## 📚 Documentation

| Document | Purpose | Best For |
|----------|---------|----------|
| **QUICK_START_TRAINING.md** | Quick reference | Getting started |
| **TRAINING_GUIDE.md** | Comprehensive guide | All options & tips |
| **TrainingExamples.ts** | 4 runnable examples | Copy-paste code |
| **train.example.ts** | Node.js script | Offline training |
| **GATrainingUI.tsx** | React component | Browser UI |

---

## 🌍 Where to Train

### Browser (React/Next.js)
Use the `GATrainingUI` component:
```typescript
import { GATrainingUI } from '@/app/components/GATrainingUI';

// In your page
<GATrainingUI />
```

### Node.js (Offline)
Use `train.example.ts`:
```bash
npx ts-node train.ts
```

### Anywhere
Import and call directly:
```typescript
const params = await trainSmartController(config);
```

---

## 🎓 Learning Path

1. **Understand the concepts** (5 min)
   - Read: QUICK_START_TRAINING.md intro section

2. **Run a quick training** (2 min)
   - Code: One-liner example
   - See how it works in action

3. **Customize settings** (5 min)
   - Read: Configuration tuning section
   - Experiment with population size, generations

4. **Train on diverse scenarios** (10 min)
   - Read: Multi-scenario section
   - Use garden factory

5. **Advanced usage** (optional)
   - Read: TRAINING_GUIDE.md
   - Use direct trainer instantiation

---

## ✅ Checklist: Getting Started

- [ ] Read QUICK_START_TRAINING.md (TL;DR section)
- [ ] Run one-liner training example
- [ ] Inspect the results
- [ ] Save parameters to constant
- [ ] Use in simulation
- [ ] Compare against baseline
- [ ] Commit params to git

---

## 🔧 Configuration Quick Ref

```typescript
// Fast training (acceptable results)
{
  populationSize: 15,
  generations: 10,
  elitismRate: 0.3,
  mutationStdDev: 0.25,
  mutationRate: 0.65,
}

// Balanced (recommended)
{
  populationSize: 25,
  generations: 15,
  elitismRate: 0.3,
  mutationStdDev: 0.2,
  mutationRate: 0.65,
}

// Thorough (best results, slow)
{
  populationSize: 40,
  generations: 25,
  elitismRate: 0.2,
  mutationStdDev: 0.15,
  mutationRate: 0.7,
}
```

---

## 🎯 Success Indicators

✅ **Good training**:
- Fitness improves each generation
- Plateau after 50-70% complete
- Best fitness: typically 40-70 (out of 100)

⚠️ **Issues to watch**:
- No improvement → increase mutation
- Stuck at low fitness → increase population
- Crashes → check episode length, garden validity

---

## 📖 Next Steps

1. **Choose your training method** (see Quick Start above)
2. **Run training** (~60s for default)
3. **Save results** (export JSON/TS)
4. **Integrate into app** (use OPTIMIZED_PARAMS)
5. **Test thoroughly** (compare against baselines)

---

**Have fun training your controller! 🚀🌱🧬**

Questions? Check the full docs in TRAINING_GUIDE.md or see examples in TrainingExamples.ts
