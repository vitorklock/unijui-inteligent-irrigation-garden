import { GardenSimulation, GardenSimulationOptions } from "../../GardenSimulation";
import { ControllerParams, DEFAULT_CONTROLLER_PARAMS } from "./types";
import { SmartIrrigationController } from "./SmartIrrigationController";
import { FuzzyClimateEvaluator } from "./FuzzyClimateEvaluator";
import { HumidityPredictorNN, HumidityPredictorConfig, DEFAULT_HUMIDITY_PREDICTOR_CONFIG } from "./HumidityPredictorNN";
import { Simulation } from "../../types";

/**
 * Chromosome represents a complete set of controller parameters.
 * In a GA, we mutate and crossover chromosomes to explore the parameter space.
 */
export interface Chromosome {
  params: ControllerParams;
  fitness: number;
}

/**
 * Configuration for the genetic algorithm trainer.
 */
export interface GATrainerConfig {
  /** Number of individuals in each generation */
  populationSize: number;
  /** Number of generations to evolve */
  generations: number;
  /** Fraction of population that survives to next generation (elitism) */
  elitismRate: number;
  /** Standard deviation for Gaussian mutation of parameters */
  mutationStdDev: number;
  /** Probability that a gene is mutated (0-1) */
  mutationRate: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Configuration for each episode run during fitness evaluation.
 */
export interface EvaluationConfig {
  /** Number of episodes to run per individual (evaluate robustness) */
  episodesPerIndividual: number;
  /** Options for garden generation; can be a factory or fixed */
  gardenOptions: GardenSimulationOptions | (() => GardenSimulationOptions);
  /** NN config (same for all individuals during training) */
  nnConfig: HumidityPredictorConfig;
}

/**
 * Results from a training run.
 */
export interface TrainingResults {
  /** Best chromosome found */
  bestChromosome: Chromosome;
  /** History of best fitness per generation */
  fitnessHistory: number[];
  /** All final population */
  finalPopulation: Chromosome[];
}

/**
 * Progress callback for async training.
 */
export interface TrainingProgress {
  /** Current generation (0-indexed) */
  generation: number;
  /** Total generations */
  totalGenerations: number;
  /** Best fitness so far */
  bestFitness: number;
  /** Average fitness of current population */
  avgFitness: number;
  /** Fitness history up to this point */
  fitnessHistory: number[];
}

/**
 * GeneticAlgorithmTrainer
 *
 * Evolves ControllerParams using a simple GA:
 * 1. Initialize population with random/default params
 * 2. Evaluate fitness: run episode(s) with each individual, compute score
 * 3. Select elite individuals to survive
 * 4. Create offspring via mutation and crossover
 * 5. Repeat until convergence or max generations reached
 *
 * The fitness function is the episode's finalScore from GardenSimulation.compileResults().
 * A higher score = healthier plants, lower water usage, fewer toggles.
 */
export class GeneticAlgorithmTrainer {
  private config: GATrainerConfig;
  private rng: () => number;
  private fuzzy: FuzzyClimateEvaluator;

  constructor(config: GATrainerConfig) {
    this.config = config;
    // Simple PRNG if seed provided, otherwise use Math.random
    this.rng = config.seed !== undefined 
      ? this.createSeededRNG(config.seed)
      : () => Math.random();
    this.fuzzy = new FuzzyClimateEvaluator();
  }

  /**
   * Create a seeded PRNG (Mulberry32-like).
   */
  private createSeededRNG(seed: number): () => number {
    let m_w = seed;
    let m_z = 987654321;
    const mask = 0xffffffff;

    return () => {
      m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
      m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
      let result = ((m_z << 16) + (m_w & 65535)) >>> 0;
      result /= 4294967296;
      return result;
    };
  }

