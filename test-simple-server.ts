import express from "express";
import { pool } from "./db/index.ts";

const app = express();

// Test the basic route
app.get("/api/public/pages/:slug", async (req, res) => {
  try {
    console.log("🔍 Received request for slug:", req.params.slug);
    
    const { slug } = req.params;
    const result = await pool.query(
      "SELECT id, title, slug, content FROM pages WHERE slug = $1 AND status = 'published'",
      [slug]
    );
    
    if (result.rows.length === 0) {
      console.log("❌ No page found");
      return res.status(404).json({ error: "Page not found" });
    }
    
    console.log("✅ Page found:", result.rows[0].title);
    res.json({ page: result.rows[0] });
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Failed" });
  }
});

app.listen(5001, () => {
  console.log("✅ Test server listening on port 5001");
});

// Keep alive forever
setInterval(() => {}, 1000);
