#!/usr/bin/env node
/**
 * Test script for geolocation endpoints after library migration.
 * Run this after starting the dev server: npm run dev
 * Then in another terminal: node test-locations.mjs
 */

const BASE_URL = "http://localhost:5000";

async function testCountries() {
  console.log("\n🌍 Testing /api/locations/countries...");
  try {
    const response = await fetch(`${BASE_URL}/api/locations/countries`);
    const data = await response.json();
    console.log(`✓ Success: ${data.countries.length} countries returned`);
    console.log(`  Sample: ${data.countries.slice(0, 5).join(", ")}...`);
    return data.countries.length;
  } catch (error) {
    console.error("✗ Failed:", error.message);
    return 0;
  }
}

async function testStates() {
  console.log("\n🏙️  Testing /api/locations/states?country=US...");
  try {
    const response = await fetch(`${BASE_URL}/api/locations/states?country=US`);
    const data = await response.json();
    console.log(`✓ Success: ${data.states.length} states returned for US`);
    console.log(`  Sample: ${data.states.slice(0, 5).join(", ")}...`);
    return data.states.length;
  } catch (error) {
    console.error("✗ Failed:", error.message);
    return 0;
  }
}

async function testCities() {
  console.log("\n🏘️  Testing /api/locations/cities?country=US&state=California...");
  try {
    const response = await fetch(
      `${BASE_URL}/api/locations/cities?country=US&state=California`
    );
    const data = await response.json();
    console.log(`✓ Success: ${data.cities.length} cities returned for California`);
    console.log(`  Sample: ${data.cities.slice(0, 5).join(", ")}...`);
    return data.cities.length;
  } catch (error) {
    console.error("✗ Failed:", error.message);
    return 0;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Geolocation API Test Suite");
  console.log("=".repeat(60));

  const countryCount = await testCountries();
  const stateCount = await testStates();
  const cityCount = await testCities();

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));

  const results = [
    {
      test: "Countries Endpoint",
      expected: "> 200",
      actual: countryCount,
      pass: countryCount > 200,
    },
    {
      test: "States Endpoint (US)",
      expected: "> 40",
      actual: stateCount,
      pass: stateCount > 40,
    },
    {
      test: "Cities Endpoint (CA)",
      expected: "> 500",
      actual: cityCount,
      pass: cityCount > 500,
    },
  ];

  results.forEach((r) => {
    const status = r.pass ? "✓ PASS" : "✗ FAIL";
    console.log(
      `${status} | ${r.test}: ${r.actual} (expected: ${r.expected})`
    );
  });

  const allPass = results.every((r) => r.pass);
  console.log("\n" + (allPass ? "✓ All tests passed!" : "✗ Some tests failed"));
  console.log("=".repeat(60));
}

main().catch(console.error);
