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