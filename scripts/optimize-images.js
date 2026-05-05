const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const inputDir = path.join(__dirname, "../original");
const outputDir = path.join(__dirname, "../public/img");
const cacheDir = path.join(
  __dirname,
  "../node_modules/.cache/optimized-images",
);

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create cache directory if it doesn't exist
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function optimizeImages() {
  try {
    const files = fs.readdirSync(inputDir);

    for (const file of files) {
      const inputPath = path.join(inputDir, file);

      // Skip if it's a directory
      if (fs.statSync(inputPath).isDirectory()) {
        continue;
      }

      // Get output path, changing extension to .webp
      const parsedPath = path.parse(file);
      const outputFilename = `${parsedPath.name}.webp`;
      const outputPath = path.join(outputDir, outputFilename);
      const cachePath = path.join(cacheDir, outputFilename);

      // Skip if already in output folder
      if (fs.existsSync(outputPath)) {
        console.log(`Skipping ${file}: already optimized.`);
        continue;
      }

      // Check if it exists in node_modules cache
      if (fs.existsSync(cachePath)) {
        console.log(`Restoring ${file} from cache...`);
        fs.copyFileSync(cachePath, outputPath);
        continue;
      }

      // Get metadata to calculate 50% resize
      const metadata = await sharp(inputPath).metadata();
      const newWidth = Math.round(metadata.width * 0.5);

      console.log(
        `Processing ${file}: resizing width from ${metadata.width}px to ${newWidth}px and converting to webp...`,
      );

      // Process image directly to cache first
      await sharp(inputPath)
        .resize(newWidth) // resize to 50% width (height scales automatically)
        .avif({ quality: 50 }) // convert to webp with 80% quality
        .toFile(cachePath);

      // Copy from cache to output folder
      fs.copyFileSync(cachePath, outputPath);

      console.log(`Successfully optimized and cached: ${outputPath}`);
    }

    console.log("All images optimized successfully!");
  } catch (error) {
    console.error("Error optimizing images:", error);
  }
}

optimizeImages();
