'use client';

import { useState, useEffect } from 'react';
import { SavedTraining } from '@/lib/redis/trainingStore';
import { ControllerParams } from '@/lib/garden/controllers/SmartIrrigationController';

/**
 * Hook to fetch and use trained controller parameters from Redis.
 * 
 * Usage:
 * ```tsx
 * const { trainings, best, loading, refresh } = useTrainedParams();
 * 
 * // Use best params
 * if (best) {
 *   const controller = new SmartIrrigationController(fuzzy, nn, best.params);
 * }
 * ```
 */
export function useTrainedParams() {
  const [trainings, setTrainings] = useState<SavedTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/trainings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch trainings');
      }
      
      const data = await response.json();
      setTrainings(data.trainings || []);
    } catch (err) {
      console.error('Failed to fetch trainings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTrainings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  // Get the best training (highest fitness)
  const best = trainings.length > 0
    ? trainings.reduce((best, current) => 
        current.fitness > best.fitness ? current : best
      )
    : null;

  return {
    trainings,
    best,
    loading,
    error,
    refresh: fetchTrainings,
  };
}

/**
 * Hook to fetch a specific training by ID.
 */
export function useTraining(id: string | null) {
  const [training, setTraining] = useState<SavedTraining | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setTraining(null);
      return;
    }

    const fetchTraining = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/trainings/${id}`);
        
        if (!response.ok) {
          throw new Error('Training not found');
        }
        
        const data = await response.json();
        setTraining(data.training);
      } catch (err) {
        console.error('Failed to fetch training:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTraining(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTraining();
  }, [id]);

  return { training, loading, error };
}
