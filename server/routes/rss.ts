import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";

const router = Router();

// Generate RSS feed for blog posts
router.get("/", async (req: Request, res: Response) => {
  try {
    const baseUrl = "https://www.askdetectives.com";
    const buildDate = new Date().toUTCString();

    // Get latest 50 published blog posts
    const result = await pool.query(`
      SELECT 
        p.id,
        p.title,
        p.slug,
        p.content,
        p.banner_image,
        p.meta_description,
        p.created_at,
        p.updated_at,
        c.name as category_name,
        c.slug as category_slug
      FROM pages p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    // Escape XML special characters
    const escapeXml = (str: string) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // Build RSS XML
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>FindDetectives Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Latest articles, guides, and insights about private investigation services</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

    for (const post of result.rows) {
      const pageUrl = post.category_slug 
        ? `${baseUrl}/${post.category_slug}/${post.slug}`
        : `${baseUrl}/${post.slug}`;
      
      const pubDate = new Date(post.created_at).toUTCString();
      
      // Extract text excerpt from content (remove HTML-like content)
      let description = post.meta_description || '';
      if (!description && post.content) {
        description = post.content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\n/g, ' ')
          .substring(0, 200) + '...';
      }

      rss += `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${pageUrl}</link>
      <guid isPermaLink="true">${pageUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>`;

      if (post.category_name) {
        rss += `
      <category>${escapeXml(post.category_name)}</category>`;
      }

      if (post.banner_image) {
        rss += `
      <enclosure url="${post.banner_image}" type="image/jpeg" />`;
      }

      rss += `
    </item>`;
    }

    rss += `
  </channel>
</rss>`;

    res.header("Content-Type", "application/rss+xml; charset=UTF-8");
    res.send(rss);

    console.log(`[RSS] Generated feed with ${result.rows.length} posts`);
  } catch (error) {
    console.error("[RSS] Error generating feed:", error);
    res.status(500).json({ error: "Failed to generate RSS feed" });
  }
});

export default router;
