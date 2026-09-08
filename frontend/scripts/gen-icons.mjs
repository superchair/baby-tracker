// Rasterizes src/assets/app-icon.svg (a baby-bottle glyph on a rounded blue
// square) into the PNG sizes needed for the PWA manifest and iOS home screen.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const SVG_PATH = fileURLToPath(new URL('../src/assets/app-icon.svg', import.meta.url));

const targets = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(SVG_PATH, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`Generated ${file} (${size}x${size})`);
}
