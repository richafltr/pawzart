#!/usr/bin/env node

/**
 * Security Comment Scrubber
 * Removes sensitive comments from source code before deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sourceDir = process.argv[2] || 'examples';
const outputDir = process.argv[3] || 'build-temp';

// Patterns to remove (security-sensitive terms)
const SENSITIVE_PATTERNS = [
  /\/\*.*?sensitive.*?\*\//gs,
  /\/\/.*?internal.*$/gm,
  /\/\*.*?confidential.*?\*\//gs,
  /\/\/.*?private.*$/gm,
  /\/\*.*?proprietary.*?\*\//gs,
  /\/\/.*?classified.*$/gm,
  /\/\*.*?theoretical.*?\*\//gs,
  /\/\/.*?research.*$/gm
];

/**
 * Recursively process directory
 * @param {string} dir - Directory path
 */
function processDirectory(dir) {
  const fullPath = path.join(process.cwd(), dir);
  const outputPath = path.join(process.cwd(), outputDir);
  
  // Create output directory
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  // Process files
  const files = fs.readdirSync(fullPath, { withFileTypes: true });
  
  for (const file of files) {
    const sourcePath = path.join(fullPath, file.name);
    const destPath = path.join(outputPath, file.name);
    
    if (file.isDirectory()) {
      // Recursively process subdirectories
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      processDirectory(path.join(dir, file.name));
    } else if (file.name.endsWith('.js') || file.name.endsWith('.mjs')) {
      // Process JavaScript files
      scrubFile(sourcePath, destPath);
    } else {
      // Copy other files as-is
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

/**
 * Scrub sensitive comments from file
 * @param {string} source - Source file path
 * @param {string} dest - Destination file path
 */
function scrubFile(source, dest) {
  let content = fs.readFileSync(source, 'utf8');
  
  // Apply each pattern
  for (const pattern of SENSITIVE_PATTERNS) {
    content = content.replace(pattern, '');
  }
  
  // Clean up extra whitespace
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Write scrubbed content
  fs.writeFileSync(dest, content);
  
  console.log(`✅ Scrubbed: ${source} -> ${dest}`);
}

// Main execution
try {
  console.log(`🔒 Scrubbing sensitive comments from ${sourceDir}...`);
  processDirectory(sourceDir);
  console.log('✅ Security scrubbing completed successfully!');
} catch (error) {
  console.error('❌ Security scrubbing failed:', error);
  process.exit(1);
} 