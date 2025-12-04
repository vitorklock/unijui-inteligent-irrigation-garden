"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { runParallelGardenSimulations } from "@/app/actions/garden";
import type { Simulation } from "@/lib/garden/types";
import { CONTROLLERS, ControllerKey } from "@/lib/garden/controllers/map";
import { ControllerSelector } from "@/lib/garden/components/ControllerSelector";

interface ParallelSimulationConfig {
  width: number;
  height: number;
  pillarDensity: number;
  plantChanceNearPath: number;
  coverageRadius: number;
  simulationCount: number;
  baseSeed: number;
  controllerKey: ControllerKey;
}

export const ParallelSimulationsPanel: React.FC = () => {
  const [config, setConfig] = useState<ParallelSimulationConfig>({
    width: 30,
    height: 20,
    pillarDensity: 0.04,
    plantChanceNearPath: 0.25,
    coverageRadius: 1,
    simulationCount: 5,
    baseSeed: 42,
    controllerKey: Object.keys(CONTROLLERS)[0] as keyof typeof CONTROLLERS,
  });

  const [results, setResults] = useState<Simulation.Results[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);

  const handleRunSimulations = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const simulationResults = await runParallelGardenSimulations({
        width: config.width,
        height: config.height,
        pillarDensity: config.pillarDensity,
        plantChanceNearPath: config.plantChanceNearPath,
        coverageRadius: config.coverageRadius,
        count: config.simulationCount,
        baseSeed: config.baseSeed,
        controllerKey: config.controllerKey,
        trainingId: config.controllerKey === 'smart' ? selectedTrainingId : undefined,
      });

      setResults(simulationResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Simulation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (key: keyof ParallelSimulationConfig, value: string | number) => {
    setConfig((prev) => ({
      ...prev,
      // controllerKey should be set as a string directly; simulationCount as int; other numeric fields parsed as float
      [key]: typeof value === "string"
        ? key === "simulationCount"
          ? parseInt(value, 10)
          : key === "controllerKey"
            ? (value as any)
            : parseFloat(value)
        : value,
    }));
  };

  const avgScore = results ? (results.reduce((sum, r) => sum + r.finalScore, 0) / results.length).toFixed(2) : "—";
  const minScore = results ? Math.min(...results.map((r) => r.finalScore)) : "—";
  const maxScore = results ? Math.max(...results.map((r) => r.finalScore)) : "—";
  const totalWaterUsed = results ? results.reduce((sum, r) => sum + r.totalWaterUsed, 0).toFixed(2) : "—";
  const avgToggleCount = results ? (results.reduce((sum, r) => sum + r.irrigationToggleCount, 0) / results.length).toFixed(2) : "—";
  const avgOnTicks = results ? (results.reduce((sum, r) => sum + r.irrigationOnTicks, 0) / results.length).toFixed(2) : "—";

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Configuration</CardTitle>
          <CardDescription>Set up parameters for parallel simulations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Width</label>
              <Input
                type="number"
                value={config.width}
                onChange={(e) => updateConfig("width", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Height</label>
              <Input
                type="number"
                value={config.height}
                onChange={(e) => updateConfig("height", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Pillar Density</label>
              <Input
                type="number"
                step="0.01"
                value={config.pillarDensity}
                onChange={(e) => updateConfig("pillarDensity", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Plant Chance</label>
              <Input
                type="number"
                step="0.01"
                value={config.plantChanceNearPath}
                onChange={(e) => updateConfig("plantChanceNearPath", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Coverage Radius</label>
              <Input
                type="number"
                value={config.coverageRadius}
                onChange={(e) => updateConfig("coverageRadius", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Simulations</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={config.simulationCount}
                onChange={(e) => updateConfig("simulationCount", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Base Seed</label>
              <Input
                type="number"
                value={config.baseSeed}
                onChange={(e) => updateConfig("baseSeed", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Controller</label>
              <ControllerSelector
                controllerKey={config.controllerKey}
                selectedTrainingId={selectedTrainingId}
                onControllerChange={(key) => updateConfig("controllerKey", key)}
                onTrainingChange={setSelectedTrainingId}
                disabled={loading}
                excludeManual={true}
                showTrainingDate={true}
                controllerClassName="rounded-md border p-2 text-xs"
                trainingClassName="rounded-md border p-2 text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleRunSimulations} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Running {config.simulationCount} Simulations...
                </>
              ) : (
                `🚀 Run ${config.simulationCount} Parallel Simulations`
              )}
            </Button>
            <Button
              onClick={() => setConfig((prev) => ({ ...prev, baseSeed: Math.floor(Math.random() * 1000000) }))}
              disabled={loading}
              variant="outline"
            >
              🎲 Random Seed
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Error Section */}
      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
            <CardDescription>{results.length} simulations completed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Average Score</span>
                <span className="text-2xl font-bold">{avgScore}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Score Range</span>
                <span className="text-2xl font-bold">{minScore} → {maxScore}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Total Water Used</span>
                <span className="text-2xl font-bold">{totalWaterUsed} units</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Avg Water/Sim</span>
                <span className="text-2xl font-bold">
                  {results.length > 0 ? (parseFloat(totalWaterUsed as string) / results.length).toFixed(2) : "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Avg Toggles</span>
                <span className="text-2xl font-bold">{avgToggleCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Avg On Ticks</span>
                <span className="text-2xl font-bold">{avgOnTicks}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Individual Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Sim</th>
                    <th className="px-4 py-2 text-right font-semibold">Score</th>
                    <th className="px-4 py-2 text-right font-semibold">Water Used</th>
                    <th className="px-4 py-2 text-right font-semibold">Toggles</th>
                    <th className="px-4 py-2 text-right font-semibold">On Ticks</th>
                    <th className="px-4 py-2 text-right font-semibold">Healthy</th>
                    <th className="px-4 py-2 text-right font-semibold">Dry</th>
                    <th className="px-4 py-2 text-right font-semibold">Flooded</th>
                    <th className="px-4 py-2 text-right font-semibold">Peak Dry</th>
                    <th className="px-4 py-2 text-right font-semibold">Peak Flooded</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">#{index + 1}</td>
                      <td className={`px-4 py-2 text-right font-bold ${result.finalScore >= 70 ? "text-green-600" :
                        result.finalScore >= 50 ? "text-yellow-600" :
                          "text-red-600"
                        }`}>
                        {result.finalScore}
                      </td>
                      <td className="px-4 py-2 text-right">{result.totalWaterUsed.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{result.irrigationToggleCount}</td>
                      <td className="px-4 py-2 text-right">{result.irrigationOnTicks}</td>
                      <td className="px-4 py-2 text-right text-green-600">{result.healthyPlantTicks}</td>
                      <td className="px-4 py-2 text-right text-red-600">{result.dryPlantTicks}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{result.floodedPlantTicks}</td>
                      <td className="px-4 py-2 text-right">{result.peakSimultaneousDryPlants}</td>
                      <td className="px-4 py-2 text-right">{result.peakSimultaneousFloodedPlants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
