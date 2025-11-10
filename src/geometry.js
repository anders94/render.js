import { Vec3, Color } from './math.js';

export class Material {
    constructor(color = new Color(0.5, 0.5, 0.5), ambient = 0.1, diffuse = 0.7, specular = 0.2, shininess = 32, reflectivity = 0) {
        this.color = color;
        this.ambient = ambient;
        this.diffuse = diffuse;
        this.specular = specular;
        this.shininess = shininess;
        this.reflectivity = reflectivity;
    }
}

export class HitRecord {
    constructor() {
        this.t = 0;
        this.point = new Vec3();
        this.normal = new Vec3();
        this.material = new Material();
        this.frontFace = true;
    }

    setFaceNormal(ray, outwardNormal) {
        this.frontFace = ray.direction.dot(outwardNormal) < 0;
        this.normal = this.frontFace ? outwardNormal : outwardNormal.negate();
    }
}

export class Sphere {
    constructor(center, radius, material = new Material()) {
        this.center = center;
        this.radius = radius;
        this.material = material;
    }

    intersect(ray, tMin, tMax, hitRecord) {
        const oc = ray.origin.subtract(this.center);
        const a = ray.direction.dot(ray.direction);
        const b = 2 * oc.dot(ray.direction);
        const c = oc.dot(oc) - this.radius * this.radius;
        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) return false;

        const sqrtD = Math.sqrt(discriminant);
        let root = (-b - sqrtD) / (2 * a);

        if (root < tMin || root > tMax) {
            root = (-b + sqrtD) / (2 * a);
            if (root < tMin || root > tMax) {
                return false;
            }
        }

        hitRecord.t = root;
        hitRecord.point = ray.at(root);
        const outwardNormal = hitRecord.point.subtract(this.center).multiply(1 / this.radius);
        hitRecord.setFaceNormal(ray, outwardNormal);
        hitRecord.material = this.material;
        return true;
    }
}

export class Plane {
    constructor(point, normal, material = new Material()) {
        this.point = point;
        this.normal = normal.normalize();
        this.material = material;
    }

    intersect(ray, tMin, tMax, hitRecord) {
        const denom = this.normal.dot(ray.direction);
        if (Math.abs(denom) < 1e-8) return false;

        const t = this.point.subtract(ray.origin).dot(this.normal) / denom;
        if (t < tMin || t > tMax) return false;

        hitRecord.t = t;
        hitRecord.point = ray.at(t);
        hitRecord.setFaceNormal(ray, this.normal);
        hitRecord.material = this.material;
        return true;
    }
}

export class Triangle {
    constructor(v0, v1, v2, material = new Material()) {
        this.v0 = v0;
        this.v1 = v1;
        this.v2 = v2;
        this.material = material;
        this.normal = v1.subtract(v0).cross(v2.subtract(v0)).normalize();
    }

    intersect(ray, tMin, tMax, hitRecord) {
        const edge1 = this.v1.subtract(this.v0);
        const edge2 = this.v2.subtract(this.v0);
        const h = ray.direction.cross(edge2);
        const a = edge1.dot(h);

        if (a > -1e-8 && a < 1e-8) return false;

        const f = 1 / a;
        const s = ray.origin.subtract(this.v0);
        const u = f * s.dot(h);

        if (u < 0 || u > 1) return false;

        const q = s.cross(edge1);
        const v = f * ray.direction.dot(q);

        if (v < 0 || u + v > 1) return false;

        const t = f * edge2.dot(q);

        if (t < tMin || t > tMax) return false;

        hitRecord.t = t;
        hitRecord.point = ray.at(t);
        hitRecord.setFaceNormal(ray, this.normal);
        hitRecord.material = this.material;
        return true;
    }
}

export class Scene {
    constructor() {
        this.objects = [];
        this.lights = [];
        this.backgroundColor = new Color(0, 0, 0);
    }

    add(object) {
        this.objects.push(object);
    }

    addLight(light) {
        this.lights.push(light);
    }

