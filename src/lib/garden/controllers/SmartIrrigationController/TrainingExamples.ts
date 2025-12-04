/**
 * EXAMPLE: How to Train the SmartIrrigationController
 *
 * This file demonstrates how to use the GeneticAlgorithmTrainer to evolve
 * optimal ControllerParams for your specific garden setup.
 *
 * There are two approaches:
 * 1. **Server-side training** (Node.js): Full control, reproducible, can run long trainings
 * 2. **Client-side training** (browser): Integrated into UI, real-time feedback
 */

import {
  GeneticAlgorithmTrainer,
  GATrainerConfig,
  EvaluationConfig,
  trainSmartController,
} from "./GeneticAlgorithmTrainer";
import { ControllerParams, DEFAULT_CONTROLLER_PARAMS } from "./types";
import { DEFAULT_HUMIDITY_PREDICTOR_CONFIG } from "./HumidityPredictorNN";
import { GardenSimulationOptions } from "../../GardenSimulation";

// ============================================================================
// EXAMPLE 1: Basic training with one garden configuration
// ============================================================================

export async function example1_basicTraining() {
  console.log("🌱 Example 1: Basic Training");

  // Define the garden setup you want to train on
  const gardenConfig: GardenSimulationOptions = {
    width: 20,
    height: 20,
    pillarDensity: 0.1,
    plantChanceNearPath: 0.6,
    seed: 12345,
    coverageRadius: 2,
  };

  // Use the convenience function with default GA settings
  const bestChromosome = await trainSmartController(gardenConfig);

  console.log("✅ Training complete!");
  console.log("Best parameters found:");
  console.log(JSON.stringify(bestChromosome.params, null, 2));
  console.log(`Fitness: ${bestChromosome.fitness.toFixed(2)}`);

  // You can now export these params to use in your simulation:
  // const controller = new SmartIrrigationController(fuzzy, nn, bestChromosome.params);

  return bestChromosome.params;
}

// ============================================================================
// EXAMPLE 2: Fine-grained control with custom GA config
// ============================================================================

export async function example2_customGAConfig() {
  console.log("🔧 Example 2: Custom GA Configuration");

  const gardenConfig: GardenSimulationOptions = {
    width: 15,
    height: 15,
    pillarDensity: 0.12,
    plantChanceNearPath: 0.5,
    seed: 54321,
    coverageRadius: 2,
  };

  // Customize the GA parameters
  const gaConfig: GATrainerConfig = {
    populationSize: 30,        // More individuals = more thorough search, slower
    generations: 20,           // More generations = longer evolution, better params
    elitismRate: 0.2,          // Keep top 20% of population
    mutationStdDev: 0.15,      // Smaller mutations = finer tuning, larger = broader search
    mutationRate: 0.7,         // Probability each gene mutates
    seed: 99999,               // For reproducibility
  };

  const bestChromosome = await trainSmartController(gardenConfig, gaConfig);

  console.log("✅ Training complete!");
  console.log("Best parameters found:");
  console.log(JSON.stringify(bestChromosome.params, null, 2));
  console.log(`Fitness: ${bestChromosome.fitness.toFixed(2)}`);

  return bestChromosome.params;
}

// ============================================================================
// EXAMPLE 3: Multi-scenario training (train on different garden configs)
// ============================================================================

