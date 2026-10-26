// Renders public/icon.svg into the PNG install icons (so the repo stays text-only).
import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
const svg = readFileSync('public/icon.svg')
mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
  const pad = Math.round(size * 0.1)
  await sharp(svg, { density: 300 }).resize(size - pad * 2, size - pad * 2)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: process.env.ICON_BG || '#1c3d32' })
    .png().toFile(`public/icons/icon-maskable-${size}.png`)
}
console.log('icons ok')
