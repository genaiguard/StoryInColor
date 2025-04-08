// Image optimization script
// Convert images to WebP format and resize them appropriately
// Usage: node scripts/optimize-images.js

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// Paths
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const OPTIMIZED_DIR = path.join(PUBLIC_DIR, 'images-optimized');

// Image size configurations based on their usage
const IMAGE_CONFIGS = {
  // Hero images and main showcase images
  hero: { width: 1200, quality: 85 },
  // Standard card images
  card: { width: 600, quality: 80 },
  // Small thumbnails and icons
  thumbnail: { width: 300, quality: 75 }
};

// File patterns to determine optimal size
const SIZE_PATTERNS = {
  hero: ['best-6.png', 'hero', 'dog-coloring-hero'],
  card: ['coloring', 'family-trip', 'countryside', 'city-skyline', 'bali'],
  thumbnail: ['product-', 'icon-', 'thumb-']
};

async function ensureDirectoryExists(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Directory created: ${dir}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

function determineImageType(filename) {
  const lowerName = filename.toLowerCase();
  
  // Check for hero images
  if (SIZE_PATTERNS.hero.some(pattern => lowerName.includes(pattern))) {
    return 'hero';
  }
  
  // Check for card images
  if (SIZE_PATTERNS.card.some(pattern => lowerName.includes(pattern))) {
    return 'card';
  }
  
  // Default to thumbnail size for smaller images
  if (SIZE_PATTERNS.thumbnail.some(pattern => lowerName.includes(pattern))) {
    return 'thumbnail';
  }
  
  // Default to card size if no pattern matches
  return 'card';
}

async function optimizeImage(sourcePath, filename) {
  try {
    const imageType = determineImageType(filename);
    const config = IMAGE_CONFIGS[imageType];
    
    // Create WebP version with configured size and quality
    const webpOutput = path.join(OPTIMIZED_DIR, `${path.parse(filename).name}.webp`);
    
    await sharp(sourcePath)
      .resize(config.width)
      .webp({ quality: config.quality })
      .toFile(webpOutput);
    
    // Create AVIF version (if sharp supports it)
    try {
      const avifOutput = path.join(OPTIMIZED_DIR, `${path.parse(filename).name}.avif`);
      
      await sharp(sourcePath)
        .resize(config.width)
        .avif({ quality: config.quality })
        .toFile(avifOutput);
      
      console.log(`Converted to AVIF: ${filename} → ${path.basename(avifOutput)}`);
    } catch (avifError) {
      console.warn(`AVIF conversion not supported for ${filename}`);
    }
    
    console.log(`Optimized ${filename} (${imageType}): ${config.width}px @ ${config.quality}% quality`);
    return true;
  } catch (error) {
    console.error(`Error optimizing ${filename}:`, error.message);
    return false;
  }
}

async function installDependencies() {
  try {
    console.log('Checking for sharp dependency...');
    await execAsync('npm list sharp');
    console.log('sharp is already installed');
  } catch (error) {
    console.log('Installing sharp package...');
    try {
      await execAsync('npm install sharp --save-dev');
      console.log('sharp installed successfully');
    } catch (installError) {
      console.error('Failed to install sharp:', installError.message);
      process.exit(1);
    }
  }
}

async function main() {
  try {
    // Ensure the sharp package is installed
    await installDependencies();
    
    // Create output directory
    await ensureDirectoryExists(OPTIMIZED_DIR);
    
    // Get all files in the images directory
    const files = await fs.readdir(IMAGES_DIR);
    
    // Filter for image files
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    });
    
    console.log(`Found ${imageFiles.length} images to optimize`);
    
    // Process each image
    let successCount = 0;
    for (const file of imageFiles) {
      const sourcePath = path.join(IMAGES_DIR, file);
      const success = await optimizeImage(sourcePath, file);
      if (success) successCount++;
    }
    
    console.log(`\nOptimization complete: ${successCount}/${imageFiles.length} images processed successfully`);
    console.log(`\nTo use these optimized images:`);
    console.log(`1. Move the contents of public/images-optimized to public/images`);
    console.log(`2. Update any hardcoded .png or .jpg extensions to .webp`);
    
  } catch (error) {
    console.error('Error in optimization process:', error);
    process.exit(1);
  }
}

main(); 