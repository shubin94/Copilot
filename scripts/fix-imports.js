import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..', 'server');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Remove .js extensions from imports
  content = content.replace(/from\s+(['"])(\.\.?\/.+?)\.js\1/g, 'from $1$2$1');
  content = content.replace(/import\s+(['"])(\.\.?\/.+?)\.js\1/g, 'import $1$2$1');
  content = content.replace(/await import\s*\(\s*(['"])(\.\.?\/.+?)\.js\1\s*\)/g, 'await import($1$2$1)');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
      processFile(filePath);
    }
  }
}

walkDir(serverDir);
console.log('Import fixing complete!');
