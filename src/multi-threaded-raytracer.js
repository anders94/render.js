import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Color } from './math.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MultiThreadedRaytracer {
    constructor(scene, camera, width = 800, height = 600) {
        this.scene = scene;
        this.camera = camera;
        this.width = width;
        this.height = height;
        this.maxDepth = 10;
        this.samples = 1;
        this.useStratifiedSampling = true;
        this.gammaCorrection = 2.2;
        this.numThreads = cpus().length;
        this.randomSeed = 12345; // Default deterministic seed
    }
    
    setSamples(samples) {
        this.samples = samples;
    }
    
    setMaxDepth(depth) {
        this.maxDepth = depth;
    }
    
    setStratifiedSampling(enabled) {
        this.useStratifiedSampling = enabled;
    }
    
    setGammaCorrection(gamma) {
        this.gammaCorrection = gamma;
    }
    
    setAntialiasingQuality(quality) {
        switch (quality.toLowerCase()) {
            case 'none':
                this.samples = 1;
                break;
            case 'low':
                this.samples = 4;
                this.useStratifiedSampling = true;
                break;
            case 'medium':
                this.samples = 9;
                this.useStratifiedSampling = true;
                break;
            case 'high':
                this.samples = 16;
                this.useStratifiedSampling = true;
                break;
            case 'ultra':
                this.samples = 25;
                this.useStratifiedSampling = true;
                break;
            default:
                console.warn(`Unknown antialiasing quality: ${quality}. Using 'medium'.`);
                this.setAntialiasingQuality('medium');
        }
    }
    
    setNumThreads(numThreads) {
        this.numThreads = Math.max(1, Math.min(numThreads, cpus().length));
    }
    
    setRandomSeed(seed) {
        this.randomSeed = seed;
    }
    
    async render() {
        console.log(`Using ${this.numThreads} worker threads for rendering`);
        
        // Serialize scene and camera data for workers
        const sceneData = this.serializeScene(this.scene);
        const cameraData = this.serializeCamera(this.camera);
        
        const renderConfig = {
            width: this.width,
            height: this.height,
            samples: this.samples,
            maxDepth: this.maxDepth,
            useStratifiedSampling: this.useStratifiedSampling,
            gammaCorrection: this.gammaCorrection,
            randomSeed: this.randomSeed
        };
        
        // Divide work into tiles (horizontal strips)
        const tilesPerThread = Math.ceil(this.height / this.numThreads);
        const tiles = [];
        
        for (let i = 0; i < this.numThreads; i++) {
            const startY = i * tilesPerThread;
            const endY = Math.min((i + 1) * tilesPerThread, this.height);
            
            if (startY < endY) {
                tiles.push({
                    tileId: i,
                    startY: startY,
                    endY: endY,
                    width: this.width,
                    height: endY - startY,
                    fullWidth: this.width,  // Add full image dimensions for pixel seeding
                    fullHeight: this.height,
                    seed: this.randomSeed // Pass same seed to all tiles - pixels will derive their own
                });
            }
        }
        
        console.log(`Rendering ${tiles.length} tiles with ${this.width}x${this.height} resolution`);
        
        // Create workers and start rendering
        const workers = [];
        const promises = [];
        
        for (const tile of tiles) {
            const workerPromise = this.createWorkerForTile(sceneData, cameraData, renderConfig, tile);
            promises.push(workerPromise);
        }
        
        // Wait for all workers to complete
        const results = await Promise.all(promises);
        
        // Combine results into final image
        const image = this.combineTiles(results);
        
        console.log(`Multi-threaded rendering completed`);
        return image;
    }
    
    createWorkerForTile(sceneData, cameraData, renderConfig, tileConfig) {
        return new Promise((resolve, reject) => {
            const workerPath = join(__dirname, 'render-worker.js');
            const worker = new Worker(workerPath);
            
            // Set up message handler
            worker.on('message', (result) => {
                worker.terminate();
                
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            });
            
            worker.on('error', (error) => {
                worker.terminate();
                reject(error);
            });
            
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
            
            // Send work to worker
            worker.postMessage({
                sceneData,
                cameraData,
                renderConfig,
                tileConfig
            });
            
            // Progress tracking
            const progressPercent = Math.round((tileConfig.tileId / this.numThreads) * 100);
            if (tileConfig.tileId % Math.max(1, Math.floor(this.numThreads / 4)) === 0) {
                console.log(`Starting tile ${tileConfig.tileId + 1}/${this.numThreads} (${progressPercent}%)`);
            }
        });
    }
    
    combineTiles(tileResults) {
        // Sort tiles by startY in descending order to match coordinate system
        // (image array starts from top of image, which has higher Y values)
        tileResults.sort((a, b) => b.startY - a.startY);
        
        const image = [];
        
        for (const tileResult of tileResults) {
            // Convert serialized color data back to Color objects
            for (const row of tileResult.tileImage) {
                const colorRow = row.map(pixel => new Color(pixel.r, pixel.g, pixel.b));
                image.push(colorRow);
            }
        }
        
        return image;
    }
    
    serializeScene(scene) {
        const serializedObjects = scene.objects.map(obj => {
            if (obj.center) { // Sphere
                return {
                    type: 'sphere',
                    center: { x: obj.center.x, y: obj.center.y, z: obj.center.z },
                    radius: obj.radius,
                    material: {
                        color: { r: obj.material.color.r, g: obj.material.color.g, b: obj.material.color.b },
                        ambient: obj.material.ambient,
                        diffuse: obj.material.diffuse,
                        specular: obj.material.specular,
                        shininess: obj.material.shininess,
                        reflectivity: obj.material.reflectivity
                    }
                };
            } else if (obj.point) { // Plane
                return {
                    type: 'plane',
                    point: { x: obj.point.x, y: obj.point.y, z: obj.point.z },
                    normal: { x: obj.normal.x, y: obj.normal.y, z: obj.normal.z },
                    material: {
                        color: { r: obj.material.color.r, g: obj.material.color.g, b: obj.material.color.b },
                        ambient: obj.material.ambient,
                        diffuse: obj.material.diffuse,
                        specular: obj.material.specular,
                        shininess: obj.material.shininess,
                        reflectivity: obj.material.reflectivity
                    }
                };
            } else if (obj.v0) { // Triangle
                return {
                    type: 'triangle',
                    v0: { x: obj.v0.x, y: obj.v0.y, z: obj.v0.z },
                    v1: { x: obj.v1.x, y: obj.v1.y, z: obj.v1.z },
                    v2: { x: obj.v2.x, y: obj.v2.y, z: obj.v2.z },
                    material: {
                        color: { r: obj.material.color.r, g: obj.material.color.g, b: obj.material.color.b },
                        ambient: obj.material.ambient,
                        diffuse: obj.material.diffuse,
                        specular: obj.material.specular,
                        shininess: obj.material.shininess,
                        reflectivity: obj.material.reflectivity
                    }
                };
            } else if (obj.controlPoints) { // NURBS Surface
                return {
                    type: 'nurbs',
                    controlPoints: obj.controlPoints.map(row => row.map(point => ({
                        x: point.x, y: point.y, z: point.z
                    }))),
                    weights: obj.weights,
                    uKnots: obj.uKnots,
                    vKnots: obj.vKnots,
                    uDegree: obj.uDegree,
                    vDegree: obj.vDegree,
                    material: {
                        color: { r: obj.material.color.r, g: obj.material.color.g, b: obj.material.color.b },
                        ambient: obj.material.ambient,
                        diffuse: obj.material.diffuse,
                        specular: obj.material.specular,
                        shininess: obj.material.shininess,
                        reflectivity: obj.material.reflectivity
                    }
                };
            }
        }).filter(obj => obj !== undefined);
        
        const serializedLights = scene.lights.map(light => ({
            position: { x: light.position.x, y: light.position.y, z: light.position.z },
            color: { r: light.color.r, g: light.color.g, b: light.color.b },
            intensity: light.intensity
        }));
        
        return {
            objects: serializedObjects,
            lights: serializedLights,
            backgroundColor: {
                r: scene.backgroundColor.r,
                g: scene.backgroundColor.g,
                b: scene.backgroundColor.b
            }
        };
    }
    
    serializeCamera(camera) {
        return {
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            target: { x: camera.target.x, y: camera.target.y, z: camera.target.z },
            up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
            fov: camera.fovDegrees, // Use original degrees value
            aspectRatio: camera.aspectRatio
        };
    }
}