export async function example3_multiScenarioTraining() {
  console.log("🏗️ Example 3: Multi-Scenario Training");

  // Create a factory function that generates different gardens
  let scenarioCounter = 0;
  const gardenFactory = (): GardenSimulationOptions => {
    scenarioCounter++;
    const configs = [
      { width: 15, height: 15, pillarDensity: 0.1, seed: 1001 },
      { width: 20, height: 20, pillarDensity: 0.12, seed: 1002 },
      { width: 25, height: 25, pillarDensity: 0.08, seed: 1003 },
    ];
    const config = configs[scenarioCounter % configs.length];
    return {
      ...config,
      plantChanceNearPath: 0.55,
      coverageRadius: 2,
    } as GardenSimulationOptions;
  };

  const trainer = new GeneticAlgorithmTrainer({
    populationSize: 25,
    generations: 15,
    elitismRate: 0.3,
    mutationStdDev: 0.2,
    mutationRate: 0.6,
  });

  // Train on multiple diverse scenarios
  const results = trainer.train({
    episodesPerIndividual: 3,  // Run 3 episodes per config per individual
    gardenOptions: gardenFactory,
    nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
  });

  console.log("✅ Multi-scenario training complete!");
  console.log("Best chromosome (evolved on diverse gardens):");
  console.log(JSON.stringify(results.bestChromosome.params, null, 2));
  console.log(`Fitness: ${results.bestChromosome.fitness.toFixed(2)}`);

  // Print fitness progression
  console.log("\nFitness over generations:");
  results.fitnessHistory.forEach((f, gen) => {
    console.log(`  Gen ${gen + 1}: ${f.toFixed(2)}`);
  });

  return results.bestChromosome.params;
}

// ============================================================================
// EXAMPLE 4: Direct trainer instantiation (advanced use)
// ============================================================================

export async function example4_advancedDirectUsage() {
  console.log("🎯 Example 4: Advanced Direct Usage");

  const trainer = new GeneticAlgorithmTrainer({
    populationSize: 20,
    generations: 12,
    elitismRate: 0.25,
    mutationStdDev: 0.25,
    mutationRate: 0.65,
    seed: 7777,
  });

  // Custom evaluation config
  const evalConfig: EvaluationConfig = {
    episodesPerIndividual: 2,
    gardenOptions: {
      width: 18,
      height: 18,
      pillarDensity: 0.11,
      plantChanceNearPath: 0.58,
      seed: 8888,
      coverageRadius: 2,
    },
    nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
  };

  const results = trainer.train(evalConfig);

  console.log("✅ Training complete!");
  console.log("Best parameters:");
  console.log(JSON.stringify(results.bestChromosome.params, null, 2));
  console.log(`Best fitness: ${results.bestChromosome.fitness.toFixed(2)}`);

  // Print top 5 final individuals
  console.log("\nTop 5 final individuals:");
  results.finalPopulation.slice(0, 5).forEach((chrom, i) => {
    console.log(`  ${i + 1}. Fitness: ${chrom.fitness.toFixed(2)}`);
  });

  return results.bestChromosome.params;
}

// ============================================================================
// UTILITY: Export trained params to JSON
// ============================================================================

export function exportParamsToJSON(params: ControllerParams): string {
  return JSON.stringify(params, null, 2);
}

export function exportParamsToTypeScriptLiteral(params: ControllerParams): string {
  return `
export const OPTIMIZED_CONTROLLER_PARAMS: ControllerParams = ${JSON.stringify(params, null, 2)};
`;
}

// ============================================================================
// UTILITY: Compare two parameter sets
// ============================================================================

export function compareParams(params1: ControllerParams, params2: ControllerParams) {
  console.log("Comparison between two parameter sets:");
  console.log("");
  console.log(
    `Parameter`.padEnd(30) + `Config 1`.padEnd(15) + `Config 2`.padEnd(15) + `Δ`
  );
  console.log("-".repeat(70));

  const keys = Object.keys(params1) as (keyof ControllerParams)[];
  for (const key of keys) {
    const v1 = params1[key];
    const v2 = params2[key];
    const delta =
      typeof v1 === "number" && typeof v2 === "number"
        ? (v2 - v1).toFixed(3)
        : "N/A";

    console.log(
      `${String(key).padEnd(30)}${String(v1).padEnd(15)}${String(v2).padEnd(15)}${delta}`
    );
  }
}

// ============================================================================
// Quick Start: Run a simple training in Node.js
// ============================================================================

if (require.main === module) {
  // This runs if this file is executed directly in Node.js
  example1_basicTraining().then((params) => {
    console.log("\n💾 Saving results...");
    console.log(exportParamsToTypeScriptLiteral(params));
  });
}
