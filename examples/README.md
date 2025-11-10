# RenderMan RIB Example Scenes

This directory contains clean, well-structured example scenes demonstrating various features of the render.js raytracer.

## Basic Examples

### `simple.rib`
Multi-sphere scene showcasing different material types (plastic, matte, metal) with proper lighting setup and ground plane. Good starting point for understanding RIB file structure.

### `spheres.rib`  
Four-sphere composition demonstrating sphere positioning, different materials, and lighting. Shows red plastic, green matte, blue metallic, and yellow plastic spheres.

## Advanced Sphere Scenes

### `complex_scene.rib`
Sophisticated multi-sphere composition featuring:
- Central metallic sphere with transformations
- Ring of colored spheres using rotations 
- Multiple orbiting spheres at different heights
- Complex lighting with multiple light sources
- Ground plane and background elements

## NURBS Examples

### `nurbs_center.rib`
Simple NURBS surface example - a flat red NURBS patch positioned in the center of the scene. Demonstrates basic NURBS syntax and NuPatch command usage.

### `nurbs_simple.rib`
Advanced NURBS demonstration showing a curved shell/bowl shape with dramatic lighting, ground plane, and reference sphere for scale comparison.

### `nurbs_complex.rib`
Comprehensive NURBS showcase featuring multiple different NURBS surfaces with various shapes, materials, and positioning. Demonstrates the full capabilities of NURBS surface rendering.

## Usage

Render any example with:
```bash
node src/renderer.js --rib examples/[filename].rib
```

For higher quality output, use antialiasing:
```bash
node src/renderer.js --rib examples/[filename].rib --aa high --width 800 --height 600
```