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

function getFilesRecursively(dir, relativeTo = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, relativeTo));
    } else {
      results.push(path.relative(relativeTo, fullPath));
    }
  }
  return results;
}

const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".tiff",
  ".heic",
  ".avif",
];

async function optimizeImages() {
  try {
    const relativePaths = getFilesRecursively(inputDir, inputDir);

    for (const relPath of relativePaths) {
      const inputPath = path.join(inputDir, relPath);

      // Get output path, changing extension to .webp
      const parsedPath = path.parse(relPath);

      // Skip non-image files if any
      if (!SUPPORTED_IMAGE_EXTENSIONS.includes(parsedPath.ext.toLowerCase())) {
        continue;
      }

      const outputFilename = path.join(
        parsedPath.dir,
        `${parsedPath.name}.webp`,
      );
      const outputPath = path.join(outputDir, outputFilename);
      const cachePath = path.join(cacheDir, outputFilename);

      // Skip if already in output folder
      if (fs.existsSync(outputPath)) {
        console.log(`Skipping ${relPath}: already optimized.`);
        continue;
      }

      // Ensure cache parent directory exists
      const fileCacheDir = path.dirname(cachePath);
      if (!fs.existsSync(fileCacheDir)) {
        fs.mkdirSync(fileCacheDir, { recursive: true });
      }

      // Ensure output parent directory exists
      const fileOutputDir = path.dirname(outputPath);
      if (!fs.existsSync(fileOutputDir)) {
        fs.mkdirSync(fileOutputDir, { recursive: true });
      }

      // Check if it exists in node_modules cache
      if (fs.existsSync(cachePath)) {
        console.log(`Restoring ${relPath} from cache...`);
        fs.copyFileSync(cachePath, outputPath);
        continue;
      }

      // Get metadata to calculate 50% resize
      const metadata = await sharp(inputPath).metadata();
      const newWidth = Math.round(metadata.width * 0.5);

      console.log(
        `Processing ${relPath}: resizing width from ${metadata.width}px to ${newWidth}px and converting to webp...`,
      );

      // Process image directly to cache first
      await sharp(inputPath)
        .resize(newWidth) // resize to 50% width (height scales automatically)
        .avif({ quality: 50 }) // convert to webp with 80% quality (retained existing AVIF conversion setting)
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

