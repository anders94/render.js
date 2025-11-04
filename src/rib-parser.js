import fs from 'fs';
import { Vec3, Color, Matrix4 } from './math.js';
import { Sphere, Plane, Triangle, Material, Scene, Light } from './geometry.js';

export class RIBParser {
    constructor() {
        this.scene = new Scene();
        this.scene.backgroundColor = new Color(0.1, 0.1, 0.2); // Set a dark blue background
        this.transformStack = [new Matrix4()];
        this.currentMaterial = new Material();
        this.currentColor = new Color(0.5, 0.5, 0.5); // Default white color
    }

    parse(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
        
        for (const line of lines) {
            this.parseLine(line);
        }
        
        return this.scene;
    }

    parseLine(line) {
        const tokens = this.tokenize(line);
        if (tokens.length === 0) return;

        const command = tokens[0];
        const args = tokens.slice(1);

        switch (command) {
            case 'AttributeBegin':
                this.pushTransform();
                break;
                
            case 'AttributeEnd':
                this.popTransform();
                break;
                
            case 'TransformBegin':
                this.pushTransform();
                break;
                
            case 'TransformEnd':
                this.popTransform();
                break;
                
            case 'Translate':
                this.translate(args);
                break;
                
            case 'Rotate':
                this.rotate(args);
                break;
                
            case 'Scale':
                this.scale(args);
                break;
                
            case 'Color':
                this.setColor(args);
                break;
                
            case 'Surface':
                this.setSurface(args);
                break;
                
            case 'Sphere':
                this.addSphere(args);
                break;
                
            case 'Polygon':
                this.addPolygon(args);
                break;
                
            case 'PointsPolygons':
                this.addPointsPolygons(args);
                break;
                
            case 'LightSource':
                this.addLightSource(args);
                break;
                
            case 'WorldBegin':
            case 'WorldEnd':
            case 'FrameBegin':
            case 'FrameEnd':
                break;
                
            case 'Format':
                break;
                
            case 'Projection':
                break;
                
            case 'ConcatTransform':
                this.concatTransform(args);
                break;
                
            default:
                console.warn(`Unknown RIB command: ${command}`);
        }
    }

    tokenize(line) {
        const tokens = [];
        let current = '';
        let inQuotes = false;
        let inBrackets = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && !inBrackets) {
                inQuotes = !inQuotes;
                if (!inQuotes && current) {
                    tokens.push(current);
                    current = '';
                }
            } else if (char === '[' && !inQuotes) {
                inBrackets = true;
                current += char;
            } else if (char === ']' && !inQuotes) {
                inBrackets = false;
                current += char;
            } else if ((char === ' ' || char === '\t') && !inQuotes && !inBrackets) {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current) {
            tokens.push(current);
        }
        
