const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const heicConvert = require("heic-convert");


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

      // Convert HEIC images first using heic-convert to bypass native HEIC decoder issues
      let imageInput = inputPath;
      const isHeic = parsedPath.ext.toLowerCase() === ".heic";

      if (isHeic) {
        console.log(`Converting HEIC image ${relPath} to JPEG format first...`);
        const inputBuffer = fs.readFileSync(inputPath);
        imageInput = await heicConvert({
          buffer: inputBuffer,
          format: "JPEG",
          quality: 1,
        });
      }

      // Get metadata to calculate 50% resize
      const metadata = await sharp(imageInput).metadata();
      const newWidth = Math.round(metadata.width * 0.5);

      console.log(
        `Processing ${relPath}: converting to webp and resizing width from ${metadata.width}px to ${newWidth}px...`,
      );

      // Process image directly to cache first: convert/encode first, then resize
      await sharp(imageInput)
        .webp({ quality: 80 }) // convert to webp with 80% quality
        .resize(newWidth) // resize to 50% width (height scales automatically)
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

