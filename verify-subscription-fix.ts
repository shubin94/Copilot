import { db } from './db/index.ts';
import { detectives, subscriptionPlans } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function verifySubscriptionFix() {
  console.log('\n=== Verifying Subscription Fix ===\n');
  
  // Find all detectives with name containing Changappa
  const results = await db.select({
    detective: detectives,
    package: subscriptionPlans,
  })
  .from(detectives)
  .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id));
  
  const changappa = results.find(r => r.detective.businessName?.includes('Changappa'));
  
  if (!changappa) {
    console.log('❌ Detective "Changappa" not found');
    console.log('\nAll detectives:');
    results.forEach(r => console.log(`  - ${r.detective.businessName || '(unnamed)'}`));
    process.exit(1);
  }
  
  console.log('✅ Detective Found:');
  console.log(`   Name: ${changappa.detective.businessName}`);
  console.log(`   ID: ${changappa.detective.id}`);
  console.log(`   Legacy subscriptionPlan field: ${changappa.detective.subscriptionPlan}`);
  console.log(`   Actual subscriptionPackageId: ${changappa.detective.subscriptionPackageId}`);
  
  if (!changappa.package) {
    console.log('❌ No subscription package found!');
    process.exit(1);
  }
  
  console.log('\n✅ Subscription Package:');
  console.log(`   Name: ${changappa.package.name}`);
  console.log(`   Display Name: ${changappa.package.displayName}`);
  console.log(`   Service Limit: ${changappa.package.serviceLimit}`);
  console.log(`   Is Active: ${changappa.package.isActive}`);
  
  // Expected output for Enterprise:
  if (changappa.package.name === 'enterprise' && changappa.package.serviceLimit === 20) {
    console.log('\n✅ SUCCESS: Detective has Enterprise plan with 20 service limit');
    console.log('\n✅ Frontend should now display: "Enterprise - 20 Services"');
  } else {
    console.log(`\n⚠️  Expected: Enterprise plan with 20 services`);
    console.log(`   Got: ${changappa.package.name} plan with ${changappa.package.serviceLimit} services`);
  }
  
  process.exit(0);
}

verifySubscriptionFix().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