    intersect(ray, tMin = 0.001, tMax = Infinity) {
        const hitRecord = new HitRecord();
        let hasHit = false;
        let closestSoFar = tMax;


        for (const object of this.objects) {
            const tempRecord = new HitRecord();
            if (object.intersect(ray, tMin, closestSoFar, tempRecord)) {
                hasHit = true;
                closestSoFar = tempRecord.t;
                Object.assign(hitRecord, tempRecord);
            }
        }

        return hasHit ? hitRecord : null;
    }
}

export class Light {
    constructor(position, color = new Color(1, 1, 1), intensity = 1) {
        this.position = position;
        this.color = color;
        this.intensity = intensity;
    }
}

// NURBS Surface Implementation
export class NURBSSurface {
    constructor(controlPoints, weights, uKnots, vKnots, uDegree, vDegree, material = new Material()) {
        this.controlPoints = controlPoints; // 2D array of Vec3 points
        this.weights = weights;             // 2D array of weight values
        this.uKnots = uKnots;              // Knot vector for u direction
        this.vKnots = vKnots;              // Knot vector for v direction
        this.uDegree = uDegree;            // Polynomial degree in u
        this.vDegree = vDegree;            // Polynomial degree in v
        this.material = material;
        
        this.uCount = controlPoints.length;
        this.vCount = controlPoints[0].length;
        
        // Validate the surface
        if (!this.validate()) {
            throw new Error('Invalid NURBS surface parameters');
        }
        
        // Precompute bounding box for fast culling
        this.boundingBox = this.computeBoundingBox();
        
        // Tessellate the NURBS surface into triangles for reliable intersection
        this.tessellate();
    }
    
    validate() {
        const expectedUKnots = this.uCount + this.uDegree + 1;
        const expectedVKnots = this.vCount + this.vDegree + 1;
        
        return this.uKnots.length === expectedUKnots && 
               this.vKnots.length === expectedVKnots;
    }
    
    computeBoundingBox() {
        let min = new Vec3(Infinity, Infinity, Infinity);
        let max = new Vec3(-Infinity, -Infinity, -Infinity);
        
        for (let i = 0; i < this.uCount; i++) {
            for (let j = 0; j < this.vCount; j++) {
                const point = this.controlPoints[i][j];
                min.x = Math.min(min.x, point.x);
                min.y = Math.min(min.y, point.y);
                min.z = Math.min(min.z, point.z);
                max.x = Math.max(max.x, point.x);
                max.y = Math.max(max.y, point.y);
                max.z = Math.max(max.z, point.z);
            }
        }
        
        // Ensure bounding box has non-zero volume by adding small epsilon for flat surfaces
        const epsilon = 0.001;
        if (Math.abs(max.x - min.x) < epsilon) {
            min.x -= epsilon;
            max.x += epsilon;
        }
        if (Math.abs(max.y - min.y) < epsilon) {
            min.y -= epsilon;
            max.y += epsilon;
        }
        if (Math.abs(max.z - min.z) < epsilon) {
            min.z -= epsilon;
            max.z += epsilon;
        }
        
        return { min, max };
    }
    
