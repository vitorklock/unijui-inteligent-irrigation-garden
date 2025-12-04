# Intelligent Irrigation Garden Simulator

AI-driven garden irrigation simulation using **A* pathfinding**, **Fuzzy Logic**, **Neural Networks**, and **Genetic Algorithms**.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## AI Techniques

- **A* Algorithm** – Optimal hose pathfinding
- **Fuzzy Logic** – Climate risk evaluation
- **Neural Network** – Future dryness prediction
- **Genetic Algorithm** – Parameter optimization

## Train Smart Controller

```typescript
import { trainSmartController } from '@/lib/garden/controllers/SmartIrrigationController';

const params = await trainSmartController({
  width: 20, height: 20,
  pillarDensity: 0.1,
  plantChanceNearPath: 0.6,
  seed: 12345,
  coverageRadius: 2,
});
```

See `QUICK_START_TRAINING.md` for full guide.
