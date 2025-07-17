/**
 * Comment Scrubbing Script
 * Removes comments longer than 60 characters from JS files
 * Part of security hardening for production builds
 * 
 * Usage: node scripts/scrubComments.js src/ dist/
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively walk directory tree
 * @param {string} dir - Directory path
 * @param {Function} fn - Callback for each file
 */
async function walk(dir, fn) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath, fn);
      } else if (entry.isFile()) {
        await fn(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${dir}:`, err.message);
  }
}

/**
 * Scrub comments from JavaScript file content
 * @param {string} content - File content
 * @returns {string} Scrubbed content
 */
function scrubContent(content) {
  // Remove multi-line comments > 60 chars
  content = content.replace(/\/\*[\s\S]{61,}?\*\//g, "/* */");
  
  // Remove single-line comments > 60 chars
  content = content.replace(/\/\/.{61,}$/gm, "//");
  
  // Remove JSDoc comments entirely (they tend to be long)
  content = content.replace(/\/\*\*[\s\S]*?\*\//g, "");
  
  return content;
}

/**
 * Main scrubbing function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error("Usage: node scrubComments.js <source_dir> <output_dir>");
    process.exit(1);
  }
  
  const [srcDir, outDir] = args;
  
  // Validate source directory
  try {
    await fs.access(srcDir);
  } catch {
    console.error(`Source directory '${srcDir}' does not exist`);
    process.exit(1);
  }
  
  // Create output directory
  await fs.mkdir(outDir, { recursive: true });
  
  let fileCount = 0;
  let scrubCount = 0;
  
  // Process files
  await walk(srcDir, async (filePath) => {
    const relativePath = path.relative(srcDir, filePath);
    const destPath = path.join(outDir, relativePath);
    
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
      // Scrub JavaScript files
      try {
        const content = await fs.readFile(filePath, "utf8");
        const scrubbed = scrubContent(content);
        
        await fs.writeFile(destPath, scrubbed);
        
        fileCount++;
        if (content !== scrubbed) {
          scrubCount++;
        }
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
      }
    } else {
      // Copy other files as-is
      try {
        await fs.copyFile(filePath, destPath);
      } catch (err) {
        console.error(`Error copying ${filePath}:`, err.message);
      }
    }
  });
  
  console.log(`✓ Comments scrubbed from ${scrubCount}/${fileCount} JS files`);
  console.log(`✓ Output written to: ${outDir}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

export { scrubContent, walk }; 