const http = require('http');

require('dotenv').config();
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463';
const region = process.env.VITE_FIREBASE_REGION || 'us-central1';

const urls = [
  'http://127.0.0.1:5000/api/health',                                     // Hosting Proxy
  `http://127.0.0.1:5001/${projectId}/${region}/api/health`,              // Standard Function URL
  `http://127.0.0.1:5001/${projectId}/${region}/api-api/health`,          // Potential conflict 1
  `http://127.0.0.1:5001/${projectId}/${region}/backend-api-api/health`,  // Potential conflict 2
  `http://127.0.0.1:5001/api/health`                                      // Simplified
];

function checkUrl(url) {
  const req = http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`[${res.statusCode}] ${url}`);
      // Only show body if OK or 404/500 to debug
      if (res.statusCode === 200 || res.statusCode >= 400) {
        console.log('Body start:', data.substring(0, 500));
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[ERROR] ${url}: ${err.message}`);
  });
}

console.log('Testing URLs...');
urls.forEach(url => checkUrl(url));
