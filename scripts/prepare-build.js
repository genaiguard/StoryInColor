/**
 * Script to prepare images for build
 * This ensures all references to WebP files will work regardless of environment
 */

const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const EXTENSIONS = ['.webp', '.avif', '.png', '.jpg', '.jpeg', '.PNG'];

function ensureDirectorySync(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Ensure images directory exists
ensureDirectorySync(IMAGES_DIR);

// Verify all WebP files have lowercase extensions in code references
function renameToLowerCaseExtensions() {
  const files = fs.readdirSync(IMAGES_DIR);
  
  files.forEach(filename => {
    const filePath = path.join(IMAGES_DIR, filename);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      
      if (ext !== ext.toLowerCase()) {
        const newFilename = `${baseName}${ext.toLowerCase()}`;
        const newFilePath = path.join(IMAGES_DIR, newFilename);
        
        // Create a copy with lowercase extension
        fs.copyFileSync(filePath, newFilePath);
        console.log(`Created lowercase copy: ${filename} → ${newFilename}`);
      }
    }
  });
}

// Ensure all WebP files exist for PNG files
function ensureWebpVersions() {
  const files = fs.readdirSync(IMAGES_DIR);
  
  files.forEach(filename => {
    const filePath = path.join(IMAGES_DIR, filename);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      const ext = path.extname(filename).toLowerCase();
      const baseName = path.basename(filename, ext);
      
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const webpFilename = `${baseName}.webp`;
        const webpFilePath = path.join(IMAGES_DIR, webpFilename);
        
        // Check if WebP version exists
        if (!fs.existsSync(webpFilePath)) {
          console.warn(`Missing WebP version for ${filename}. Using original file.`);
          // We're not creating WebP files here, just logging the missing ones
        }
      }
    }
  });
}

console.log('Preparing images for build...');
renameToLowerCaseExtensions();
ensureWebpVersions();
console.log('Image preparation complete!'); 