# Raytracing Renderer

A Node.js raytracing renderer with RenderMan RIB format support, implemented in pure JavaScript.

## Features

- **Pure JavaScript Implementation**: No external dependencies, runs entirely in Node.js
- **RenderMan RIB Support**: Parse and render RenderMan RIB format files
- **Core Raytracing**: Full raytracing pipeline with reflection support
- **Lighting Models**: Phong/Blinn-Phong shading with multiple light sources
- **Geometry Primitives**: Spheres, planes, and triangles
- **Material System**: Support for different surface materials (plastic, metal, matte)
- **PPM Image Output**: Generates standard PPM image files

## Installation

```bash
git clone https://github.com/anders94/render.js.git
cd render.js
npm install
```

## Usage

### Basic Usage (Default Scene)
```bash
npm start
# or
node src/renderer.js
```

### Render from RIB File
```bash
node src/renderer.js --rib examples/simple.rib
```

### Custom Resolution and Quality
```bash
# Using manual sample count
node src/renderer.js --width 800 --height 600 --samples 4 --output my_render.ppm

# Using quality presets (recommended)
node src/renderer.js --width 800 --height 600 --aa high --output my_render.ppm

# With custom gamma correction
node src/renderer.js --aa medium --gamma 1.8 --output linear.ppm
```

## Command Line Options

- `--rib <file>`: Render from RIB file
- `--width <number>`: Image width (default: 400)
- `--height <number>`: Image height (default: 300) 
- `--samples <number>`: Samples per pixel for anti-aliasing (default: 1)
- `--aa <quality>`: Antialiasing quality preset: none, low, medium, high, ultra
- `--gamma <number>`: Gamma correction value (default: 2.2)
- `--no-stratified`: Disable stratified sampling (use random sampling)
- `--output <file>`: Output filename (default: output.ppm)
- `--help`: Show help message

### Antialiasing Quality Levels

- `none`: No antialiasing (1 sample per pixel) - fastest
- `low`: Light antialiasing (4 samples per pixel) - good performance
- `medium`: Good quality (9 samples per pixel) - balanced quality/speed
- `high`: High quality (16 samples per pixel) - better quality
- `ultra`: Maximum quality (25 samples per pixel) - best quality

## RIB Format Support

The renderer supports a subset of RenderMan RIB commands:

### Supported Commands
- `WorldBegin` / `WorldEnd`
- `AttributeBegin` / `AttributeEnd`
- `TransformBegin` / `TransformEnd`
- `Translate x y z`
- `Rotate angle x y z`
- `Scale sx sy sz`
- `Color [r g b]`
- `Surface "material"`
- `Sphere radius zmin zmax thetamax`
- `Polygon` (converted to triangles)
- `LightSource "type"`

### Supported Surface Materials
- `plastic`: Standard plastic material with moderate reflection
- `metal`: Highly reflective metallic material
- `matte`: Non-reflective diffuse material

## Architecture

The renderer is built with a modular architecture:

- **math.js**: Vector math, matrices, rays, and color utilities
- **geometry.js**: Geometric primitives and scene management
- **rib-parser.js**: RenderMan RIB file parser
- **raytracer.js**: Core raytracing engine and camera system
- **image-output.js**: Image file generation (PPM format)
- **renderer.js**: Main application and command-line interface

## Example RIB File

```rib
##RenderMan RIB-Structure 1.1
version 3.03

Format 400 300 1
Projection "perspective" "fov" [45]

WorldBegin

LightSource "distantlight" 1 "from" [1 1 1] "to" [0 0 0]

AttributeBegin
Color [0.8 0.2 0.2]
Surface "plastic"
Sphere 0.5 -0.5 0.5 360
AttributeEnd

WorldEnd
```

## Performance Notes

- Rendering time increases significantly with resolution and sample count
- The renderer is single-threaded; consider using lower resolutions for testing
- **Antialiasing Options:**
  - `--aa none`: Fastest, aliased edges
  - `--aa low`: 4x slower than none, removes most aliasing
  - `--aa medium`: 9x slower, good quality for most scenes
  - `--aa high`: 16x slower, high quality for final renders
  - `--aa ultra`: 25x slower, maximum quality
- **Stratified vs Random Sampling:**
  - Stratified sampling (default) provides better quality and more even noise distribution
  - Random sampling (`--no-stratified`) may be faster but with more noise

## Viewing Output

PPM files can be viewed with most image viewers or converted to other formats:

```bash
# Convert to PNG using ImageMagick
convert output.ppm output.png

# View directly (on macOS)
open output.ppm
```
