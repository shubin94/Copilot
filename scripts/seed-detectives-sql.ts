import "../server/lib/loadEnv";
import pkg from "pg";
const { Pool } = pkg;

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const { rows: detCountRows } = await client.query(`SELECT COUNT(*)::int AS c FROM detectives`);
    if (detCountRows[0].c > 0) {
      console.log("Detectives already exist. No seed needed.");
      return;
    }

    const u1 = await client.query(
      `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, 'detective') RETURNING id`,
      ["seed.detective1@example.com", "SeedPass123!", "Seed Detective One"]
    );
    const userId1 = u1.rows[0].id;
    const d1 = await client.query(
      `INSERT INTO detectives (user_id, business_name, bio, country, status, is_verified, is_claimed, is_claimable, created_by)
       VALUES ($1, $2, $3, $4, 'active', true, true, false, 'self') RETURNING id`,
      [userId1, "Seed Detective Agency", "Professional detective ready to help with your case.", "US"]
    );
    const detId1 = d1.rows[0].id;
    await client.query(
      `INSERT INTO services (detective_id, category, title, description, images, base_price, is_active)
       VALUES ($1, $2, $3, $4, ARRAY[$5], $6, true)`,
      [detId1, "Background Check", "Comprehensive Background Check", "Detailed background investigation including records and references.", "https://picsum.photos/seed/background/800/400", 199.00]
    );

    const u2 = await client.query(
      `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, 'detective') RETURNING id`,
      ["seed.detective2@example.com", "SeedPass456!", "Seed Detective Two"]
    );
    const userId2 = u2.rows[0].id;
    const d2 = await client.query(
      `INSERT INTO detectives (user_id, business_name, bio, country, status, is_verified, is_claimed, is_claimable, created_by)
       VALUES ($1, $2, $3, $4, 'active', true, true, false, 'self') RETURNING id`,
      [userId2, "Investigation Pros", "Trusted investigations for legal and personal matters.", "US"]
    );
    const detId2 = d2.rows[0].id;
    await client.query(
      `INSERT INTO services (detective_id, category, title, description, images, base_price, is_active)
       VALUES ($1, $2, $3, $4, ARRAY[$5], $6, true)`,
      [detId2, "Surveillance", "Discreet Surveillance Service", "Covert surveillance with comprehensive reporting.", "https://picsum.photos/seed/surveillance/800/400", 299.00]
    );

    console.log("Seed completed: 2 detectives with services created.");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
