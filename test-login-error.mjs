import fetch from "node-fetch";

const BASE_URL = "http://localhost:5000";

async function testLogin() {
  try {
    console.log("🧪 Testing login endpoint...");
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    
    if (response.status === 500) {
      console.error("❌ Got 500 error - check server logs");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testLogin();
