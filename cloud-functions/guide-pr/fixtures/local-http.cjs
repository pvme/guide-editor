// Test-only loopback client; never accepts an external host or URL.
const http = require('node:http');
function rawRequest(port, route, body, headers = {}, chunks = null) {
  if (!Number.isInteger(port) || port <= 0 || !route.startsWith('/')) throw new Error('Invalid local test target');
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: route, method: 'POST',
      headers: { Origin: 'https://pvme.io', 'Content-Type': 'application/json', ...headers } }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
        resolve({ status: response.statusCode, body: parsed });
      });
    });
    request.setTimeout(3000, () => request.destroy(new Error('Local parser test timed out')));
    request.on('error', reject);
    if (chunks) {
      request.write(chunks[0]);
      setTimeout(() => request.end(chunks[1]), 20);
    } else request.end(body);
  });
}
module.exports = { rawRequest };
