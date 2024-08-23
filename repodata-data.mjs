import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper function to resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load releases data from releases.json
const releasesFilePath = path.join(__dirname, 'releases.json');
const dataFilePath = path.join(__dirname, 'data.json');

// Function to transform releases data into chart data
function transformData(releases) {
  // Initialize the chart data structure
  const chartData = {
    labels: [],
    datasets: [],
  };

  // Prepare datasets for each unique asset
  const assetDataMap = new Map();

  releases.forEach(release => {
    // Add release name to labels
    chartData.labels.push(release.name);

    release.assets.forEach(asset => {
      if (!assetDataMap.has(asset.name)) {
        // Initialize dataset for new asset type
        assetDataMap.set(asset.name, {
          label: asset.name,
          backgroundColor: getRandomColor(),
          data: Array(chartData.labels.length - 1).fill(0), // Fill with 0 for previous releases
        });
      }

      // Get the current dataset for this asset
      const assetDataset = assetDataMap.get(asset.name);

      // Ensure the data array is the correct length before pushing new data
      while (assetDataset.data.length < chartData.labels.length - 1) {
        assetDataset.data.push(0); // Fill with 0 for any missing data points
      }

      // Add the download count for the current release
      assetDataset.data.push(asset.download_count);
    });
  });

  // Ensure all datasets have the same length
  assetDataMap.forEach(dataset => {
    while (dataset.data.length < chartData.labels.length) {
      dataset.data.push(0); // Fill with 0 for missing releases
    }
    chartData.datasets.push(dataset);
  });

  return chartData;
}

// Function to generate a random color for the datasets
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Main function to read releases.json, transform it, and write to data.json
function main() {
  if (!fs.existsSync(releasesFilePath)) {
    console.error(`Error: ${releasesFilePath} not found.`);
    process.exit(1);
  }

  try {
    const releasesData = JSON.parse(fs.readFileSync(releasesFilePath, 'utf-8'));
    const chartData = transformData(releasesData);
    fs.writeFileSync(dataFilePath, JSON.stringify(chartData, null, 2), 'utf-8');
    console.log(`Data successfully transformed and saved to ${dataFilePath}`);
  } catch (error) {
    console.error(`Failed to process the data: ${error.message}`);
  }
}

// Execute the main function
main();
