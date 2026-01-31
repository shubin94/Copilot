import fetch from "node-fetch";

console.log("Testing fetch to http://localhost:5000/api/public/pages/sdfds");

fetch("http://localhost:5000/api/public/pages/sdfds")
  .then(res => {
    console.log("✅ Fetch succeeded!");
    console.log("Status:", res.status);
    return res.text();
  })
  .then(data => {
    console.log("Response:", data);
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Fetch failed:", err.message);
    process.exit(1);
  });
