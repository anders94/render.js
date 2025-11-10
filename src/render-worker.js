import { parentPort } from 'worker_threads';
import { Vec3, Ray, Color } from './math.js';
import { Sphere, Plane, Triangle, Material, Scene, Light, NURBSSurface } from './geometry.js';
import { Camera, Raytracer } from './raytracer.js';
import { createPixelRandom } from './random.js';

// Worker thread for rendering a tile of the image
parentPort.on('message', (data) => {
    const {
        sceneData,
        cameraData,
        renderConfig,
        tileConfig
    } = data;

    try {
        // Reconstruct scene from serialized data
        const scene = reconstructScene(sceneData);
        const camera = reconstructCamera(cameraData);
        
        
        // Create raytracer with config
        const raytracer = new Raytracer(scene, camera, renderConfig.width, renderConfig.height);
        raytracer.setSamples(renderConfig.samples);
        raytracer.setMaxDepth(renderConfig.maxDepth);
        raytracer.setStratifiedSampling(renderConfig.useStratifiedSampling);
        raytracer.setGammaCorrection(renderConfig.gammaCorrection);
        raytracer.setRandomSeed(tileConfig.seed); // Set base seed for pixel-specific seeding
        
        // Render the assigned tile
        const tileImage = renderTile(raytracer, tileConfig);
        
        // Send result back to main thread
        parentPort.postMessage({
            success: true,
            tileId: tileConfig.tileId,
            tileImage: tileImage,
            startY: tileConfig.startY,
            endY: tileConfig.endY
        });
    } catch (error) {
        parentPort.postMessage({
            success: false,
            error: error.message,
            tileId: tileConfig.tileId
        });
    }
});

function reconstructScene(sceneData) {
    const scene = new Scene();
    scene.backgroundColor = new Color(
        sceneData.backgroundColor.r,
        sceneData.backgroundColor.g,
        sceneData.backgroundColor.b
    );
    
    // Reconstruct objects
    for (const objData of sceneData.objects) {
        let obj;
        
        if (objData.type === 'sphere') {
            const center = new Vec3(objData.center.x, objData.center.y, objData.center.z);
            const material = new Material(
                new Color(objData.material.color.r, objData.material.color.g, objData.material.color.b),
                objData.material.ambient,
                objData.material.diffuse,
                objData.material.specular,
                objData.material.shininess,
                objData.material.reflectivity
            );
            obj = new Sphere(center, objData.radius, material);
        } else if (objData.type === 'plane') {
            const point = new Vec3(objData.point.x, objData.point.y, objData.point.z);
            const normal = new Vec3(objData.normal.x, objData.normal.y, objData.normal.z);
            const material = new Material(
                new Color(objData.material.color.r, objData.material.color.g, objData.material.color.b),
                objData.material.ambient,
                objData.material.diffuse,
                objData.material.specular,
                objData.material.shininess,
                objData.material.reflectivity
            );
            obj = new Plane(point, normal, material);
        } else if (objData.type === 'triangle') {
            const v0 = new Vec3(objData.v0.x, objData.v0.y, objData.v0.z);
            const v1 = new Vec3(objData.v1.x, objData.v1.y, objData.v1.z);
            const v2 = new Vec3(objData.v2.x, objData.v2.y, objData.v2.z);
            const material = new Material(
                new Color(objData.material.color.r, objData.material.color.g, objData.material.color.b),
                objData.material.ambient,
                objData.material.diffuse,
                objData.material.specular,
                objData.material.shininess,
                objData.material.reflectivity
            );
            obj = new Triangle(v0, v1, v2, material);
        } else if (objData.type === 'nurbs') {
            // Reconstruct control points
            const controlPoints = objData.controlPoints.map(row => 
                row.map(point => new Vec3(point.x, point.y, point.z))
            );
            
            const material = new Material(
                new Color(objData.material.color.r, objData.material.color.g, objData.material.color.b),
                objData.material.ambient,
                objData.material.diffuse,
                objData.material.specular,
                objData.material.shininess,
                objData.material.reflectivity
            );
            
            obj = new NURBSSurface(
                controlPoints,
                objData.weights,
                objData.uKnots,
                objData.vKnots,
                objData.uDegree,
                objData.vDegree,
                material
            );
        }
        
        if (obj) {
            scene.add(obj);
        }
    }
    
    // Reconstruct lights
    for (const lightData of sceneData.lights) {
        const position = new Vec3(lightData.position.x, lightData.position.y, lightData.position.z);
        const color = new Color(lightData.color.r, lightData.color.g, lightData.color.b);
        const light = new Light(position, color, lightData.intensity);
        scene.addLight(light);
    }
    
    return scene;
}

function reconstructCamera(cameraData) {
    const position = new Vec3(cameraData.position.x, cameraData.position.y, cameraData.position.z);
    const target = new Vec3(cameraData.target.x, cameraData.target.y, cameraData.target.z);
    const up = new Vec3(cameraData.up.x, cameraData.up.y, cameraData.up.z);
    
    return new Camera(position, target, up, cameraData.fov, cameraData.aspectRatio);
}

function renderTile(raytracer, tileConfig) {
    const { startY, endY, width } = tileConfig;
    const tileImage = [];
    
    // Match single-threaded coordinate system: j decreases from endY-1 to startY
    for (let j = endY - 1; j >= startY; j--) {
        const row = [];
        for (let i = 0; i < width; i++) {
            let pixelColor = raytracer.renderPixel(i, j);
            
            // Apply gamma correction
            if (raytracer.gammaCorrection !== 1.0) {
                const gamma = 1.0 / raytracer.gammaCorrection;
                pixelColor = new Color(
                    Math.pow(pixelColor.r, gamma),
                    Math.pow(pixelColor.g, gamma),
                    Math.pow(pixelColor.b, gamma)
                );
            }
            
            row.push({
                r: pixelColor.r,
                g: pixelColor.g,
                b: pixelColor.b
            });
        }
        tileImage.push(row);
    }
    
    return tileImage;
}