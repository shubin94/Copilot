import "../server/lib/loadEnv";
import { db } from '../db/index.ts';

async function checkDetectives() {
  try {
    const detectives = await db.query.detectives.findMany({ limit: 5 });
    console.log('Detectives found:', detectives.length);
    detectives.forEach(d => {
      console.log('ID:', d.id);
      console.log('Plan:', d.subscriptionPlan);
      console.log('Business Name:', d.businessName);
      console.log('---');
    });
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkDetectives();
