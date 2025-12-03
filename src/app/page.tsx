import { GardenView } from "@/lib/garden";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-bold mb-4">
          Intelligent Irrigation Garden (Prototype)
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          This is the base garden generator. Next we&apos;ll add hose routing,
          irrigation simulation and AI controllers.
        </p>
        <GardenView width={30} height={20} />
      </div>
    </main>
  );
}
