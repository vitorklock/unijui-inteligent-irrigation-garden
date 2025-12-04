/**
 * train.ts
 *
 * Example Node.js training script to run offline.
 * Can be executed with: `npx ts-node train.ts`
 *
 * This trains a SmartIrrigationController and exports the best params
 * to a JSON file for use in production.
 */

import { GeneticAlgorithmTrainer, GATrainerConfig, EvaluationConfig } from "@/lib/garden/controllers/SmartIrrigationController";
import { DEFAULT_HUMIDITY_PREDICTOR_CONFIG } from "@/lib/garden/controllers/SmartIrrigationController";
import * as fs from "fs";

/**
 * Main training function
 */
async function main() {
  console.log("🌱 SmartIrrigationController Training");
  console.log("=====================================\n");

  // Configure the GA
  const gaConfig: GATrainerConfig = {
    populationSize: 25,
    generations: 20,
    elitismRate: 0.3,
    mutationStdDev: 0.2,
    mutationRate: 0.65,
    seed: Math.floor(Date.now() / 1000), // Timestamp seed for uniqueness
  };

  // Configure evaluation
  const evalConfig: EvaluationConfig = {
    episodesPerIndividual: 2,
    gardenOptions: {
      width: 20,
      height: 20,
      pillarDensity: 0.1,
      plantChanceNearPath: 0.6,
      seed: 12345,
      coverageRadius: 2,
    },
    nnConfig: DEFAULT_HUMIDITY_PREDICTOR_CONFIG,
  };

  console.log("📋 Configuration:");
  console.log(`   Population: ${gaConfig.populationSize}`);
  console.log(`   Generations: ${gaConfig.generations}`);
  console.log(`   Episodes per individual: ${evalConfig.episodesPerIndividual}`);
  console.log(
    `   Garden size: ${(evalConfig.gardenOptions as any).width}x${(evalConfig.gardenOptions as any).height}`
  );
  console.log(`   Random seed: ${gaConfig.seed}`);
  console.log();

  // Run training
  const trainer = new GeneticAlgorithmTrainer(gaConfig);
  const startTime = Date.now();

  console.log("🚀 Starting training...\n");
  const results = trainer.train(evalConfig);

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Training complete in ${elapsedSeconds.toFixed(1)}s\n`);

  // Print results
  console.log("📊 Results:");
  console.log(`   Best fitness: ${results.bestChromosome.fitness.toFixed(2)}`);
  console.log(`   Best parameters:`);
  console.log(JSON.stringify(results.bestChromosome.params, null, 4));

  console.log("\n📈 Fitness progression:");
  results.fitnessHistory.forEach((f, gen) => {
    const bar = "█".repeat(Math.round(f / 2));
    console.log(`   Gen ${String(gen + 1).padEnd(2)}: ${bar} ${f.toFixed(2)}`);
  });

  // Save to file
  const outputPath = "./trained-params.json";
  const output = {
    timestamp: new Date().toISOString(),
    config: gaConfig,
    evalConfig: {
      episodesPerIndividual: evalConfig.episodesPerIndividual,
      gardenOptions: evalConfig.gardenOptions,
    },
    results: {
      bestFitness: results.bestChromosome.fitness,
      bestParams: results.bestChromosome.params,
      elapsedSeconds,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);

  // Also save as TypeScript constant
  const tsPath = "./trained-params.ts";
  const tsContent = `/**
 * AUTO-GENERATED: Do not edit by hand
 * Generated: ${new Date().toISOString()}
 */

import { ControllerParams } from "@/lib/garden/controllers/SmartIrrigationController";

export const TRAINED_CONTROLLER_PARAMS: ControllerParams = ${JSON.stringify(
    results.bestChromosome.params,
    null,
    2
  )};

export const TRAINING_METADATA = {
  timestamp: "${new Date().toISOString()}",
  generations: ${gaConfig.generations},
  populationSize: ${gaConfig.populationSize},
  bestFitness: ${results.bestChromosome.fitness},
  elapsedSeconds: ${elapsedSeconds},
};
`;

  fs.writeFileSync(tsPath, tsContent);
  console.log(`📝 TypeScript export saved to ${tsPath}`);

  console.log("\n✨ Done!");
  console.log(
    "\nNext steps:"
  );
  console.log("  1. Review the results in trained-params.json");
  console.log("  2. Copy TRAINED_CONTROLLER_PARAMS to your codebase");
  console.log("  3. Use it: new SmartIrrigationController(fuzzy, nn, TRAINED_CONTROLLER_PARAMS)");
}

// Run
main().catch((err) => {
  console.error("❌ Training failed:", err);
  process.exit(1);
});
