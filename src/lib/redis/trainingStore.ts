import Redis from 'ioredis';
import { ControllerParams } from '@/lib/garden/controllers/SmartIrrigationController';
import { Chromosome } from '@/lib/garden/controllers/SmartIrrigationController';

/**
 * Saved training result with metadata
 */
export interface SavedTraining {
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

/**
 * RedisTrainingStore
 * 
 * Manages saving and loading trained controller parameters to/from Redis.
 * Uses Redis for:
 * - Persistent storage of trained params
 * - Quick lookup by ID
 * - List of all saved trainings
 */
export class RedisTrainingStore {
  private redis: Redis;
  private readonly KEY_PREFIX = 'training:';
  private readonly LIST_KEY = 'trainings:list';

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      },
    });

    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }

  /**
   * Connect to Redis (must be called before use)
   */
  async connect(): Promise<boolean> {
    try {
      // Check if already connected
      if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
        return true;
      }
      await this.redis.connect();
      return true;
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  /**
   * Save a training result
   */
  async save(
    chromosome: Chromosome,
    name: string,
    config: { populationSize: number; generations: number; episodesPerIndividual: number }
  ): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const training: SavedTraining = {
      id,
      name,
      params: chromosome.params,
      fitness: chromosome.fitness,
      timestamp: new Date().toISOString(),
      config,
    };

    // Save to hash
    await this.redis.set(
      `${this.KEY_PREFIX}${id}`,
      JSON.stringify(training)
    );

    // Add to list (for quick retrieval of all trainings)
    await this.redis.lpush(this.LIST_KEY, id);

    console.log(`💾 Saved training: ${name} (${id})`);
    return id;
  }

  /**
   * Load a training by ID
   */
  async load(id: string): Promise<SavedTraining | null> {
    const data = await this.redis.get(`${this.KEY_PREFIX}${id}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * Get all saved trainings (sorted by most recent first)
   */
  async listAll(): Promise<SavedTraining[]> {
    const ids = await this.redis.lrange(this.LIST_KEY, 0, -1);
    const trainings: SavedTraining[] = [];

    for (const id of ids) {
      const training = await this.load(id);
      if (training) {
        trainings.push(training);
      }
    }

    return trainings;
  }

  /**
   * Delete a training
   */
  async delete(id: string): Promise<boolean> {
    const deleted = await this.redis.del(`${this.KEY_PREFIX}${id}`);
    await this.redis.lrem(this.LIST_KEY, 1, id);
    return deleted > 0;
  }

  /**
   * Get the best training (highest fitness)
   */
  async getBest(): Promise<SavedTraining | null> {
    const all = await this.listAll();
    if (all.length === 0) return null;
    
    return all.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );
  }

  /**
   * Clear all trainings (use with caution!)
   */
  async clear(): Promise<void> {
    const ids = await this.redis.lrange(this.LIST_KEY, 0, -1);
    
    for (const id of ids) {
      await this.redis.del(`${this.KEY_PREFIX}${id}`);
    }
    
    await this.redis.del(this.LIST_KEY);
    console.log('🗑️ Cleared all trainings');
  }
}

/**
 * Singleton instance for use across the app
 */
let storeInstance: RedisTrainingStore | null = null;

export function getTrainingStore(): RedisTrainingStore {
  if (!storeInstance) {
    storeInstance = new RedisTrainingStore();
  }
  return storeInstance;
}
