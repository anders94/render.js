export class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(v) {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    subtract(v) {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    multiply(scalar) {
        return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalize() {
        const len = this.length();
        return len > 0 ? new Vec3(this.x / len, this.y / len, this.z / len) : new Vec3();
    }

    negate() {
        return new Vec3(-this.x, -this.y, -this.z);
    }

    reflect(normal) {
        return this.subtract(normal.multiply(2 * this.dot(normal)));
    }
}

export class Matrix4 {
    constructor() {
        this.m = new Array(16).fill(0);
        this.identity();
    }

    identity() {
        this.m.fill(0);
        this.m[0] = this.m[5] = this.m[10] = this.m[15] = 1;
        return this;
    }

    translate(x, y, z) {
        this.m[12] += x;
        this.m[13] += y;
        this.m[14] += z;
        return this;
    }

    rotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const m5 = this.m[5], m6 = this.m[6], m9 = this.m[9], m10 = this.m[10];
        this.m[5] = m5 * c + m9 * s;
        this.m[6] = m6 * c + m10 * s;
        this.m[9] = m9 * c - m5 * s;
        this.m[10] = m10 * c - m6 * s;
        return this;
    }

    rotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const m0 = this.m[0], m2 = this.m[2], m8 = this.m[8], m10 = this.m[10];
        this.m[0] = m0 * c - m8 * s;
        this.m[2] = m2 * c - m10 * s;
        this.m[8] = m0 * s + m8 * c;
        this.m[10] = m2 * s + m10 * c;
        return this;
    }

    scale(sx, sy, sz) {
        this.m[0] *= sx;
        this.m[5] *= sy;
        this.m[10] *= sz;
        return this;
    }

    transformPoint(point) {
        const x = point.x, y = point.y, z = point.z;
        return new Vec3(
            this.m[0] * x + this.m[4] * y + this.m[8] * z + this.m[12],
            this.m[1] * x + this.m[5] * y + this.m[9] * z + this.m[13],
            this.m[2] * x + this.m[6] * y + this.m[10] * z + this.m[14]
        );
    }

    transformDirection(dir) {
        return new Vec3(
            this.m[0] * dir.x + this.m[4] * dir.y + this.m[8] * dir.z,
            this.m[1] * dir.x + this.m[5] * dir.y + this.m[9] * dir.z,
            this.m[2] * dir.x + this.m[6] * dir.y + this.m[10] * dir.z
        );
    }
}

export class Ray {
    constructor(origin, direction, tMin = 0.001, tMax = Infinity) {
        this.origin = origin;
        this.direction = direction.normalize();
        this.tMin = tMin;
        this.tMax = tMax;
    }

    at(t) {
        return this.origin.add(this.direction.multiply(t));
    }
}

export class Color {
    constructor(r = 0, g = 0, b = 0) {
        this.r = Math.max(0, Math.min(1, r));
        this.g = Math.max(0, Math.min(1, g));
        this.b = Math.max(0, Math.min(1, b));
    }

    add(color) {
        return new Color(this.r + color.r, this.g + color.g, this.b + color.b);
    }

    multiply(scalar) {
        return new Color(this.r * scalar, this.g * scalar, this.b * scalar);
    }

    blend(color) {
        return new Color(this.r * color.r, this.g * color.g, this.b * color.b);
    }

    toRGB() {
        return {
            r: Math.floor(Math.max(0, Math.min(255, this.r * 255))),
            g: Math.floor(Math.max(0, Math.min(255, this.g * 255))),
            b: Math.floor(Math.max(0, Math.min(255, this.b * 255)))
        };
    }
}