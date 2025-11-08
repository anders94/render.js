#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

class TestRunner {
    constructor() {
        this.configPath = path.join(__dirname, 'test-config.json');
        this.rendererPath = path.join(projectRoot, 'src', 'renderer.js');
        this.config = null;
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
    }

    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log(`Loaded ${this.config.testCases.length} test cases from config`);
        } catch (error) {
            throw new Error(`Failed to load test config: ${error.message}`);
        }
    }

    ensureDirectories() {
        const dirs = [
            this.config.referenceDir,
            this.config.outputDir,
            this.config.tempDir
        ];
        
        dirs.forEach(dir => {
            const fullPath = path.join(projectRoot, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        });
    }

    async runRenderer(args) {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [this.rendererPath, ...args], {
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Renderer failed with exit code ${code}\\n${stderr}`));
                }
            });
        });
    }

    generateTestImageName(testCase, threadCount) {
        const parts = [testCase.name];
        if (threadCount) parts.push(`t${threadCount}`);
        if (testCase.antialiasing) parts.push(testCase.antialiasing);
        parts.push(`s${testCase.seed}`);
        return parts.join('-') + '.ppm';
    }

    async renderTestCase(testCase, threadCount = null) {
        const args = [
            '--rib', testCase.rib,
            '--seed', testCase.seed.toString(),
            '--width', testCase.width.toString(),
            '--height', testCase.height.toString()
        ];

        if (testCase.antialiasing) {
            args.push('--aa', testCase.antialiasing);
        } else if (testCase.samples) {
            args.push('--samples', testCase.samples.toString());
        }

        if (threadCount !== null) {
            args.push('--threads', threadCount.toString());
        }

        const outputName = this.generateTestImageName(testCase, threadCount);
        const outputPath = path.join(this.config.tempDir, outputName);
        args.push('--output', outputPath);

        try {
            const result = await this.runRenderer(args);
            return {
                success: true,
                outputPath,
                outputName,
                logs: result.stdout
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                outputPath,
                outputName
            };
        }
    }

    compareImages(file1, file2) {
        try {
            const data1 = fs.readFileSync(file1);
            const data2 = fs.readFileSync(file2);
            return data1.equals(data2);
        } catch (error) {
            console.error(`Error comparing images: ${error.message}`);
            return false;
        }
    }

    async generateReferenceImage(testCase) {
        console.log(`Generating reference image for ${testCase.name}...`);
        
        // Always generate reference with single thread for consistency
        const result = await this.renderTestCase(testCase, 1);
        
        if (!result.success) {
            throw new Error(`Failed to generate reference: ${result.error}`);
        }

        const referenceName = this.generateTestImageName(testCase, null);
        const referencePath = path.join(projectRoot, this.config.referenceDir, referenceName);
        const tempPath = path.join(projectRoot, result.outputPath);
        
        // Move temp file to reference directory
        fs.copyFileSync(tempPath, referencePath);
        console.log(`Reference image saved: ${referencePath}`);
        
        return referencePath;
    }

    async runSingleTest(testCase) {
        console.log(`\\n=== Running test: ${testCase.name} ===`);
        console.log(`Description: ${testCase.description}`);

        const testResult = {
            name: testCase.name,
            description: testCase.description,
            passed: true,
            failures: [],
            details: {}
        };

        // Check if reference image exists
        const referenceName = this.generateTestImageName(testCase, null);
        const referencePath = path.join(projectRoot, this.config.referenceDir, referenceName);
        
        if (!fs.existsSync(referencePath)) {
            console.log(`Reference image not found, generating...`);
            try {
                await this.generateReferenceImage(testCase);
            } catch (error) {
                testResult.passed = false;
                testResult.failures.push(`Failed to generate reference: ${error.message}`);
                return testResult;
            }
        }

        // Test each thread count
        const threadsToTest = testCase.threads || [1];
        
        for (const threadCount of threadsToTest) {
            console.log(`Testing with ${threadCount} thread(s)...`);
            
            const result = await this.renderTestCase(testCase, threadCount);
            const testName = `${threadCount}_threads`;
            
            if (!result.success) {
                testResult.passed = false;
                testResult.failures.push(`${testName}: Rendering failed - ${result.error}`);
                testResult.details[testName] = { status: 'render_failed', error: result.error };
                continue;
            }

            // Compare with reference
            const tempPath = path.join(projectRoot, result.outputPath);
            const isIdentical = this.compareImages(referencePath, tempPath);
            
            if (isIdentical) {
                console.log(`  ✓ ${threadCount} thread(s): PASS`);
                testResult.details[testName] = { status: 'pass' };
            } else {
                console.log(`  ✗ ${threadCount} thread(s): FAIL - Output differs from reference`);
                testResult.passed = false;
                testResult.failures.push(`${testName}: Output differs from reference image`);
                
                // Save failed output for inspection
                const failedOutputName = `FAILED_${result.outputName}`;
                const failedOutputPath = path.join(projectRoot, this.config.outputDir, failedOutputName);
                fs.copyFileSync(tempPath, failedOutputPath);
                
                testResult.details[testName] = { 
                    status: 'fail', 
                    savedOutput: failedOutputPath 
                };
            }
            
            // Clean up temp file
            try {
                fs.unlinkSync(tempPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        return testResult;
    }

    async runAllTests() {
        console.log('\\n🚀 Starting raytracer test suite\\n');
        
        this.loadConfig();
        this.ensureDirectories();

        for (const testCase of this.config.testCases) {
            const result = await this.runSingleTest(testCase);
            this.results.details.push(result);
            this.results.total++;
            
            if (result.passed) {
                this.results.passed++;
            } else {
                this.results.failed++;
            }
        }

        this.printSummary();
        return this.results.failed === 0;
    }

    printSummary() {
        console.log('\\n' + '='.repeat(60));
        console.log('🧪 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total tests: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed} ✓`);
        console.log(`Failed: ${this.results.failed} ✗`);
        console.log(`Success rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

        if (this.results.failed > 0) {
            console.log('\\n📋 FAILED TESTS:');
            this.results.details.forEach(result => {
                if (!result.passed) {
                    console.log(`\\n❌ ${result.name}:`);
                    result.failures.forEach(failure => {
                        console.log(`   • ${failure}`);
                    });
                }
            });
        }

        console.log('\\n' + '='.repeat(60));
    }

    async generateAllReferences() {
        console.log('\\n🔄 Generating all reference images\\n');
        
        this.loadConfig();
        this.ensureDirectories();

        for (const testCase of this.config.testCases) {
            try {
                await this.generateReferenceImage(testCase);
            } catch (error) {
                console.error(`Failed to generate reference for ${testCase.name}: ${error.message}`);
            }
        }
        
        console.log('\\n✅ Reference generation complete');
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const testRunner = new TestRunner();

    if (args.includes('--generate-references')) {
        await testRunner.generateAllReferences();
        return;
    }

    if (args.includes('--help')) {
        console.log(`
Raytracer Test Runner

Usage:
  node test-runner.js                 Run all tests
  node test-runner.js --generate-references   Generate reference images
  node test-runner.js --help          Show this help

The test runner will:
1. Load test configuration from test-config.json
2. Generate reference images if they don't exist
3. Run rendering tests with different thread counts
4. Compare outputs with reference images bit-for-bit
5. Report results and save failed outputs for inspection
        `);
        return;
    }

    const success = await testRunner.runAllTests();
    process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Test runner failed:', error.message);
        process.exit(1);
    });
}