#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

class ImageDiff {
    static compareImages(file1, file2) {
        try {
            const data1 = fs.readFileSync(file1);
            const data2 = fs.readFileSync(file2);
            
            if (data1.length !== data2.length) {
                return {
                    identical: false,
                    reason: 'Different file sizes',
                    sizeDiff: data2.length - data1.length
                };
            }
            
            let differentBytes = 0;
            let firstDifferenceOffset = -1;
            
            for (let i = 0; i < data1.length; i++) {
                if (data1[i] !== data2[i]) {
                    if (firstDifferenceOffset === -1) {
                        firstDifferenceOffset = i;
                    }
                    differentBytes++;
                }
            }
            
            if (differentBytes === 0) {
                return { identical: true };
            }
            
            return {
                identical: false,
                reason: 'Pixel data differs',
                differentBytes,
                totalBytes: data1.length,
                differencePercent: (differentBytes / data1.length * 100).toFixed(2),
                firstDifferenceOffset
            };
            
        } catch (error) {
            return {
                identical: false,
                reason: `Error reading files: ${error.message}`,
                error: true
            };
        }
    }

    static parsePPMHeader(data) {
        const text = data.toString('ascii', 0, Math.min(200, data.length));
        const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        if (lines.length < 3) {
            throw new Error(`Invalid PPM header - not enough lines (found ${lines.length})`);
        }
        
        if (lines[0].trim() !== 'P3') {
            throw new Error(`Not a P3 PPM file, got: '${lines[0].trim()}'`);
        }
        
        const dimensionParts = lines[1].trim().split(/\s+/);
        if (dimensionParts.length !== 2) {
            throw new Error(`Invalid dimension line: '${lines[1].trim()}'`);
        }
        
        const width = parseInt(dimensionParts[0]);
        const height = parseInt(dimensionParts[1]);
        const maxVal = parseInt(lines[2].trim());
        
        if (isNaN(width) || isNaN(height) || isNaN(maxVal)) {
            throw new Error('Invalid numeric values in PPM header');
        }
        
        // Find the end of the header by looking for the pattern
        const headerLines = [lines[0], lines[1], lines[2]];
        const headerText = headerLines.join('\n') + '\n';
        const headerEnd = text.indexOf(headerText) + headerText.length;
        
        return { width, height, maxVal, headerEnd };
    }

    static analyzeImages(file1, file2) {
        try {
            console.log(`Analyzing images:`);
            console.log(`  File 1: ${file1}`);
            console.log(`  File 2: ${file2}`);
            
            const data1 = fs.readFileSync(file1);
            const data2 = fs.readFileSync(file2);
            
            // Parse PPM headers
            const header1 = this.parsePPMHeader(data1);
            const header2 = this.parsePPMHeader(data2);
            
            console.log(`\\nImage dimensions:`);
            console.log(`  File 1: ${header1.width}x${header1.height} (max: ${header1.maxVal})`);
            console.log(`  File 2: ${header2.width}x${header2.height} (max: ${header2.maxVal})`);
            
            if (header1.width !== header2.width || header1.height !== header2.height) {
                console.log(`❌ Different dimensions!`);
                return false;
            }
            
            const comparison = this.compareImages(file1, file2);
            
            if (comparison.identical) {
                console.log(`\\n✅ Images are identical!`);
                return true;
            } else {
                console.log(`\\n❌ Images differ:`);
                console.log(`  Reason: ${comparison.reason}`);
                if (comparison.differentBytes) {
                    console.log(`  Different bytes: ${comparison.differentBytes}/${comparison.totalBytes} (${comparison.differencePercent}%)`);
                    console.log(`  First difference at byte: ${comparison.firstDifferenceOffset}`);
                }
                return false;
            }
            
        } catch (error) {
            console.error(`Error analyzing images: ${error.message}`);
            return false;
        }
    }
}

// CLI interface
function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        console.log(`
Usage: node image-diff.js <image1> <image2>

Compares two PPM images and reports differences.
        `);
        process.exit(1);
    }
    
    const [file1, file2] = args;
    
    if (!fs.existsSync(file1)) {
        console.error(`File not found: ${file1}`);
        process.exit(1);
    }
    
    if (!fs.existsSync(file2)) {
        console.error(`File not found: ${file2}`);
        process.exit(1);
    }
    
    const identical = ImageDiff.analyzeImages(file1, file2);
    process.exit(identical ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { ImageDiff };