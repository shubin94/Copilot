#!/usr/bin/env node
/**
 * Test script to verify detective form submission works
 * This checks the /api/applications endpoint with a valid payload
 */

const testPayload = {
  // Account fields
  firstName: "Test",
  lastName: "Detective",
  email: "test-detective-" + Date.now() + "@test.com",
  password: "TestPassword123",
  confirmPassword: "TestPassword123",
  businessType: "individual",
  companyName: "Test Company",
  businessWebsite: "https://test.com",
  businessDocuments: [],
  documents: [],
  
  // Profile fields
  country: "US",
  state: "CA",
  city: "Los Angeles",
  fullAddress: "123 Main Street, Los Angeles, CA 90001",
  pincode: "90001",
  phoneCountryCode: "US",
  phoneNumber: "5551234567",
  yearsExperience: 5,
  about: "Experienced detective with 5+ years of experience in criminal investigations.",
  
  // Verification fields
  logo: "",
  banner: "",
  serviceCategories: ["missing-persons"],
  categoryPricing: { "missing-persons": 500 },
  isClaimable: true,
  licenseNumber: "DET12345",
};

console.log("Testing detective application submission...");
console.log("Payload size:", JSON.stringify(testPayload).length, "bytes");
console.log("API endpoint: POST http://localhost:5000/api/applications");
console.log("");

fetch("http://localhost:5000/api/applications", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: JSON.stringify(testPayload),
  credentials: "include",
})
  .then(res => {
    console.log("Response status:", res.status, res.statusText);
    return res.json();
  })
  .then(data => {
    console.log("Response data:", JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error("Request failed:", err.message);
    process.exit(1);
  });
