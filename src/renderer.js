#!/usr/bin/env node

import { Vec3, Color } from './math.js';
import { Sphere, Plane, Material, Scene, Light } from './geometry.js';
import { Camera, Raytracer } from './raytracer.js';
import { MultiThreadedRaytracer } from './multi-threaded-raytracer.js';
import { RIBParser } from './rib-parser.js';
import { ImageWriter } from './image-output.js';
import { cpus } from 'os';
import fs from 'fs';

class RenderApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.raytracer = null;
    }

    createDefaultScene() {
        this.scene = new Scene();
        this.scene.backgroundColor = new Color(0.5, 0.7, 1.0);

        const redMaterial = new Material(new Color(0.8, 0.2, 0.2), 0.1, 0.7, 0.2, 32, 0.1);
        const greenMaterial = new Material(new Color(0.2, 0.8, 0.2), 0.1, 0.7, 0.2, 32, 0);
        const blueMaterial = new Material(new Color(0.2, 0.2, 0.8), 0.1, 0.7, 0.2, 32, 0);
        const mirrorMaterial = new Material(new Color(0.9, 0.9, 0.9), 0.05, 0.1, 0.9, 128, 0.9);
        const floorMaterial = new Material(new Color(0.8, 0.8, 0.8), 0.2, 0.8, 0.0, 1, 0);

        this.scene.add(new Sphere(new Vec3(0, 0, -1), 0.5, redMaterial));
        this.scene.add(new Sphere(new Vec3(-1, 0, -1), 0.5, greenMaterial));
        this.scene.add(new Sphere(new Vec3(1, 0, -1), 0.5, blueMaterial));
        this.scene.add(new Sphere(new Vec3(0, 1, -1), 0.3, mirrorMaterial));
        this.scene.add(new Plane(new Vec3(0, -0.5, 0), new Vec3(0, 1, 0), floorMaterial));

        this.scene.addLight(new Light(new Vec3(2, 2, 0), new Color(1, 1, 1), 1));
        this.scene.addLight(new Light(new Vec3(-2, 2, 0), new Color(0.8, 0.8, 1), 0.5));

        this.camera = new Camera(
            new Vec3(0, 0, 2),
            new Vec3(0, 0, -1),
            new Vec3(0, 1, 0),
            45,
            16/9
        );
    }

    parseRIBFile(filePath) {
        if (!fs.existsSync(filePath)) {
            console.error(`RIB file not found: ${filePath}`);
            return false;
        }

        try {
            const parser = new RIBParser();
            this.scene = parser.parse(filePath);
            
            if (this.scene.lights.length === 0) {
                this.scene.addLight(new Light(new Vec3(5, 5, 5), new Color(1, 1, 1), 1));
            }
            
            this.camera = new Camera(
                new Vec3(0, 0, 1),
                new Vec3(0, 0, -3),
                new Vec3(0, 1, 0),
                45,
                16/9
            );
            
            console.log(`Loaded RIB file: ${filePath}`);
            console.log(`Scene contains ${this.scene.objects.length} objects and ${this.scene.lights.length} lights`);
            
            return true;
        } catch (error) {
            console.error(`Error parsing RIB file: ${error.message}`);
            return false;
        }
    }

    async render(width = 400, height = 300, samples = 1, outputPath = 'output.ppm', antialiasingQuality = null, gammaCorrection = 2.2, useStratified = true, useMultiThreading = true, numThreads = null, randomSeed = null) {
        if (!this.scene || !this.camera) {
            console.error('Scene or camera not initialized');
            return;
        }

        const availableCpus = cpus().length;
        const actualThreads = numThreads || availableCpus;
        
        // Choose raytracer based on threading preference
        if (useMultiThreading && actualThreads > 1) {
            this.raytracer = new MultiThreadedRaytracer(this.scene, this.camera, width, height);
            this.raytracer.setNumThreads(actualThreads);
            console.log(`Using multi-threaded rendering with ${actualThreads} threads (${availableCpus} CPUs available)`);
        } else {
            this.raytracer = new Raytracer(this.scene, this.camera, width, height);
            console.log(`Using single-threaded rendering`);
        }
        
        if (antialiasingQuality) {
            this.raytracer.setAntialiasingQuality(antialiasingQuality);
            console.log(`Starting render: ${width}x${height}, antialiasing: ${antialiasingQuality} (${this.raytracer.samples} samples per pixel)`);
        } else {
            this.raytracer.setSamples(samples);
            this.raytracer.setStratifiedSampling(useStratified);
            console.log(`Starting render: ${width}x${height}, ${samples} samples per pixel`);
        }
        
        // Apply gamma correction setting
        this.raytracer.setGammaCorrection(gammaCorrection);
        
        // Set random seed if provided
        if (randomSeed !== null) {
            this.raytracer.setRandomSeed(randomSeed);
            console.log(`Using deterministic seed: ${randomSeed}`);
        }
        
        console.log(`Output file: ${outputPath}`);
        console.log(`Gamma correction: ${this.raytracer.gammaCorrection}`);
        console.log(`Stratified sampling: ${this.raytracer.useStratifiedSampling ? 'enabled' : 'disabled'}`);
        
        const startTime = Date.now();
        const image = await this.raytracer.render();
        const endTime = Date.now();
        
        console.log(`Render completed in ${(endTime - startTime) / 1000} seconds`);
        
        ImageWriter.writePPM(image, outputPath);
    }

    printUsage() {
        console.log(`
Usage: node renderer.js [options]

Options:
  --rib <file>         Render from RIB file
  --width <number>     Image width (default: 400)
  --height <number>    Image height (default: 300)
  --samples <number>   Samples per pixel (default: 1)
  --aa <quality>       Antialiasing quality: none, low, medium, high, ultra
  --gamma <number>     Gamma correction value (default: 2.2)
  --no-stratified      Disable stratified sampling (use random sampling)
  --single-threaded    Disable multi-threading (use single thread)
  --threads <number>   Number of threads to use (default: auto-detect)
  --seed <number>      Random seed for deterministic output (default: auto)
  --output <file>      Output filename (default: output.ppm)
  --help              Show this help message

Antialiasing Quality Levels:
  none     - No antialiasing (1 sample per pixel)
  low      - Light antialiasing (4 samples per pixel)
  medium   - Good quality (9 samples per pixel)
  high     - High quality (16 samples per pixel)
  ultra    - Maximum quality (25 samples per pixel)

Examples:
  node renderer.js
  node renderer.js --width 800 --height 600 --aa high
  node renderer.js --rib scene.rib --aa medium --output rendered.ppm
  node renderer.js --samples 16 --no-stratified
  node renderer.js --single-threaded --width 400 --height 300
  node renderer.js --threads 4 --aa high
        `);
    }

    async run() {
        const args = process.argv.slice(2);
        
        if (args.includes('--help')) {
            this.printUsage();
            return;
        }

        let ribFile = null;
        let width = 400;
        let height = 300;
        let samples = 1;
        let outputPath = 'output.ppm';
        let antialiasingQuality = null;
        let gammaCorrection = 2.2;
        let useStratified = true;
        let useMultiThreading = true;
        let numThreads = null;
        let randomSeed = null;

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--rib':
                    ribFile = args[++i];
                    break;
                case '--width':
                    width = parseInt(args[++i]);
                    break;
                case '--height':
                    height = parseInt(args[++i]);
                    break;
                case '--samples':
                    samples = parseInt(args[++i]);
                    break;
                case '--aa':
                    antialiasingQuality = args[++i];
                    break;
                case '--gamma':
                    gammaCorrection = parseFloat(args[++i]);
                    break;
                case '--no-stratified':
                    useStratified = false;
                    break;
                case '--single-threaded':
                    useMultiThreading = false;
                    break;
                case '--threads':
                    numThreads = parseInt(args[++i]);
                    break;
                case '--seed':
                    randomSeed = parseInt(args[++i]);
                    break;
                case '--output':
                    outputPath = args[++i];
                    break;
            }
        }

        if (ribFile) {
            if (!this.parseRIBFile(ribFile)) {
                console.log('Failed to parse RIB file, using default scene instead');
                this.createDefaultScene();
            }
        } else {
            console.log('No RIB file specified, using default scene');
            this.createDefaultScene();
        }

        await this.render(width, height, samples, outputPath, antialiasingQuality, gammaCorrection, useStratified, useMultiThreading, numThreads, randomSeed);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const app = new RenderApp();
    app.run().catch(error => {
        console.error('Rendering failed:', error.message);
        process.exit(1);
    });
}