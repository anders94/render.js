import { Vec3, Ray, Color } from './math.js';
import { random, setSeed, createPixelRandom } from './random.js';

export class Camera {
    constructor(position, target, up, fov = 45, aspectRatio = 16/9) {
        this.position = position;
        this.target = target;
        this.up = up.normalize();
        this.fovDegrees = fov; // Store original degrees value
        this.fov = fov * Math.PI / 180; // Convert to radians for calculations
        this.aspectRatio = aspectRatio;
        
        this.setupCamera();
    }
    
    setupCamera() {
        this.forward = this.target.subtract(this.position).normalize();
        this.right = this.forward.cross(this.up).normalize();
        this.up = this.right.cross(this.forward).normalize();
        
        const halfHeight = Math.tan(this.fov / 2);
        const halfWidth = halfHeight * this.aspectRatio;
        
        this.lowerLeftCorner = this.position
            .subtract(this.right.multiply(halfWidth))
            .subtract(this.up.multiply(halfHeight))
            .add(this.forward);
            
        this.horizontal = this.right.multiply(2 * halfWidth);
        this.vertical = this.up.multiply(2 * halfHeight);
    }
    
    getRay(u, v) {
        const direction = this.lowerLeftCorner
            .add(this.horizontal.multiply(u))
            .add(this.vertical.multiply(v))
            .subtract(this.position);
            
        return new Ray(this.position, direction);
    }
}

export class Raytracer {
    constructor(scene, camera, width = 800, height = 600) {
        this.scene = scene;
        this.camera = camera;
        this.width = width;
        this.height = height;
        this.maxDepth = 10;
        this.samples = 1;
        this.useStratifiedSampling = true;
        this.gammaCorrection = 2.2;
        this.randomSeed = 12345; // Default deterministic seed
    }
    
    setRandomSeed(seed) {
        this.randomSeed = seed;
    }
    
    async render() {
        // Initialize deterministic seed for this render
        setSeed(this.randomSeed);
        
        const image = [];
        
        for (let j = this.height - 1; j >= 0; j--) {
            const row = [];
            for (let i = 0; i < this.width; i++) {
                let pixelColor = this.renderPixel(i, j);
                
                // Apply gamma correction
                if (this.gammaCorrection !== 1.0) {
                    const gamma = 1.0 / this.gammaCorrection;
                    pixelColor = new Color(
                        Math.pow(pixelColor.r, gamma),
                        Math.pow(pixelColor.g, gamma),
                        Math.pow(pixelColor.b, gamma)
                    );
                }
                
                row.push(pixelColor);
            }
            image.push(row);
            
            if (j % 50 === 0) {
                console.log(`Rendering progress: ${Math.round((this.height - j) / this.height * 100)}%`);
            }
        }
        
        return image;
    }
    
    renderPixel(x, y) {
        // Set pixel-specific seed for deterministic randomness
        const pixelRandom = createPixelRandom(this.randomSeed, x, y, this.width, this.height);
        
        if (this.samples === 1) {
            // Single sample - no antialiasing
            const u = (x + 0.5) / this.width;
            const v = (y + 0.5) / this.height;
            const ray = this.camera.getRay(u, v);
            return this.traceRay(ray, this.maxDepth);
        }
        
        let pixelColor = new Color(0, 0, 0);
        
        if (this.useStratifiedSampling) {
            // Stratified sampling for better distribution
            const sqrtSamples = Math.ceil(Math.sqrt(this.samples));
            const actualSamples = sqrtSamples * sqrtSamples;
            
            for (let sy = 0; sy < sqrtSamples; sy++) {
                for (let sx = 0; sx < sqrtSamples; sx++) {
                    // Jittered stratified sampling
                    const offsetX = (sx + pixelRandom.random()) / sqrtSamples;
                    const offsetY = (sy + pixelRandom.random()) / sqrtSamples;
                    
                    const u = (x + offsetX) / this.width;
                    const v = (y + offsetY) / this.height;
                    
                    const ray = this.camera.getRay(u, v);
                    const color = this.traceRay(ray, this.maxDepth);
                    pixelColor = pixelColor.add(color);
                }
            }
            
            pixelColor = pixelColor.multiply(1.0 / actualSamples);
        } else {
            // Random sampling (original method)
            for (let s = 0; s < this.samples; s++) {
                const u = (x + pixelRandom.random()) / this.width;
                const v = (y + pixelRandom.random()) / this.height;
                
                const ray = this.camera.getRay(u, v);
                const color = this.traceRay(ray, this.maxDepth);
                pixelColor = pixelColor.add(color);
            }
            
            pixelColor = pixelColor.multiply(1.0 / this.samples);
        }
        
        return pixelColor;
    }
    
    traceRay(ray, depth) {
        if (depth <= 0) {
            return new Color(0, 0, 0);
        }
        
        const hit = this.scene.intersect(ray);
        if (!hit) {
            return this.scene.backgroundColor;
        }
        
        
        const color = this.shade(hit, ray, depth);
        return color;
    }
    
    shade(hit, ray, depth) {
        const material = hit.material;
        let color = new Color(0, 0, 0);
        
        color = color.add(material.color.multiply(material.ambient));
        
        for (const light of this.scene.lights) {
            const lightDir = light.position.subtract(hit.point).normalize();
            const lightDistance = light.position.subtract(hit.point).length();
            
            const shadowRay = new Ray(hit.point, lightDir, 0.001, lightDistance - 0.001);
            const shadowHit = this.scene.intersect(shadowRay);
            
            if (!shadowHit) {
                const ndotl = Math.max(0, hit.normal.dot(lightDir));
                const diffuse = material.color.blend(light.color).multiply(material.diffuse * ndotl * light.intensity);
                color = color.add(diffuse);
                
                const viewDir = ray.direction.negate().normalize();
                const reflectDir = lightDir.negate().reflect(hit.normal);
                const spec = Math.pow(Math.max(0, viewDir.dot(reflectDir)), material.shininess);
                const specular = light.color.multiply(material.specular * spec * light.intensity);
                color = color.add(specular);
            }
        }
        
        if (material.reflectivity > 0 && depth > 1) {
            const reflectDir = ray.direction.reflect(hit.normal);
            const reflectRay = new Ray(hit.point, reflectDir);
            const reflectColor = this.traceRay(reflectRay, depth - 1);
            color = color.add(reflectColor.multiply(material.reflectivity));
        }
        
        return color;
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
    
    // Configure antialiasing quality presets
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
}