# Raytracer Testing Framework

This testing framework validates the raytracer's output by comparing rendered images against reference images using deterministic seeds.

## Features

- **Bit-for-bit comparison** of rendered images with reference images
- **Multi-threading validation** ensures single and multi-threaded renders are identical
- **Deterministic seeding** for reproducible test results
- **Automatic reference generation** when references don't exist
- **Comprehensive reporting** with detailed failure analysis
- **Image analysis tools** for debugging differences

## Quick Start

```bash
# Run all tests
node tests/test-runner.js

# Generate reference images
node tests/test-runner.js --generate-references

# Compare two images manually
node tests/image-diff.js image1.ppm image2.ppm
```

## Test Configuration

Tests are configured in `test-config.json`:

```json
{
  "testCases": [
    {
      "name": "basic-spheres",
      "description": "Basic sphere rendering test", 
      "rib": "examples/spheres.rib",
      "seed": 42,
      "width": 400,
      "height": 300,
      "samples": 1,
      "threads": [1, 2, 4]
    }
  ]
}
```

### Test Case Properties

- `name`: Unique identifier for the test
- `description`: Human-readable description
- `rib`: Path to RIB file (relative to project root)
- `seed`: Deterministic seed for reproducible results
- `width`/`height`: Image dimensions
- `samples`: Samples per pixel (optional, overridden by antialiasing)
- `antialiasing`: Quality level (none/low/medium/high/ultra) - optional
- `threads`: Array of thread counts to test

## Directory Structure

```
tests/
├── test-config.json      # Test configuration
├── test-runner.js        # Main test runner
├── image-diff.js         # Image comparison utility
├── references/           # Reference images
├── output/               # Failed test outputs
└── temp/                 # Temporary files (auto-cleaned)
```

## How Tests Work

1. **Reference Generation**: If a reference image doesn't exist, it's generated using single-threaded rendering with the specified seed
2. **Multi-threading Test**: Each specified thread count is tested against the reference
3. **Bit-for-bit Comparison**: Images must be identical at the byte level
4. **Failure Analysis**: Failed outputs are saved with detailed difference reports

## Test Results

### Passing Test
```
=== Running test: basic-spheres ===
Description: Basic sphere rendering test
Testing with 1 thread(s)...
  ✓ 1 thread(s): PASS
Testing with 2 thread(s)...
  ✓ 2 thread(s): PASS
```

### Failing Test
```
=== Running test: basic-spheres ===
Testing with 2 thread(s)...
  ✗ 2 thread(s): FAIL - Output differs from reference
```

Failed outputs are saved to `tests/output/FAILED_*.ppm` for manual inspection.

## Adding New Tests

1. Add a new test case to `test-config.json`
2. Run `node tests/test-runner.js --generate-references` to create the reference
3. Run `node tests/test-runner.js` to validate

## Debugging Test Failures

When tests fail:

1. Check the saved output in `tests/output/FAILED_*.ppm`
2. Use `node tests/image-diff.js reference.ppm failed.ppm` for detailed analysis
3. Verify the test parameters match the reference generation
4. Check if recent code changes affected rendering

## CI Integration

The test runner exits with code 0 on success, 1 on failure:

```bash
# In CI/CD pipeline
node tests/test-runner.js
if [ $? -ne 0 ]; then
  echo "Tests failed!"
  exit 1
fi
```

## Performance Testing

Use larger image dimensions and higher thread counts to test performance:

```json
{
  "name": "performance-test",
  "width": 1920,
  "height": 1080, 
  "antialiasing": "high",
  "threads": [1, 2, 4, 8, 16]
}
```

## Troubleshooting

**"Reference image not found"**: Run with `--generate-references` flag

**"Rendering failed"**: Check that RIB files exist and renderer works manually

**"Output differs from reference"**: Use `image-diff.js` to analyze the differences

**Tests are slow**: Reduce image dimensions or use fewer samples for faster iteration