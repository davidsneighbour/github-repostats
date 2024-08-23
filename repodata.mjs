import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper function to resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to load environment variables from .env files
function loadEnv() {
  const envPaths = [
    path.join(process.env.HOME || '', '.env'), // ~/.env in the user's home directory
    path.join(__dirname, '.env')               // .env in the current directory
  ];

  envPaths.forEach(envPath => {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=').map(str => str.trim());
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      });
    }
  });
}

// Load environment variables at the start
loadEnv();

// Function to parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-p':
      case '--project':
        config.project = args[i + 1];
        i++;
        break;
      case '-t':
      case '--token':
        config.authToken = args[i + 1];
        i++;
        break;
      case '-o':
      case '--output':
        config.outputFilePath = args[i + 1];
        i++;
        break;
      case '--per-page':
        config.perPage = parseInt(args[i + 1], 10);
        i++;
        break;
      case '-h':
      case '--help':
        console.log(`Usage: node script.js [options]

Options:
  -p, --project <username/reponame>    GitHub repository to fetch releases from
  -t, --token <token>                  GitHub personal access token for authentication
  -o, --output <path>                  Path to save the output JSON file
  --per-page <number>                  Number of items per page (default: 100)
  -h, --help                           Show this help message
`);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  // Set default values if not provided
  config.perPage = config.perPage || 100;
  config.outputFilePath = config.outputFilePath || path.join(__dirname, 'releases.json');

  // Use the GITHUB_TOKEN from environment variables if no token is provided via CLI
  config.authToken = config.authToken || process.env.GITHUB_TOKEN;

  return config;
}

// Load configuration from command line arguments
const config = parseArgs();

// Function to make a request to GitHub API
function fetchReleases(page = 1) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${config.project}/releases?per_page=${config.perPage}&page=${page}`,
    method: 'GET',
    headers: {
      'User-Agent': 'Node.js Script',
      'Authorization': `token ${config.authToken}`
    }
  };

  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to fetch releases: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

// Function to fetch all pages of releases
async function fetchAllReleases() {
  let allReleases = [];
  let page = 1;
  let morePages = true;

  while (morePages) {
    try {
      const releases = await fetchReleases(page);
      if (releases.length === 0) {
        morePages = false; // No more releases to fetch
      } else {
        allReleases = allReleases.concat(releases);
        page++;
      }
    } catch (error) {
      console.error(`Error fetching releases: ${error.message}`);
      morePages = false;
    }
  }

  return allReleases;
}

// Function to normalize asset names by removing version numbers
function normalizeAssetName(assetName) {
  // Regex pattern to match version numbers like "0.132.0"
  return assetName.replace(/_[0-9]+\.[0-9]+\.[0-9]+/, '');
}

// Function to process and merge release data
function processReleases(releases) {
  // Sort releases by published date
  releases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  // Map the required data
  const processedData = releases.map(release => ({
    name: release.name,
    published_at: release.published_at,
    assets: release.assets.map(asset => ({
      name: normalizeAssetName(asset.name),
      label: asset.label,
      size: asset.size,
      download_count: asset.download_count,
      content_type: asset.content_type
    }))
  }));

  return processedData;
}

// Function to save processed data to a file
function saveToFile(data) {
  fs.writeFileSync(config.outputFilePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Data saved to ${config.outputFilePath}`);
}

// Main function to execute the script
async function main() {
  // Check if the required arguments are provided
  if (!config.project) {
    console.error('Error: Project is required. Use -p or --project to specify the repository.');
    process.exit(1);
  }

  if (!config.authToken) {
    console.error('Error: Authentication token is required. Use -t or --token to specify the token or set GITHUB_TOKEN in a .env file.');
    process.exit(1);
  }

  try {
    const allReleases = await fetchAllReleases();
    const processedData = processReleases(allReleases);
    saveToFile(processedData);
  } catch (error) {
    console.error(`Failed to complete the operation: ${error.message}`);
  }
}

// Execute the main function
main();