    // Tessellate NURBS surface into triangles for intersection testing
    tessellate() {
        const resolution = 15; // Good resolution for smooth surfaces
        this.triangles = [];
        
        // Generate a grid of points on the NURBS surface
        const points = [];
        
        for (let i = 0; i <= resolution; i++) {
            points[i] = [];
            for (let j = 0; j <= resolution; j++) {
                const u = i / resolution;
                const v = j / resolution;
                
                points[i][j] = this.evaluatePoint(u, v);
            }
        }
        
        // Create triangles from the grid
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                // Create two triangles for each quad
                const p00 = points[i][j];
                const p10 = points[i+1][j];
                const p01 = points[i][j+1];
                const p11 = points[i+1][j+1];
                
                
                // Triangle 1: (i,j), (i,j+1), (i+1,j) - counter-clockwise for forward-facing
                const tri1 = new Triangle(p00, p01, p10, this.material);
                this.triangles.push(tri1);
                
                // Triangle 2: (i+1,j), (i,j+1), (i+1,j+1) - counter-clockwise for forward-facing  
                const tri2 = new Triangle(p10, p01, p11, this.material);
                this.triangles.push(tri2);
            }
        }
        
        
    }
    
    // Find the knot span for a parameter value
    findKnotSpan(u, knots, degree) {
        const n = knots.length - degree - 2;
        
        if (u >= knots[n + 1]) return n;
        if (u <= knots[degree]) return degree;
        
        let low = degree;
        let high = n + 1;
        let mid = Math.floor((low + high) / 2);
        
        while (u < knots[mid] || u >= knots[mid + 1]) {
            if (u < knots[mid]) {
                high = mid;
            } else {
                low = mid;
            }
            mid = Math.floor((low + high) / 2);
        }
        
        return mid;
    }
    
    // Compute B-spline basis functions using Cox-de Boor recursion
    computeBasisFunctions(span, u, knots, degree) {
        const basis = new Array(degree + 1);
        const left = new Array(degree + 1);
        const right = new Array(degree + 1);
        
        basis[0] = 1.0;
        
        for (let j = 1; j <= degree; j++) {
            left[j] = u - knots[span + 1 - j];
            right[j] = knots[span + j] - u;
            let saved = 0.0;
            
            for (let r = 0; r < j; r++) {
                const temp = basis[r] / (right[r + 1] + left[j - r]);
                basis[r] = saved + right[r + 1] * temp;
                saved = left[j - r] * temp;
            }
            basis[j] = saved;
        }
        
        return basis;
    }
    
    // Compute B-spline basis function derivatives
    computeBasisDerivatives(span, u, knots, degree, derivOrder) {
        const ndu = Array(degree + 1).fill(null).map(() => Array(degree + 1).fill(0));
        const left = new Array(degree + 1);
        const right = new Array(degree + 1);
        
        ndu[0][0] = 1.0;
        
        for (let j = 1; j <= degree; j++) {
            left[j] = u - knots[span + 1 - j];
            right[j] = knots[span + j] - u;
            let saved = 0.0;
            
            for (let r = 0; r < j; r++) {
                ndu[j][r] = right[r + 1] + left[j - r];
                const temp = ndu[r][j - 1] / ndu[j][r];
                ndu[r][j] = saved + right[r + 1] * temp;
                saved = left[j - r] * temp;
            }
            ndu[j][j] = saved;
        }
        
        const ders = Array(derivOrder + 1).fill(null).map(() => Array(degree + 1).fill(0));
        
        for (let j = 0; j <= degree; j++) {
            ders[0][j] = ndu[j][degree];
        }
        
        // Compute derivatives
        for (let r = 0; r <= degree; r++) {
            let s1 = 0, s2 = 1;
            const a = Array(2).fill(null).map(() => Array(degree + 1).fill(0));
            a[0][0] = 1.0;
            
            for (let k = 1; k <= derivOrder; k++) {
                let d = 0.0;
                const rk = r - k;
                const pk = degree - k;
                
                if (r >= k) {
                    a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
                    d = a[s2][0] * ndu[rk][pk];
                }
                
                const j1 = rk >= -1 ? 1 : -rk;
                const j2 = (r - 1 <= pk) ? k - 1 : degree - r;
                
                for (let j = j1; j <= j2; j++) {
                    a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
                    d += a[s2][j] * ndu[rk + j][pk];
                }
                
                if (r <= pk) {
                    a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
                    d += a[s2][k] * ndu[r][pk];
                }
                
                ders[k][r] = d;
                const temp = s1; s1 = s2; s2 = temp;
            }
        }
        
        let r = degree;
        for (let k = 1; k <= derivOrder; k++) {
            for (let j = 0; j <= degree; j++) {
                ders[k][j] *= r;
            }
            r *= (degree - k);
        }
        
        return ders;
    }
    
    // Evaluate NURBS surface at parameter coordinates (u, v)
    evaluatePoint(u, v) {
        // Clamp parameters to valid range
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));
        
        // Find knot spans
        const uSpan = this.findKnotSpan(u, this.uKnots, this.uDegree);
        const vSpan = this.findKnotSpan(v, this.vKnots, this.vDegree);
        
        // Compute basis functions
        const uBasis = this.computeBasisFunctions(uSpan, u, this.uKnots, this.uDegree);
        const vBasis = this.computeBasisFunctions(vSpan, v, this.vKnots, this.vDegree);
        
        // Evaluate surface point using rational formula
        let numerator = new Vec3(0, 0, 0);
        let denominator = 0;
        
        for (let i = 0; i <= this.uDegree; i++) {
            for (let j = 0; j <= this.vDegree; j++) {
                const uIndex = uSpan - this.uDegree + i;
                const vIndex = vSpan - this.vDegree + j;
                
                if (uIndex >= 0 && uIndex < this.uCount && vIndex >= 0 && vIndex < this.vCount) {
                    const weight = this.weights[uIndex][vIndex];
                    const point = this.controlPoints[uIndex][vIndex];
                    const basisValue = uBasis[i] * vBasis[j] * weight;
                    
                    numerator = numerator.add(point.multiply(basisValue));
                    denominator += basisValue;
                }
            }
        }
        
        if (Math.abs(denominator) < 1e-10) {
            return new Vec3(0, 0, 0);
        }
        
        return numerator.multiply(1 / denominator);
    }
    
    // Compute surface normal at parameter coordinates (u, v)
    computeNormal(u, v) {
        const epsilon = 1e-6;
        
        // Compute partial derivatives using finite differences
        const point = this.evaluatePoint(u, v);
        
        let Su, Sv;
        
        if (u < 1 - epsilon) {
            Su = this.evaluatePoint(u + epsilon, v).subtract(point).multiply(1 / epsilon);
        } else {
            Su = point.subtract(this.evaluatePoint(u - epsilon, v)).multiply(1 / epsilon);
        }
        
        if (v < 1 - epsilon) {
            Sv = this.evaluatePoint(u, v + epsilon).subtract(point).multiply(1 / epsilon);
        } else {
            Sv = point.subtract(this.evaluatePoint(u, v - epsilon)).multiply(1 / epsilon);
        }
        
        // Cross product for normal vector
        const normal = Su.cross(Sv);
        
        if (normal.length() < 1e-10) {
            return new Vec3(0, 1, 0); // Fallback normal
        }
        
        return normal.normalize();
    }
    
    // Ray-bounding box intersection test
    intersectBoundingBox(ray, tMin, tMax) {
        const { min, max } = this.boundingBox;
        
        for (let i = 0; i < 3; i++) {
            const rayOrigin = i === 0 ? ray.origin.x : (i === 1 ? ray.origin.y : ray.origin.z);
            const rayDir = i === 0 ? ray.direction.x : (i === 1 ? ray.direction.y : ray.direction.z);
            const minVal = i === 0 ? min.x : (i === 1 ? min.y : min.z);
            const maxVal = i === 0 ? max.x : (i === 1 ? max.y : max.z);
            
            if (Math.abs(rayDir) < 1e-10) {
                if (rayOrigin < minVal || rayOrigin > maxVal) {
                    return false;
                }
            } else {
                const t1 = (minVal - rayOrigin) / rayDir;
                const t2 = (maxVal - rayOrigin) / rayDir;
                
                const tNear = Math.min(t1, t2);
                const tFar = Math.max(t1, t2);
                
                tMin = Math.max(tMin, tNear);
                tMax = Math.min(tMax, tFar);
                
                if (tMin > tMax) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Main ray intersection method using tessellated triangles
    intersect(ray, tMin, tMax, hitRecord) {
        // First, check bounding box intersection
        if (!this.intersectBoundingBox(ray, tMin, tMax)) {
            return false;
        }
        
        // Test intersection with tessellated triangles
        let hasHit = false;
        let closestT = tMax;
        let hitCount = 0;
        const tempRecord = new HitRecord();
        
        for (const triangle of this.triangles) {
            if (triangle.intersect(ray, tMin, closestT, tempRecord)) {
                hasHit = true;
                closestT = tempRecord.t;
                hitCount++;
                Object.assign(hitRecord, tempRecord);
            }
        }
        
        return hasHit;
    }
    
    // Newton-Raphson iteration for ray-surface intersection
    newtonRaphsonIntersection(ray, initialU, initialV, tMin, tMax) {
        const maxIterations = 20;
        const tolerance = 1e-6;
        
        let u = initialU;
        let v = initialV;
        let t = 1.0; // Initial ray parameter guess
        
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // Clamp parameters
            u = Math.max(0, Math.min(1, u));
            v = Math.max(0, Math.min(1, v));
            
            // Evaluate surface point and derivatives
            const surfacePoint = this.evaluatePoint(u, v);
            const rayPoint = ray.at(t);
            
            // Compute residual vector (difference between ray point and surface point)
            const residual = rayPoint.subtract(surfacePoint);
            
            // Check convergence
            if (residual.length() < tolerance && t >= tMin && t <= tMax) {
                return { u, v, t };
            }
            
            // Compute partial derivatives for Jacobian
            const epsilon = 1e-6;
            const Su = this.evaluatePoint(u + epsilon, v).subtract(surfacePoint).multiply(1 / epsilon);
            const Sv = this.evaluatePoint(u, v + epsilon).subtract(surfacePoint).multiply(1 / epsilon);
            
            // Set up linear system: J * delta = -residual
            // where J is the 3x3 Jacobian matrix [Su, Sv, rayDirection]
            const J = [
                [Su.x, Sv.x, ray.direction.x],
                [Su.y, Sv.y, ray.direction.y],
                [Su.z, Sv.z, ray.direction.z]
            ];
            
            const rhs = [-residual.x, -residual.y, -residual.z];
            
            // Solve 3x3 system using Cramer's rule
            const det = this.determinant3x3(J);
            
            if (Math.abs(det) < 1e-12) {
                break; // Singular matrix, try different initial guess
            }
            
            // Compute deltas
            const deltaU = this.determinant3x3([
                [rhs[0], J[0][1], J[0][2]],
                [rhs[1], J[1][1], J[1][2]],
                [rhs[2], J[2][1], J[2][2]]
            ]) / det;
            
            const deltaV = this.determinant3x3([
                [J[0][0], rhs[0], J[0][2]],
                [J[1][0], rhs[1], J[1][2]],
                [J[2][0], rhs[2], J[2][2]]
            ]) / det;
            
            const deltaT = this.determinant3x3([
                [J[0][0], J[0][1], rhs[0]],
                [J[1][0], J[1][1], rhs[1]],
                [J[2][0], J[2][1], rhs[2]]
            ]) / det;
            
            // Update parameters
            u += deltaU;
            v += deltaV;
            t += deltaT;
            
            // Check if ray parameter is out of bounds
            if (t < tMin || t > tMax) {
                break;
            }
        }
        
        return null; // No convergence
    }
    
    // Helper function to compute 3x3 determinant
    determinant3x3(matrix) {
        const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
        return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    }
    
    // Sampling-based intersection for NURBS surfaces (more reliable than Newton-Raphson)
    sampleBasedIntersection(ray, tMin, tMax, hitRecord) {
        const samples = 15; // Grid resolution
        const threshold = 0.1; // Distance threshold for considering an intersection
        let bestDistance = threshold;
        let bestT = tMax;
        let bestU = 0, bestV = 0;
        let foundIntersection = false;
        
        // Sample the surface in a grid and find closest approach to ray
        for (let i = 0; i <= samples; i++) {
            for (let j = 0; j <= samples; j++) {
                const u = i / samples;
                const v = j / samples;
                
                // Evaluate surface point
                const surfacePoint = this.evaluatePoint(u, v);
                
                // Find closest point on ray to surface point
                const rayToSurface = surfacePoint.subtract(ray.origin);
                const t = rayToSurface.dot(ray.direction) / ray.direction.dot(ray.direction);
                
                if (t < tMin || t >= tMax) continue;
                
                // Check distance between ray point and surface point
                const rayPoint = ray.at(t);
                const distance = rayPoint.subtract(surfacePoint).length();
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestT = t;
                    bestU = u;
                    bestV = v;
                    foundIntersection = true;
                }
            }
        }
        
        if (!foundIntersection) {
            return false;
        }
        
        // Fill hit record
        hitRecord.t = bestT;
        hitRecord.point = ray.at(bestT);
        hitRecord.normal = this.computeNormal(bestU, bestV);
        hitRecord.setFaceNormal(ray, hitRecord.normal);
        hitRecord.material = this.material;
        
        return true;
    }
}