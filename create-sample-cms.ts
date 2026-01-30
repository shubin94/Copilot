import { createCategory, createTag, createPage } from "./server/storage/cms.ts";

async function run() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const categoryName = `Sample Category ${timestamp}`;
  const categorySlug = `sample-category-${timestamp.toLowerCase()}`;

  const tagName = `Sample Tag ${timestamp}`;
  const tagSlug = `sample-tag-${timestamp.toLowerCase()}`;

  const pageTitle = `Sample Page ${timestamp}`;
  const pageSlug = `sample-page-${timestamp.toLowerCase()}`;

  const category = await createCategory(categoryName, categorySlug);
  const tag = await createTag(tagName, tagSlug);
  const page = await createPage(
    pageTitle,
    pageSlug,
    category.id,
    `<h1>${pageTitle}</h1><p>Sample content created ${timestamp}</p>`,
    [tag.id]
  );

  console.log("✅ Created sample category:", category);
  console.log("✅ Created sample tag:", tag);
  console.log("✅ Created sample page:", page);
}

run().catch((error) => {
  console.error("❌ Failed to create sample CMS data:", error);
  process.exit(1);
});
