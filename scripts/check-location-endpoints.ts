async function run() {
  const urls = [
    "http://localhost:5000/api/detectives/location/united-states?limit=50&offset=0",
    "http://localhost:5000/api/detectives/location/united-states/arizona?limit=50&offset=0",
    "http://localhost:5000/api/detectives/location/united-states/arizona/anthem?limit=50&offset=0",
    "http://localhost:5000/api/detectives/location/india/karnataka?limit=50&offset=0",
    "http://localhost:5000/api/locations/top",
  ];

  for (const url of urls) {
    const res = await fetch(url);
    const data = await res.json();
    console.log("\nURL:", url);
    console.log("Status:", res.status);

    if (url.endsWith("/api/locations/top")) {
      console.log("Top countries:", (data.countries || []).map((x: any) => `${x.slug}:${x.detectiveCount}`).join(", "));
      console.log("Top states:", (data.states || []).map((x: any) => `${x.slug}:${x.detectiveCount}`).join(", "));
      console.log("Top cities:", (data.cities || []).map((x: any) => `${x.slug}:${x.detectiveCount}`).join(", "));
    } else {
      console.log("Total:", data.total, "Returned:", (data.detectives || []).length);
      console.log("Meta:", data.meta);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
