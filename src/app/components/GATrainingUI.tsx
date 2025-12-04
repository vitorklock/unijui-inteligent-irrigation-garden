/**
 * BROWSER EXAMPLE: Interactive GA Training UI
 *
 * This React component demonstrates how to run GA training in the browser
 * with real-time feedback and progress visualization.
 */

'use client';

import React, { useState } from 'react';
import {
  GeneticAlgorithmTrainer,
  GATrainerConfig,
  Chromosome,
} from '@/lib/garden/controllers/SmartIrrigationController';
import { DEFAULT_HUMIDITY_PREDICTOR_CONFIG } from '@/lib/garden/controllers/SmartIrrigationController';
import { ControllerParams } from '@/lib/garden/controllers/SmartIrrigationController';

export function GATrainingUI() {
  const [training, setTraining] = useState(false);
  const [currentGen, setCurrentGen] = useState(0);
  const [totalGens, setTotalGens] = useState(0);
  const [bestFitness, setBestFitness] = useState<number | null>(null);
  const [avgFitness, setAvgFitness] = useState<number | null>(null);
  const [fitnessHistory, setFitnessHistory] = useState<number[]>([]);
  const [result, setResult] = useState<Chromosome | null>(null);

  // Training configuration
  const [config, setConfig] = useState<GATrainerConfig>({
    populationSize: 20,
    generations: 15,
    elitismRate: 0.3,
    mutationStdDev: 0.2,
    mutationRate: 0.6,
  });

  const handleStart = async () => {
    setTraining(true);
    setBestFitness(null);
    setAvgFitness(null);
    setFitnessHistory([]);
    setResult(null);
    setCurrentGen(0);
    setTotalGens(config.generations);

    try {
      const trainer = new GeneticAlgorithmTrainer(config);

      // Use async trainer with progress callback
      const allResults = await trainer.trainAsync(
        {
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
        },
        (progress) => {
          // Update UI with progress
          setCurrentGen(progress.generation + 1);
          setBestFitness(progress.bestFitness);
          setAvgFitness(progress.avgFitness);
          setFitnessHistory(progress.fitnessHistory);
        }
      );

      setResult(allResults.bestChromosome);
      setFitnessHistory(allResults.fitnessHistory);
      setBestFitness(allResults.bestChromosome.fitness);
    } catch (err) {
      console.error('Training error:', err);
      alert(`Training failed: ${err}`);
    } finally {
      setTraining(false);
    }
  };

  const exportJSON = () => {
    if (!result) return;
    const json = JSON.stringify(result.params, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trained-params-${Date.now()}.json`;
    a.click();
  };

  const exportTypeScript = () => {
    if (!result) return;
    const ts = `export const TRAINED_CONTROLLER_PARAMS: ControllerParams = ${JSON.stringify(
      result.params,
      null,
      2
    )};`;
    const blob = new Blob([ts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trained-params-${Date.now()}.ts`;
    a.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">🧬 GA Parameter Training</h1>
        <p className="text-gray-600">
          Train optimal SmartIrrigationController parameters using a genetic algorithm
        </p>
      </div>

      {/* Configuration Section */}
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="text-xl font-semibold">Configuration</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Population Size: {config.populationSize}
            </label>
            <input
              type="range"
              min="10"
              max="50"
              value={config.populationSize}
              onChange={(e) =>
                setConfig({ ...config, populationSize: parseInt(e.target.value) })
              }
              disabled={training}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Generations: {config.generations}
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={config.generations}
              onChange={(e) =>
                setConfig({ ...config, generations: parseInt(e.target.value) })
              }
              disabled={training}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Elitism Rate: {(config.elitismRate * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="0.5"
              step="0.05"
              value={config.elitismRate}
              onChange={(e) =>
                setConfig({ ...config, elitismRate: parseFloat(e.target.value) })
              }
              disabled={training}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Mutation Rate: {(config.mutationRate * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="0.9"
              step="0.05"
              value={config.mutationRate}
              onChange={(e) =>
                setConfig({ ...config, mutationRate: parseFloat(e.target.value) })
              }
              disabled={training}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Training Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleStart}
          disabled={training}
          className={`flex-1 py-2 px-4 rounded font-semibold text-white transition-colors ${training
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {training ? 'Training...' : 'Start Training'}
        </button>
        {result && (
          <button
            onClick={() => {
              setTraining(false);
              setResult(null);
              setBestFitness(null);
              setAvgFitness(null);
              setFitnessHistory([]);
              setCurrentGen(0);
              setTotalGens(0);
            }}
            className="py-2 px-4 rounded font-semibold bg-gray-400 text-white hover:bg-gray-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Progress */}
      {training && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              Generation {currentGen} of {totalGens}
              {avgFitness !== null && ` • Avg: ${avgFitness.toFixed(2)}`}
            </span>
            <span>{totalGens > 0 ? Math.round((currentGen / totalGens) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalGens > 0 ? (currentGen / totalGens) * 100 : 0}%` }}
            />
          </div>
          {bestFitness !== null && (
            <div className="text-sm text-center text-gray-600">
              Best fitness: <span className="font-semibold">{bestFitness.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Fitness Graph */}
      {fitnessHistory.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">📈 Fitness Progression</h3>
          <div className="h-40 flex items-end gap-1">
            {fitnessHistory.map((fitness, gen) => {
              const maxFitness = Math.max(...fitnessHistory);
              const height = (fitness / maxFitness) * 100;
              return (
                <div
                  key={gen}
                  className="flex-1 bg-blue-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                  style={{ height: `${height}%` }}
                  title={`Gen ${gen + 1}: ${fitness.toFixed(2)}`}
                />
              );
            })}
          </div>
          <div className="text-center text-sm text-gray-600 mt-2">
            Generations: {fitnessHistory.length} | Best: {bestFitness?.toFixed(2)}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-green-900 mb-2">✅ Training Complete!</h3>
            <p className="text-sm text-green-800">
              Best fitness: <span className="font-bold">{result.fitness.toFixed(2)}</span>
            </p>
          </div>

          {/* Parameters */}
          <div className="bg-white rounded p-3 max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="space-y-2">
                {Object.entries(result.params).map(([key, value]) => (
                  <tr key={key} className="border-b">
                    <td className="font-mono text-gray-600">{key}</td>
                    <td className="text-right font-semibold">
                      {typeof value === 'number' ? value.toFixed(3) : value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <button
              onClick={exportJSON}
              className="flex-1 py-2 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-semibold"
            >
              📥 Export JSON
            </button>
            <button
              onClick={exportTypeScript}
              className="flex-1 py-2 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-semibold"
            >
              📄 Export TypeScript
            </button>
          </div>

          {/* Usage */}
          <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
            <pre>{`const controller = new SmartIrrigationController(
  fuzzy,
  nn,
  ${JSON.stringify(result.params, null, 2).split('\n').join('\n  ')}
);`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
