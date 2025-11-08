// Simple Linear Congruential Generator (LCG) for deterministic random numbers
// Uses same algorithm as many standard libraries for reproducible results
export class SeededRandom {
    constructor(seed = 1) {
        this.seed = seed;
    }
    
    // Generate next pseudo-random number in range [0, 1)
    random() {
        // LCG formula: (a * seed + c) % m
        // Using values from Numerical Recipes: a=1664525, c=1013904223, m=2^32
        this.seed = (1664525 * this.seed + 1013904223) % (2 ** 32);
        return this.seed / (2 ** 32);
    }
    
    // Set new seed
    setSeed(seed) {
        this.seed = seed;
    }
    
    // Get current seed
    getSeed() {
        return this.seed;
    }
}

// Global instance for easy access
let globalRandom = new SeededRandom();

// Export functions to match Math.random() interface
export function random() {
    return globalRandom.random();
}

export function setSeed(seed) {
    globalRandom.setSeed(seed);
}

export function getSeed() {
    return globalRandom.getSeed();
}

// Generate a pixel-specific seed for deterministic per-pixel randomness
export function getPixelSeed(baseSeed, x, y, width, height) {
    // Simple hash function to create unique seed per pixel
    const pixelIndex = y * width + x;
    return baseSeed + pixelIndex * 1337 + x * 7919 + y * 3571;
}

// Create a temporary seeded random generator for a specific pixel
export function createPixelRandom(baseSeed, x, y, width, height) {
    const pixelSeed = getPixelSeed(baseSeed, x, y, width, height);
    return new SeededRandom(pixelSeed);
}