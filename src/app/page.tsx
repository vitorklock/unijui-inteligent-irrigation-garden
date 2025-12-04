"use client";

import { GardenView } from "@/lib/garden";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParallelSimulationsPanel } from "@/app/components/ParallelSimulationsPanel";
import { GATrainingUI } from "@/app/components/GATrainingUI";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            Intelligent Irrigation Garden (WIP)
          </h1>
          <p className="text-sm text-gray-600">
            Interactive garden simulation with parallel experimentation.
          </p>
        </div>

        <Tabs defaultValue="garden" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="garden">🌱 Garden View</TabsTrigger>
            <TabsTrigger value="parallel">⚡ Simulations</TabsTrigger>
            <TabsTrigger value="training">🧬 GA Training</TabsTrigger>
          </TabsList>

          <TabsContent value="garden" className="mt-6">
            <GardenView width={30} height={20} />
          </TabsContent>

          <TabsContent value="parallel" className="mt-6">
            <ParallelSimulationsPanel />
          </TabsContent>

          <TabsContent value="training" className="mt-6">
            <GATrainingUI />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