  /**
   * Generate a random ControllerParams by sampling from reasonable ranges.
   */
  private randomParams(): ControllerParams {
    return {
      drynessWeight: this.rng() * 3,        // 0 - 3
      floodWeight: this.rng() * 2,          // 0 - 2
      waterWeight: this.rng() * 1,          // 0 - 1
      predictionHorizonTicks: Math.floor(this.rng() * 30 + 5), // 5 - 35 ticks
      fuzzyDrynessScale: this.rng(),        // 0 - 1
      fuzzyFloodScale: this.rng(),          // 0 - 1
      minTicksBetweenToggles: Math.floor(this.rng() * 10 + 1), // 1 - 11 ticks
      maxDutyCycle: this.rng() * 0.4 + 0.3, // 0.3 - 0.7
    };
  }

  /**
   * Clamp a parameter to its valid range.
   */
  private clampParams(params: Partial<ControllerParams>): ControllerParams {
    return {
      drynessWeight: Math.max(0, params.drynessWeight ?? 1),
      floodWeight: Math.max(0, params.floodWeight ?? 1),
      waterWeight: Math.max(0, params.waterWeight ?? 0.3),
      predictionHorizonTicks: Math.max(1, Math.min(100, Math.round(params.predictionHorizonTicks ?? 10))),
      fuzzyDrynessScale: Math.max(0, Math.min(1, params.fuzzyDrynessScale ?? 0.5)),
      fuzzyFloodScale: Math.max(0, Math.min(1, params.fuzzyFloodScale ?? 0.4)),
      minTicksBetweenToggles: Math.max(0, Math.round(params.minTicksBetweenToggles ?? 3)),
      maxDutyCycle: Math.max(0.1, Math.min(1, params.maxDutyCycle ?? 0.6)),
    };
  }

  /**
   * Evaluate fitness: run episode(s) and return average final score.
   */
  private evaluateFitness(
    params: ControllerParams,
    evalConfig: EvaluationConfig
  ): number {
    const nn = new HumidityPredictorNN(evalConfig.nnConfig);
    const controller = new SmartIrrigationController(this.fuzzy, nn, params);

    const scores: number[] = [];

    for (let i = 0; i < evalConfig.episodesPerIndividual; i++) {
      const gardenOpts = typeof evalConfig.gardenOptions === "function"
        ? evalConfig.gardenOptions()
        : evalConfig.gardenOptions;

      const sim = new GardenSimulation({
        ...gardenOpts,
        controller,
      });

      // Run full episode
      while (sim.state.tick < sim.state.episodeLength) {
        sim.step();
      }

      const results = sim.compileResults();
      scores.push(results.finalScore);
    }

    // Average fitness across episodes
    const avgFitness = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avgFitness;
  }

  /**
   * Mutate a chromosome: add Gaussian noise to each gene.
   */
  private mutate(params: ControllerParams): ControllerParams {
    const mutated = { ...params };

    // For each parameter, with probability mutationRate, add Gaussian noise
    if (this.rng() < this.config.mutationRate) {
      mutated.drynessWeight += this.gaussianRandom() * this.config.mutationStdDev;
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.floodWeight += this.gaussianRandom() * this.config.mutationStdDev;
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.waterWeight += this.gaussianRandom() * this.config.mutationStdDev;
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.predictionHorizonTicks += Math.round(this.gaussianRandom() * 2);
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.fuzzyDrynessScale += this.gaussianRandom() * this.config.mutationStdDev * 0.5;
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.fuzzyFloodScale += this.gaussianRandom() * this.config.mutationStdDev * 0.5;
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.minTicksBetweenToggles += Math.round(this.gaussianRandom() * 1);
    }
    if (this.rng() < this.config.mutationRate) {
      mutated.maxDutyCycle += this.gaussianRandom() * this.config.mutationStdDev * 0.3;
    }

    return this.clampParams(mutated);
  }