        return tokens;
    }

    pushTransform() {
        const current = this.transformStack[this.transformStack.length - 1];
        const newTransform = new Matrix4();
        Object.assign(newTransform.m, current.m);
        this.transformStack.push(newTransform);
    }

    popTransform() {
        if (this.transformStack.length > 1) {
            this.transformStack.pop();
        }
    }

    getCurrentTransform() {
        return this.transformStack[this.transformStack.length - 1];
    }

    translate(args) {
        const [x, y, z] = args.map(parseFloat);
        this.getCurrentTransform().translate(x, y, z);
    }

    rotate(args) {
        const [angle, x, y, z] = args.map(parseFloat);
        const radians = angle * Math.PI / 180;
        const transform = this.getCurrentTransform();
        
        if (Math.abs(x - 1) < 1e-6 && Math.abs(y) < 1e-6 && Math.abs(z) < 1e-6) {
            transform.rotateX(radians);
        } else if (Math.abs(y - 1) < 1e-6 && Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) {
            transform.rotateY(radians);
        }
    }

    scale(args) {
        const [sx, sy, sz] = args.map(parseFloat);
        this.getCurrentTransform().scale(sx, sy, sz);
    }

    setColor(args) {
        let r, g, b;
        
        if (args.length === 1 && args[0].startsWith('[') && args[0].endsWith(']')) {
            // Parse array format like "[0.8 0.2 0.2]"
            const values = args[0].slice(1, -1).split(/\s+/).map(parseFloat);
            [r, g, b] = values;
        } else {
            // Parse individual arguments
            [r, g, b] = args.map(parseFloat);
        }
        
        this.currentColor = new Color(r, g, b);
        this.currentMaterial.color = this.currentColor;
    }

    setSurface(args) {
        const surfaceName = args[0].replace(/"/g, '');
        
        switch (surfaceName) {
            case 'plastic':
                this.currentMaterial = new Material(
                    this.currentColor,
                    0.1, 0.7, 0.2, 32, 0
                );
                break;
            case 'metal':
                this.currentMaterial = new Material(
                    this.currentColor,
                    0.05, 0.3, 0.9, 128, 0.8
                );
                break;
            case 'matte':
                this.currentMaterial = new Material(
                    this.currentColor,
                    0.2, 0.8, 0.0, 1, 0
                );
                break;
            default:
                break;
        }
    }

    addSphere(args) {
        const radius = parseFloat(args[0]);
        const zmin = args.length > 1 ? parseFloat(args[1]) : -radius;
        const zmax = args.length > 2 ? parseFloat(args[2]) : radius;
        const thetamax = args.length > 3 ? parseFloat(args[3]) : 360;
        
        const center = this.getCurrentTransform().transformPoint(new Vec3(0, 0, 0));
        const sphere = new Sphere(center, radius, new Material(
            this.currentColor,
            this.currentMaterial.ambient,
            this.currentMaterial.diffuse,
            this.currentMaterial.specular,
            this.currentMaterial.shininess,
            this.currentMaterial.reflectivity
        ));
        
        this.scene.add(sphere);
    }

    addPolygon(args) {
        const vertices = this.parseVertexList(args);
        if (vertices.length >= 3) {
            const transform = this.getCurrentTransform();
            const transformedVertices = vertices.map(v => transform.transformPoint(v));
            
            for (let i = 1; i < transformedVertices.length - 1; i++) {
                const triangle = new Triangle(
                    transformedVertices[0],
                    transformedVertices[i],
                    transformedVertices[i + 1],
                    new Material(
                        this.currentColor,
                        this.currentMaterial.ambient,
                        this.currentMaterial.diffuse,
                        this.currentMaterial.specular,
                        this.currentMaterial.shininess,
                        this.currentMaterial.reflectivity
                    )
                );
                this.scene.add(triangle);
            }
        }
    }

    addPointsPolygons(args) {
        console.warn('PointsPolygons not fully implemented');
    }

    addLightSource(args) {
        const lightType = args[0].replace(/"/g, '');
        
        if (lightType === 'distantlight') {
            // For distant light, use a position far away in the light direction
            const position = new Vec3(10, 10, 10);
            const light = new Light(position, new Color(1, 1, 1), 1);
            this.scene.addLight(light);
        } else if (lightType === 'pointlight') {
            const position = this.getCurrentTransform().transformPoint(new Vec3(0, 0, 0));
            const light = new Light(position, new Color(1, 1, 1), 1);
            this.scene.addLight(light);
        }
    }

    concatTransform(args) {
        const matrix = this.parseMatrix(args[0]);
        console.warn('ConcatTransform not fully implemented');
    }

    parseVertexList(args) {
        const vertices = [];
        
        for (let i = 0; i < args.length; i += 3) {
            if (i + 2 < args.length) {
                vertices.push(new Vec3(
                    parseFloat(args[i]),
                    parseFloat(args[i + 1]),
                    parseFloat(args[i + 2])
                ));
            }
        }
        
        return vertices;
    }

    parseMatrix(matrixString) {
        const cleaned = matrixString.replace(/[\[\]]/g, '');
        return cleaned.split(/\s+/).map(parseFloat);
    }
}