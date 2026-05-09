(async () => {
  const tests = {
    recent: 'http://localhost:5000/api/services?sortBy=recent&limit=15&offset=0',
    popular: 'http://localhost:5000/api/services?sortBy=popular&limit=15&offset=0'
  };
  
  console.log('=== PAYLOAD & TIMING MEASUREMENT (5 runs per sort) ===\n');
  
  for (const [sortType, url] of Object.entries(tests)) {
    const sizes = [];
    const timings = [];
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const r = await fetch(url);
      const t = await r.text();
      const elapsed = Date.now() - start;
      const bytes = Buffer.byteLength(t);
      
      sizes.push(bytes);
      timings.push(elapsed);
      
      console.log(`  Run ${i+1}: ${bytes} bytes (${elapsed}ms)`);
    }
    
    const avgSize = Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const avgTime = Math.round(timings.reduce((a,b)=>a+b,0)/timings.length);
    const minTime = Math.min(...timings);
    const maxTime = Math.max(...timings);
    
    console.log(`\n  ${sortType.toUpperCase()} SUMMARY:`);
    console.log(`    Payload: avg=${avgSize} bytes | min=${minSize} | max=${maxSize} | variance=${maxSize-minSize}`);
    console.log(`    Timing:  avg=${avgTime}ms | min=${minTime}ms | max=${maxTime}ms | spike=${maxTime-minTime}ms\n`);
  }

  console.log('=== MEDIA PROXY DIRECT TEST ===\n');
  const mediaStart = Date.now();
  const r = await fetch('http://localhost:5000/api/media-proxy/service/f73d79918c1be64fd01bcc4ae78126483989dc4b368eeadfd7630a67018384eb');
  const mediaElapsed = Date.now() - mediaStart;
  const mediaBytes = Buffer.byteLength(await r.text());
  console.log(`  Media proxy response: ${mediaBytes} bytes (${mediaElapsed}ms, HTTP ${r.status})`);
  console.log(`  Content-Type: ${r.headers.get('content-type')}`);
})();
