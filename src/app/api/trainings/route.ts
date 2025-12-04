import { NextResponse } from 'next/server';
import { getTrainingStore } from '@/lib/redis/trainingStore';

export async function GET() {
  try {
    const store = getTrainingStore();
    const connected = await store.connect();
    
    if (!connected) {
      return NextResponse.json(
        { error: 'Redis not connected' },
        { status: 503 }
      );
    }

    const trainings = await store.listAll();
    return NextResponse.json({ trainings });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trainings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const training = await request.json();
    const store = getTrainingStore();
    const connected = await store.connect();
    
    if (!connected) {
      return NextResponse.json(
        { error: 'Redis not connected' },
        { status: 503 }
      );
    }
    
    const id = await store.save(
      { params: training.params, fitness: training.fitness },
      training.name,
      training.config
    );

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error('Failed to save training:', error);
    return NextResponse.json(
      { error: 'Failed to save training' },
      { status: 500 }
    );
  }
}
