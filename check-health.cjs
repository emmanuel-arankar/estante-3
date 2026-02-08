const http = require('http');

const urls = [
    'http://127.0.0.1:5000/api/health', // Hosting Proxy
    'http://127.0.0.1:5001/estante-virtual-805ef/us-central1/api/health', // Standard Function URL
    'http://127.0.0.1:5001/estante-virtual-805ef/us-central1/api-api/health', // Potential conflict 1
    'http://127.0.0.1:5001/estante-virtual-805ef/us-central1/backend-api-api/health', // Potential conflict 2
    'http://127.0.0.1:5001/api/health' // Simplified
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
