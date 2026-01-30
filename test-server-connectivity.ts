import http from "http";

console.log("Testing server connectivity...\n");

const testRequests = [
  { path: "/", name: "Root page" },
  { path: "/api/public/pages/sdfds", name: "Public API" },
  { path: "/api/auth/me", name: "Auth endpoint" },
];

let completed = 0;

testRequests.forEach(({ path, name }) => {
  const req = http.request({
    hostname: "127.0.0.1",
    port: 5000,
    path,
    method: "GET",
  }, (res) => {
    console.log(`✓ ${name} (${path})`);
    console.log(`  Status: ${res.statusCode}`);
    console.log(`  Content-Type: ${res.headers['content-type']}`);
    
    completed++;
    if (completed === testRequests.length) {
      console.log("\n✅ Server is responding correctly!");
      process.exit(0);
    }
  });

  req.on("error", (err) => {
    console.log(`✗ ${name} (${path})`);
    console.log(`  Error: ${err.message}`);
    completed++;
    if (completed === testRequests.length) {
      console.log("\n❌ Some requests failed!");
      process.exit(1);
    }
  });

  req.end();
});
