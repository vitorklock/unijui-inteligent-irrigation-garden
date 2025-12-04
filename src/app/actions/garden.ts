"use server";

import chalk from "chalk";
import { GardenSimulation, GardenSimulationOptions } from "@/lib/garden/GardenSimulation";
import { Simulation } from "@/lib/garden/types";
import { ControllerKey, CONTROLLERS } from "@/lib/garden/controllers/map";

/**
 * Options for running parallel simulations
 */
export interface RunParallelSimulationsOptions extends Omit<GardenSimulationOptions, "seed"> {
  /** Number of simulations to run in parallel */
  count: number;
  /** Random seed for generating the random seeds for each simulation */
  baseSeed?: number;
  /** Optional controller key to use for all simulations (must be a key in `CONTROLLERS`) */
  controllerKey?: ControllerKey;
}

/**
 * Runs multiple garden simulations in parallel with different random seeds.
 * All simulations use the same configuration but different seeds for variety.
 * Results are logged with chalk and returned for frontend use.
 */
export async function runParallelGardenSimulations(
  options: RunParallelSimulationsOptions
): Promise<Simulation.Results[]> {
  const { count, baseSeed = Date.now(), ...sharedConfig } = options;
  const controllerKey = (options as RunParallelSimulationsOptions).controllerKey;
  const ControllerClass = controllerKey ? CONTROLLERS[controllerKey] : undefined;

  console.log(chalk.blue.bold(`\n🌱 Starting ${count} parallel garden simulations...`));

  // Create simulation promises with different seeds
  const simulationPromises = Array.from({ length: count }, (_, index) => {
    const seed = baseSeed + index;
    // If a controller class/key was provided, instantiate it and pass it to the simulation
    const controllerInstance = ControllerClass ? new ControllerClass() : undefined;
    return runSingleSimulation({ ...sharedConfig, seed, controller: controllerInstance }, index);
  });

  // Run all simulations in parallel
  const allResults = await Promise.all(simulationPromises);

  // Compute aggregate statistics
  const avgScore = allResults.reduce((sum, r) => sum + r.finalScore, 0) / allResults.length;
  const avgWaterUsed = allResults.reduce((sum, r) => sum + r.totalWaterUsed, 0) / allResults.length;
  const avgHealthyTicks = allResults.reduce((sum, r) => sum + r.healthyPlantTicks, 0) / allResults.length;

  const minScore = Math.min(...allResults.map((r) => r.finalScore));
  const maxScore = Math.max(...allResults.map((r) => r.finalScore));

  // Log summary
  console.log(chalk.green.bold("\n✅ All simulations completed!\n"));
  console.log(chalk.cyan("📊 Summary Statistics:"));
  console.log(chalk.cyan(`   Average Score:        ${chalk.yellow(avgScore.toFixed(2))}`));
  console.log(chalk.cyan(`   Score Range:          ${chalk.yellow(minScore.toFixed(2))} → ${chalk.yellow(maxScore.toFixed(2))}`));
  console.log(chalk.cyan(`   Average Water Used:   ${chalk.yellow(avgWaterUsed.toFixed(2))} units`));
  console.log(chalk.cyan(`   Average Healthy Ticks: ${chalk.yellow(avgHealthyTicks.toFixed(0))}`));
  console.log();

  return allResults;
}

/**
 * Runs a single simulation to completion and logs results
 */
async function runSingleSimulation(
  options: GardenSimulationOptions,
  simulationIndex: number
): Promise<Simulation.Results> {
  const simulation = new GardenSimulation(options);

  // Run simulation to completion
  while (simulation.state.tick < simulation.state.episodeLength) {
    simulation.step();
  }

  const results = simulation.compileResults();

  // Log individual simulation results with chalk
  const scoreColor = results.finalScore >= 70 ? chalk.green : results.finalScore >= 50 ? chalk.yellow : chalk.red;

  console.log(
    chalk.gray(`[Sim ${String(simulationIndex + 1).padStart(2, "0")}]`) +
    ` Score: ${scoreColor(String(results.finalScore).padStart(3, " "))}` +
    ` | Water: ${chalk.blue(results.totalWaterUsed.toFixed(2).padStart(7, " "))} units` +
    ` | Healthy: ${chalk.green(String(results.healthyPlantTicks).padStart(5, " "))} | ` +
    ` Dry: ${chalk.red(String(results.dryPlantTicks).padStart(5, " "))} | ` +
    ` Flooded: ${chalk.magenta(String(results.floodedPlantTicks).padStart(5, " "))}`
  );

  return results;
}
