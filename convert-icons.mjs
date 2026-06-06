import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('public/icons/icon-512.svg')

await sharp(Buffer.from(svg)).resize(192).png().toFile('public/icons/icon-192.png')
await sharp(Buffer.from(svg)).resize(512).png().toFile('public/icons/icon-512.png')

console.log('PNGs criados!')
