/**
 * EXAMPLE: Using Trained Parameters in Simulations
 * 
 * This shows how to load trained parameters from Redis and use them
 * in GardenView and ParallelSimulationsPanel.
 */

import { useState } from 'react';
import { useTrainedParams } from '@/hooks/useTrainedParams';
import { SmartIrrigationController, FuzzyClimateEvaluator, HumidityPredictorNN, DEFAULT_HUMIDITY_PREDICTOR_CONFIG } from '@/lib/garden/controllers/SmartIrrigationController';
import { GardenSimulation } from '@/lib/garden/GardenSimulation';

// Example 1: Use in a component
export function ExampleWithTrainedParams() {
  const { best, trainings, loading } = useTrainedParams();

  if (loading) return <div>Loading trained params...</div>;
  if (!best) return <div>No trained params available</div>;

  // Create controller with best params
  const fuzzy = new FuzzyClimateEvaluator();
  const nn = new HumidityPredictorNN(DEFAULT_HUMIDITY_PREDICTOR_CONFIG);
  const controller = new SmartIrrigationController(fuzzy, nn, best.params);

  // Use in simulation
  const sim = new GardenSimulation({
    width: 20,
    height: 20,
    pillarDensity: 0.1,
    plantChanceNearPath: 0.6,
    seed: 12345,
    coverageRadius: 2,
    controller, // ← Use trained controller
  });

  return (
    <div>
      <h3>Using: {best.name}</h3>
      <p>Fitness: {best.fitness.toFixed(2)}</p>
      {/* Render your simulation UI */}
    </div>
  );
}

// Example 2: Selector to choose from multiple trainings
export function TrainingSelector() {
  const { trainings, loading } = useTrainedParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <div>Loading...</div>;

  const selected = trainings.find(t => t.id === selectedId);

  return (
    <div className="space-y-4">
      <select 
        value={selectedId || ''} 
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full p-2 border rounded"
      >
        <option value="">Default Controller</option>
        {trainings.map(t => (
          <option key={t.id} value={t.id}>
            {t.name} (Fitness: {t.fitness.toFixed(2)})
          </option>
        ))}
      </select>

      {selected && (
        <div className="text-sm text-gray-600">
          <div>Population: {selected.config.populationSize}</div>
          <div>Generations: {selected.config.generations}</div>
          <div>Trained: {new Date(selected.timestamp).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

// Example 3: Compare multiple trained controllers
export async function compareControllers() {
  const response = await fetch('/api/trainings');
  const { trainings } = await response.json();

  const results = [];

  for (const training of trainings) {
    const fuzzy = new FuzzyClimateEvaluator();
    const nn = new HumidityPredictorNN(DEFAULT_HUMIDITY_PREDICTOR_CONFIG);
    const controller = new SmartIrrigationController(fuzzy, nn, training.params);

    const sim = new GardenSimulation({
      width: 20,
      height: 20,
      pillarDensity: 0.1,
      plantChanceNearPath: 0.6,
      seed: 12345,
      coverageRadius: 2,
      controller,
    });

    // Run simulation
    while (sim.state.tick < sim.state.episodeLength) {
      sim.step();
    }

    results.push({
      name: training.name,
      trainedFitness: training.fitness,
      actualFitness: sim.compileResults().finalScore,
    });
  }

  console.table(results);
  return results;
}
