const http = require('http');

const testMessage = "I want to check if my partner is cheating on me";

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/smart-search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log(`\n========== REQUEST SENT ==========`);
  console.log(`Test Message: "${testMessage}"`);
  console.log(`\n========== SERVER RESPONSE (Status: ${res.statusCode}) ==========`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
    console.log(`\n========== END RESPONSE ==========\n`);
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
  process.exit(1);
});

const body = JSON.stringify({ query: testMessage });
console.log(`\nSending POST to http://localhost:5000/api/smart-search`);
console.log(`Body: ${body}`);
req.write(body);
req.end();
