import { db } from "../db";
import { getAllCountries, getAllCities, getAllServices, getAllAreas } from "./data-fetchers";
import { formatISO } from "date-fns";

// Helper to chunk array
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function generateDetectiveSitemapUrls(): Promise<Array<{ url: string; lastmod: string; changefreq: string; priority: string }>> {
  const countries = await getAllCountries();
  const cities = await getAllCities();
  const urls: Array<{ url: string; lastmod: string; changefreq: string; priority: string }> = [];
  for (const country of countries) {
    for (const city of cities.filter(c => c.country_slug === country.slug)) {
      urls.push({
        url: `/detectives/${country.slug}/${city.slug}`,
        lastmod: formatISO(new Date()),
        changefreq: "daily",
        priority: "0.8"
      });
    }
  }
  return urls;
}

export async function generateServiceSitemapUrls(): Promise<Array<{ url: string; lastmod: string; changefreq: string; priority: string }>> {
  const services = await getAllServices();
  const countries = await getAllCountries();
  const cities = await getAllCities();
  const areas = await getAllAreas();
  const urls: Array<{ url: string; lastmod: string; changefreq: string; priority: string }> = [];
  for (const service of services) {
    for (const country of countries) {
      for (const city of cities.filter(c => c.country_slug === country.slug)) {
        for (const area of areas.filter(a => a.city_slug === city.slug)) {
          urls.push({
            url: `/locations/${service.slug}/${country.slug}/${city.slug}/${area.slug}`,
            lastmod: formatISO(new Date()),
            changefreq: "daily",
            priority: "0.7"
          });
        }
      }
    }
  }
  return urls;
}

export function generateSitemapXml(urls: Array<{ url: string; lastmod: string; changefreq: string; priority: string }>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url>\n    <loc>https://www.askdetectives.com${u.url}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n")}\n</urlset>`;
}

export function generateSitemapIndexXml(files: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map(f => `  <sitemap>\n    <loc>https://www.askdetectives.com/sitemaps/${f}</loc>\n    <lastmod>${formatISO(new Date())}</lastmod>\n  </sitemap>`).join("\n")}\n</sitemapindex>`;
}

export function chunkSitemapUrls(urls: Array<{ url: string; lastmod: string; changefreq: string; priority: string }>, chunkSize = 50000): Array<Array<{ url: string; lastmod: string; changefreq: string; priority: string }>> {
  return chunkArray(urls, chunkSize);
}
