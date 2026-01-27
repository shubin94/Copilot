import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

async function ensureDetective(email: string, name: string, business: string, bio: string, country: string, service: { category: string; title: string; description: string; image: string; price: number }) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const { rows: u } = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
    let userId = u[0]?.id;
    if (!userId) {
      const ins = await client.query(
        `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, 'detective') RETURNING id`,
        [email, "DemoPass123!", name]
      );
      userId = ins.rows[0].id;
    }

    const { rows: d } = await client.query(`SELECT id FROM detectives WHERE user_id = $1`, [userId]);
    let detId = d[0]?.id;
    if (!detId) {
      const det = await client.query(
        `INSERT INTO detectives (user_id, business_name, bio, country, status, is_verified, is_claimed, is_claimable, created_by, subscription_plan)
         VALUES ($1, $2, $3, $4, 'active', true, false, true, 'admin', 'free') RETURNING id`,
        [userId, business, bio, country]
      );
      detId = det.rows[0].id;
    }

    const { rows: s } = await client.query(`SELECT id FROM services WHERE detective_id = $1 LIMIT 1`, [detId]);
    if (!s[0]?.id) {
      await client.query(
        `INSERT INTO services (detective_id, category, title, description, images, base_price, is_active)
         VALUES ($1, $2, $3, $4, ARRAY[$5], $6, true)`,
        [detId, service.category, service.title, service.description, service.image, service.price]
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  await ensureDetective(
    "demo.detective1@example.com",
    "Demo Detective One",
    "Demo Detective Agency",
    "Expert investigations with prompt reporting.",
    "US",
    { category: "Background Check", title: "Background Check", description: "Comprehensive background investigation.", image: "https://picsum.photos/seed/demo1/800/400", price: 149.0 }
  );
  await ensureDetective(
    "demo.detective2@example.com",
    "Demo Detective Two",
    "Investigation Pros",
    "Trusted surveillance and records retrieval.",
    "US",
    { category: "Surveillance", title: "Covert Surveillance", description: "Discreet surveillance with daily logs.", image: "https://picsum.photos/seed/demo2/800/400", price: 249.0 }
  );
  await ensureDetective(
    "demo.detective3@example.com",
    "Demo Detective Three",
    "Legal Insight Investigations",
    "Litigation support and witness interviews.",
    "US",
    { category: "Legal Support", title: "Litigation Support", description: "Case research and interview services.", image: "https://picsum.photos/seed/demo3/800/400", price: 199.0 }
  );
  console.log("Demo detectives ensured.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
