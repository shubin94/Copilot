import http from "http";

function makeRequest(path: string) {
  return new Promise<string>((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 5000,
      path,
      method: "GET",
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log(`\n✅ ${path}`);
        console.log(`Status: ${res.statusCode}`);
        console.log("Response:", data);
        resolve(data);
      });
    });

    req.on("error", (e) => {
      console.log(`\n❌ ${path}`);
      console.error("Error:", e.message);
      reject(e);
    });

    req.on("timeout", () => {
      console.log(`\n⏱️ ${path} - TIMEOUT`);
      req.destroy();
      reject(new Error("Timeout"));
    });

    req.end();
  });
}

(async () => {
  console.log("Testing public pages API...\n");
  
  try {
    await makeRequest("/api/public/pages/sdfds");
    await new Promise(r => setTimeout(r, 500));
    
    await makeRequest("/api/public/pages/nonexistent");
    await new Promise(r => setTimeout(r, 500));
    
    console.log("\n✅ All tests completed");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
