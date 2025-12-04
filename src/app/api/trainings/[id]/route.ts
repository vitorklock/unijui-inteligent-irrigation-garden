import { NextRequest, NextResponse } from 'next/server';
import { getTrainingStore } from '@/lib/redis/trainingStore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const store = getTrainingStore();
    const connected = await store.connect();
    
    if (!connected) {
      return NextResponse.json(
        { error: 'Redis not connected' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const training = await store.load(id);
    
    if (!training) {
      return NextResponse.json(
        { error: 'Training not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ training });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch training' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const store = getTrainingStore();
    const connected = await store.connect();
    
    if (!connected) {
      return NextResponse.json(
        { error: 'Redis not connected' },
        { status: 503 }
      );
    }

    const { id } = await params;
    await store.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete training:', error);
    return NextResponse.json(
      { error: 'Failed to delete training' },
      { status: 500 }
    );
  }
}
