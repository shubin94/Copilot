(async () => {
  console.log('=== QUERY PATH PERFORMANCE COMPARISON ===\n');

  const paths = {
    recent: 'http://localhost:5000/api/services?sortBy=recent&limit=15&offset=0',
    popular: 'http://localhost:5000/api/services?sortBy=popular&limit=15&offset=0',
    recentWithFilter: 'http://localhost:5000/api/services?sortBy=recent&limit=15&offset=0&category=consulting',
  };

  for (const [pathType, url] of Object.entries(paths)) {
    console.log(`${pathType.toUpperCase()}:`);
    
    const times = [];
    for (let i = 0; i < 8; i++) {
      const start = Date.now();
      const resp = await fetch(url);
      const text = await resp.text();
      const elapsed = Date.now() - start;
      times.push(elapsed);
      
      const state = i === 0 ? '[COLD]' : i < 3 ? '[WARM]' : '[HOT]';
      const count = JSON.parse(text).services?.length || 0;
      console.log(`  Run ${i+1} ${state}: ${elapsed}ms (${count} services)`);
    }
    
    const cold = times[0];
    const warm = times.slice(2).reduce((a,b)=>a+b,0) / times.slice(2).length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const stdDev = Math.sqrt(times.reduce((sq,n)=>sq+Math.pow(n-warm,2),0)/times.length);
    
    console.log(`  Summary: cold=${cold}ms | warm=${Math.round(warm)}ms | max=${max}ms | stdDev=${Math.round(stdDev)}ms`);
    console.log();
  }

  console.log('=== LARGE OFFSET TEST (pagination stress) ===\n');
  const offsets = [0, 50, 100, 500];
  for (const offset of offsets) {
    const start = Date.now();
    const resp = await fetch(`http://localhost:5000/api/services?sortBy=recent&limit=15&offset=${offset}`);
    const elapsed = Date.now() - start;
    const text = await resp.text();
    const count = JSON.parse(text).services?.length || 0;
    console.log(`  offset=${offset}: ${elapsed}ms (${count} services)`);
  }
})().catch(console.error);
