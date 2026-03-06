#!/usr/bin/env node

/**
 * Test CORS configuration directly
 * Run this to see what headers the CSRF endpoint returns
 */

import https from 'https';

const API_URL = 'https://api.askdetectives.com/api/csrf-token';
const ORIGIN = 'https://www.askdetectives.com';

console.log('🔍 Testing CORS on CSRF endpoint\n');
console.log(`API URL: ${API_URL}`);
console.log(`Origin: ${ORIGIN}\n`);

// Test OPTIONS request (preflight)
console.log('1️⃣  Testing OPTIONS (preflight)...');
const optionsReq = https.request(API_URL, {
  method: 'OPTIONS',
  headers: {
    'Origin': ORIGIN,
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'Content-Type',
  },
}, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Response Headers:');
  
  const corsHeaders = [
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-expose-headers',
    'access-control-max-age',
  ];
  
  corsHeaders.forEach(header => {
    const value = res.headers[header];
    if (value) {
      console.log(`  ✅ ${header}: ${value}`);
    } else {
      console.log(`  ❌ ${header}: NOT SET`);
    }
  });
  
  console.log('\nFull headers:');
  console.log(res.headers);
  
  console.log('\n\n2️⃣  Testing GET request...');
  
  // Test GET request
  const getReq = https.request(API_URL, {
    method: 'GET',
    headers: {
      'Origin': ORIGIN,
      'Cache-Control': 'no-store',
    },
  }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log('CORS Headers:');
    
    corsHeaders.forEach(header => {
      const value = res.headers[header];
      if (value) {
        console.log(`  ✅ ${header}: ${value}`);
      } else {
        console.log(`  ❌ ${header}: NOT SET`);
      }
    });
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\nResponse Body:');
      try {
        console.log(JSON.parse(data));
      } catch {
        console.log(data);
      }
      
      console.log('\n\n📋 Analysis:');
      const acaoHeader = res.headers['access-control-allow-origin'];
      const credHeader = res.headers['access-control-allow-credentials'];
      
      // Validate CORS configuration
      const isOriginValid = acaoHeader === ORIGIN || acaoHeader === '*';
      const areCredsValid = credHeader === 'true';
      
      if (isOriginValid) {
        console.log('✅ Access-Control-Allow-Origin is correct');
      } else {
        console.log(`❌ Access-Control-Allow-Origin is wrong: ${acaoHeader}`);
      }
      
      if (areCredsValid) {
        console.log('✅ Access-Control-Allow-Credentials is correct');
      } else {
        console.log(`❌ Access-Control-Allow-Credentials is wrong: ${credHeader}`);
      }
      
      // Final validation: Both must be correct
      if (isOriginValid && areCredsValid) {
        console.log('\n✅ CORS configuration is VALID');
      } else {
        console.log('\n❌ CORS configuration is INVALID');
      }
    });
  });
  
  getReq.on('error', err => {
    console.error('❌ GET request error:', err.message);
  });
  
  getReq.end();
});

optionsReq.on('error', err => {
  console.error('❌ OPTIONS request error:', err.message);
});

optionsReq.end();