  /**
   * Box-Muller Gaussian random number.
   */
  private gaussianRandom(): number {
    let u1 = this.rng();
    let u2 = this.rng();
    // Avoid log(0)
    u1 = Math.max(1e-6, u1);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Crossover: blend parameters from two parents.
   */
  private crossover(parent1: ControllerParams, parent2: ControllerParams): ControllerParams {
    const alpha = this.rng(); // interpolation weight

    return {
      drynessWeight: parent1.drynessWeight * alpha + parent2.drynessWeight * (1 - alpha),
      floodWeight: parent1.floodWeight * alpha + parent2.floodWeight * (1 - alpha),
      waterWeight: parent1.waterWeight * alpha + parent2.waterWeight * (1 - alpha),
      predictionHorizonTicks: Math.round(
        parent1.predictionHorizonTicks * alpha + parent2.predictionHorizonTicks * (1 - alpha)
      ),
      fuzzyDrynessScale: parent1.fuzzyDrynessScale * alpha + parent2.fuzzyDrynessScale * (1 - alpha),
      fuzzyFloodScale: parent1.fuzzyFloodScale * alpha + parent2.fuzzyFloodScale * (1 - alpha),
      minTicksBetweenToggles: Math.round(
        parent1.minTicksBetweenToggles * alpha + parent2.minTicksBetweenToggles * (1 - alpha)
      ),
      maxDutyCycle: parent1.maxDutyCycle * alpha + parent2.maxDutyCycle * (1 - alpha),
    };
  }

  /**
   * Run the genetic algorithm: evolve the population for N generations.
   *
   * @param evalConfig - Configuration for episode runs
   * @param onProgress - Optional callback for progress updates (async-friendly)
   * @returns TrainingResults with best chromosome and history
   */
  public async trainAsync(
    evalConfig: EvaluationConfig,
    onProgress?: (progress: TrainingProgress) => void | Promise<void>
  ): Promise<TrainingResults> {
    const populationSize = this.config.populationSize;
    const generations = this.config.generations;
    const elitismRate = this.config.elitismRate;

    // Initialize population
    let population: Chromosome[] = Array.from({ length: populationSize }, () => ({
      params: this.randomParams(),
      fitness: -Infinity,
    }));

    const fitnessHistory: number[] = [];
    let bestChromosome = population[0];

    console.log("🧬 Starting Genetic Algorithm training...");
    console.log(`   Population: ${populationSize} | Generations: ${generations}`);
    console.log(`   Mutation rate: ${this.config.mutationRate} | Elitism: ${(elitismRate * 100).toFixed(0)}%`);

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness for all individuals
      console.log(`\n📊 Generation ${gen + 1}/${generations}`);
      for (let i = 0; i < population.length; i++) {
        if (population[i].fitness === -Infinity) {
          population[i].fitness = this.evaluateFitness(population[i].params, evalConfig);
        }
      }

      // Sort by fitness (descending)
      population.sort((a, b) => b.fitness - a.fitness);

      // Track best
      if (population[0].fitness > bestChromosome.fitness) {
        bestChromosome = population[0];
      }

      fitnessHistory.push(bestChromosome.fitness);
      console.log(`   Best fitness: ${bestChromosome.fitness.toFixed(2)}`);
      console.log(`   Avg fitness:  ${(population.reduce((s, c) => s + c.fitness, 0) / populationSize).toFixed(2)}`);

      // Progress callback
      if (onProgress) {
        const avgFitness = population.reduce((s, c) => s + c.fitness, 0) / populationSize;
        await onProgress({
          generation: gen,
          totalGenerations: generations,
          bestFitness: bestChromosome.fitness,
          avgFitness,
          fitnessHistory: [...fitnessHistory],
        });
      }

      // Yield to event loop to prevent UI freeze
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Elitism: keep top individuals
      const numElite = Math.ceil(populationSize * elitismRate);
      const elite = population.slice(0, numElite);

      // Create offspring to fill rest of population
      const offspring: Chromosome[] = [];
      while (offspring.length < populationSize - numElite) {
        // Select two parents from elite (randomly)
        const parent1 = elite[Math.floor(this.rng() * elite.length)];
        const parent2 = elite[Math.floor(this.rng() * elite.length)];

        // Crossover and mutate
        let child = this.crossover(parent1.params, parent2.params);
        child = this.mutate(child);

        offspring.push({ params: child, fitness: -Infinity });
      }

      // New population = elite + offspring
      population = [...elite, ...offspring.slice(0, populationSize - numElite)];
    }

    console.log("\n✅ Training complete!");
    console.log(`Best fitness: ${bestChromosome.fitness.toFixed(2)}`);

    return {
      bestChromosome,
      fitnessHistory,
      finalPopulation: population,
    };
  }

