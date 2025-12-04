# Training Checklist

Quick checklist to get from zero to trained controller parameters.

## ✅ Phase 1: Understand (5 min)

- [ ] Read `QUICK_START_TRAINING.md` TL;DR section
- [ ] Review "What Gets Trained?" section
- [ ] Understand the 4 training approaches

**Time:** 5 minutes

---

## ✅ Phase 2: Setup (5 min)

Choose ONE approach:

### Option A: One-Liner (Fastest)
- [ ] Import `trainSmartController`
- [ ] Prepare `gardenConfig` object
- [ ] Copy one-liner code

### Option B: React UI (Interactive)
- [ ] Copy `GATrainingUI.tsx`
- [ ] Add to your page/component
- [ ] Customize styling if needed

### Option C: Node.js (Offline)
- [ ] Copy `train.example.ts`
- [ ] Rename to `train.ts`
- [ ] Verify paths are correct

### Option D: Full Control (Advanced)
- [ ] Import `GeneticAlgorithmTrainer`
- [ ] Create GA config object
- [ ] Create evaluation config object

**Time:** 5 minutes

---

## ✅ Phase 3: Run Training (1-10 min)

### Approach A (One-Liner)
```typescript
const params = await trainSmartController(gardenConfig);
console.log('Result:', params);
```

### Approach B (React UI)
- [ ] Click "Start Training" button
- [ ] Watch progress bar
- [ ] See results appear

### Approach C (Node.js)
```bash
npx ts-node train.ts
```

### Approach D (Full Control)
```typescript
const trainer = new GeneticAlgorithmTrainer(gaConfig);
const results = trainer.train(evalConfig);
console.log('Best params:', results.bestChromosome.params);
```

**Time:** 30 seconds - 10 minutes (depending on config)

---

## ✅ Phase 4: Validate (2 min)

- [ ] Check fitness score (should be reasonable, 30-70)
- [ ] Review parameters (should not be zeros or edge values)
- [ ] Compare against defaults if available

**Time:** 2 minutes

---

## ✅ Phase 5: Save (2 min)

### Save as TypeScript Constant
```typescript
export const OPTIMIZED_PARAMS: ControllerParams = {
  // ... copy from results
};
```

- [ ] Create `OptimizedParams.ts` file
- [ ] Paste parameters
- [ ] Verify types match

### OR Save as JSON
- [ ] Export to JSON file
- [ ] Version control it
- [ ] Document where/when trained

**Time:** 2 minutes

---

## ✅ Phase 6: Use (2 min)

```typescript
import { OPTIMIZED_PARAMS } from '@/path/to/OptimizedParams';
import { SmartIrrigationController } from '@/lib/garden/controllers/SmartIrrigationController';

const controller = new SmartIrrigationController(
  new FuzzyClimateEvaluator(),
  new HumidityPredictorNN(nnConfig),
  OPTIMIZED_PARAMS
);

// Use in simulation
const sim = new GardenSimulation({ ..., controller });
```

- [ ] Import optimized params
- [ ] Create controller with params
- [ ] Use in simulation
- [ ] Test results

**Time:** 2 minutes

---

## ✅ Phase 7: Commit (1 min)

- [ ] Add `OptimizedParams.ts` to git
- [ ] Commit with message: "Add trained controller params (fitness: X.XX)"
- [ ] Push to repository

**Time:** 1 minute

---

## 🏁 DONE!

**Total Time: 15-25 minutes**

You now have:
- ✅ Trained controller parameters
- ✅ Optimized for your garden setup
- ✅ Ready to use in production
- ✅ Versioned and reproducible

---

## 🚀 Next Steps (Optional)

### Fine-Tune (If not satisfied with results)
- [ ] Adjust GA config (more generations, larger population)
- [ ] Train on diverse scenarios
- [ ] Increase episodes per individual
- [ ] Re-run training

### Advanced (If you want to go deeper)
- [ ] Read full `TRAINING_GUIDE.md`
- [ ] Experiment with different garden sizes
- [ ] Compare multiple parameter sets
- [ ] Study `GeneticAlgorithmTrainer.ts` source
- [ ] Implement custom fitness functions

### Production (If ready to deploy)
- [ ] Test trained controller thoroughly
- [ ] Compare against baseline controllers
- [ ] Measure performance improvements
- [ ] Document parameters and setup
- [ ] Set up monitoring/metrics

---

## 📚 Quick Reference

| Task | File | Time |
|------|------|------|
| Quick start | `QUICK_START_TRAINING.md` | 5 min |
| Full guide | `TRAINING_GUIDE.md` | 15 min |
| Examples | `TrainingExamples.ts` | - |
| Node.js | `train.example.ts` | - |
| React UI | `GATrainingUI.tsx` | - |
| Help | `TRAINING_RESOURCES.md` | - |

---

## ⚡ TL;DR for Impatient People

```typescript
// 1. Import
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';

// 2. Train (takes ~1 min)
const params = await trainSmartController({
  width: 20, height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
});

// 3. Use
const controller = new SmartIrrigationController(fuzzy, nn, params);

// 4. Done!
```

**Total time: 2 minutes ⚡**

---

**You've got this! 🚀**
