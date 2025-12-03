import { GardenView } from "@/lib/garden";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-bold mb-4">
          Intelligent Irrigation Garden (WIP)
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Here you can generate a garden.
        </p>
        <GardenView width={30} height={20} />
      </div>
    </main>
  );
}
