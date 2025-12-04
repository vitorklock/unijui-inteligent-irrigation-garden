# Redis Integration for Trained Parameters

## Quick Start

### 1. Start Redis

```bash
redis-server
```

### 2. Train & Save Parameters

In the **GA Training** tab:

1. Configure your GA settings (population, generations, etc.)
2. Click **Start Training**
3. Wait for training to complete
4. Enter a name for your training
5. Click **💾 Save** to store in Redis

### 3. Use Trained Parameters

The trained parameters are automatically available across your app:

```tsx
import { useTrainedParams } from '@/hooks/useTrainedParams';
import { SmartIrrigationController } from '@/lib/garden/controllers/SmartIrrigationController';

function MyComponent() {
  const { best, trainings, loading } = useTrainedParams();

  if (best) {
    // Use best trained parameters
    const controller = new SmartIrrigationController(
      fuzzy, 
      nn, 
      best.params  // ← Trained params from Redis
    );
  }
}
```

## Features

### Save Training Results
- Automatically saved to Redis with metadata
- Include name, fitness, timestamp, and GA config
- Quick lookup by ID

### Load Parameters
- Fetch all saved trainings
- Get the best training (highest fitness)
- Load specific training by ID

### Use Across App
- **GA Training Tab**: Save/load/delete trainings
- **Garden View**: Use trained params via `useTrainedParams()` hook
- **Parallel Simulations**: Compare multiple trained controllers
- **API Routes**: `/api/trainings` and `/api/trainings/[id]`

## API

### Hooks

#### `useTrainedParams()`
```tsx
const { 
  trainings,  // All saved trainings
  best,       // Training with highest fitness
  loading,    // Loading state
  error,      // Error message if any
  refresh     // Reload from Redis
} = useTrainedParams();
```

#### `useTraining(id)`
```tsx
const { 
  training,   // Specific training
  loading,
  error 
} = useTraining('training-id');
```

### RedisTrainingStore

Direct Redis access (server-side or advanced use):

```tsx
import { getTrainingStore } from '@/lib/redis/trainingStore';

const store = getTrainingStore();
await store.connect();

// Save
await store.save(chromosome, 'My Training', config);

// Load all
const trainings = await store.listAll();

// Load one
const training = await store.load(id);

// Get best
const best = await store.getBest();

// Delete
await store.delete(id);
```

## Data Structure

### SavedTraining
```typescript
interface SavedTraining {
  id: string;
  name: string;
  params: ControllerParams;
  fitness: number;
  timestamp: string;
  config: {
    populationSize: number;
    generations: number;
    episodesPerIndividual: number;
  };
}
```

## Redis Keys

- `training:{id}` - Individual training data (JSON)
- `trainings:list` - List of all training IDs

## Configuration

Default Redis URL: `redis://localhost:6379`

To use a different Redis instance, modify `trainingStore.ts`:

```typescript
const store = new RedisTrainingStore('redis://your-redis-url:6379');
```

## Examples

See `examples/useTrainedParams.example.tsx` for:
- Using trained params in components
- Training selector dropdown
- Comparing multiple controllers
