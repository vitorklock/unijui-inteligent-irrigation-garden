import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function mulberry32(seed: number): () => number {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fisher-Yates shuffle algorithm
 * 
 * Randomly shuffles an array in-place using the Fisher-Yates algorithm.
 * This ensures an unbiased, uniform distribution of all possible permutations.
 * 
 * @param array - The array to shuffle (modified in-place)
 * @param rand - Random number generator function that returns a value between 0 and 1
 * @returns The shuffled array (same reference as input)
 */
export function fisherYatesShuffle<T>(array: T[], rand: () => number = Math.random): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}