  /**
   * Run the genetic algorithm synchronously (may freeze UI in browser).
   *
   * @param evalConfig - Configuration for episode runs
   * @returns TrainingResults with best chromosome and history
   */
  public train(evalConfig: EvaluationConfig): TrainingResults {
    const populationSize = this.config.populationSize;
    const generations = this.config.generations;
    const elitismRate = this.config.elitismRate;

    // Initialize population
    let population: Chromosome[] = Array.from({ length: populationSize }, () => ({
      params: this.randomParams(),
      fitness: -Infinity,
    }));

    const fitnessHistory: number[] = [];
    let bestChromosome = population[0];

    console.log("🧬 Starting Genetic Algorithm training...");
    console.log(`   Population: ${populationSize} | Generations: ${generations}`);
    console.log(`   Mutation rate: ${this.config.mutationRate} | Elitism: ${(elitismRate * 100).toFixed(0)}%`);

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness for all individuals
      console.log(`\n📊 Generation ${gen + 1}/${generations}`);
      for (let i = 0; i < population.length; i++) {
        if (population[i].fitness === -Infinity) {
          population[i].fitness = this.evaluateFitness(population[i].params, evalConfig);
        }
      }

      // Sort by fitness (descending)
      population.sort((a, b) => b.fitness - a.fitness);

      // Track best
      if (population[0].fitness > bestChromosome.fitness) {
        bestChromosome = population[0];
      }

      fitnessHistory.push(bestChromosome.fitness);
      console.log(`   Best fitness: ${bestChromosome.fitness.toFixed(2)}`);
      console.log(`   Avg fitness:  ${(population.reduce((s, c) => s + c.fitness, 0) / populationSize).toFixed(2)}`);

      // Elitism: keep top individuals
      const numElite = Math.ceil(populationSize * elitismRate);
      const elite = population.slice(0, numElite);

      // Create offspring to fill rest of population
      const offspring: Chromosome[] = [];
      while (offspring.length < populationSize - numElite) {
        // Select two parents from elite (randomly)
        const parent1 = elite[Math.floor(this.rng() * elite.length)];
        const parent2 = elite[Math.floor(this.rng() * elite.length)];

        // Crossover and mutate
        let child = this.crossover(parent1.params, parent2.params);
        child = this.mutate(child);

        offspring.push({ params: child, fitness: -Infinity });
      }

      // New population = elite + offspring
      population = [...elite, ...offspring.slice(0, populationSize - numElite)];
    }

    console.log("\n✅ Training complete!");
    console.log(`Best fitness: ${bestChromosome.fitness.toFixed(2)}`);

    return {
      bestChromosome,
      fitnessHistory,
      finalPopulation: population,
    };
  }
}

/**
 * Convenience function to run a full training with sensible defaults.
 *
 * @param gardenOptions - Fixed garden options or factory function
 * @param customConfig - Optional overrides for GA config
 * @returns TrainingResults
 */
export async function trainSmartController(
  gardenOptions: GardenSimulationOptions | (() => GardenSimulationOptions),
  customConfig?: Partial<GATrainerConfig>
): Promise<Chromosome> {
  const gaConfig: GATrainerConfig = {
    populationSize: 20,
    generations: 15,
    elitismRate: 0.3,
    mutationStdDev: 0.2,
    mutationRate: 0.6,
    ...customConfig,
  };

  const trainer = new GeneticAlgorithmTrainer(gaConfig);

  const results = trainer.train({
    episodesPerIndividual: 2,
    gardenOptions,
    nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
  });

  return results.bestChromosome;
}
