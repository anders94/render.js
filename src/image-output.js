import fs from 'fs';

export class ImageWriter {
    static writePPM(image, filename) {
        const height = image.length;
        const width = image[0].length;
        
        let ppmData = `P3\n${width} ${height}\n255\n`;
        
        for (const row of image) {
            for (const pixel of row) {
                const rgb = pixel.toRGB();
                ppmData += `${rgb.r} ${rgb.g} ${rgb.b} `;
            }
            ppmData += '\n';
        }
        
        fs.writeFileSync(filename, ppmData);
        console.log(`Image written to ${filename}`);
    }
    
    static writePNG(image, filename) {
        console.warn('PNG output not implemented. Use PPM format instead.');
    }
    
    static displayProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        const barLength = 50;
        const filledLength = Math.round((barLength * current) / total);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total})`);
        
        if (current === total) {
            console.log('\nRendering complete!');
        }
    }
}