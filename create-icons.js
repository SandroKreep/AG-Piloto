import fs from 'fs';

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="32" fill="#ff6b00"/><text x="96" y="120" font-family="Arial" font-weight="bold" font-size="48" fill="white" text-anchor="middle">AG</text></svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="80" fill="#ff6b00"/><text x="256" y="310" font-family="Arial" font-weight="bold" font-size="128" fill="white" text-anchor="middle">AG</text></svg>`;

fs.writeFileSync('public/icons/icon-192.svg', svg192);
fs.writeFileSync('public/icons/icon-512.svg', svg512);
console.log('Ícones SVG criados em public/icons/');
