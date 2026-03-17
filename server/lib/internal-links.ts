import { db } from "../db.js";

export async function getTopNearbyCities(country_slug: string, city_slug: string, limit = 20) {
  // Example: fetch cities in same country, excluding current city, ordered by population or activity
  return await db.query(
    `SELECT slug, name FROM cities WHERE country_slug = $1 AND slug != $2 ORDER BY population DESC LIMIT $3`,
    [country_slug, city_slug, limit]
  );
}

export async function getPopularServicesInCity(city_slug: string, limit = 20) {
  // Example: fetch services popular in city
  return await db.query(
    `SELECT s.slug, s.name FROM services s INNER JOIN service_city_stats scs ON s.slug = scs.service_slug WHERE scs.city_slug = $1 ORDER BY scs.popularity DESC LIMIT $2`,
    [city_slug, limit]
  );
}

export async function getOtherAreasInCity(city_slug: string, area_slug: string, limit = 20) {
  return await db.query(
    `SELECT slug, name FROM areas WHERE city_slug = $1 AND slug != $2 LIMIT $3`,
    [city_slug, area_slug, limit]
  );
}

export async function getOtherServicesInCity(city_slug: string, service_slug: string, limit = 20) {
  return await db.query(
    `SELECT slug, name FROM services WHERE slug != $1 LIMIT $2`,
    [service_slug, limit]
  );
}

export async function getNearbyCities(country_slug: string, city_slug: string, limit = 20) {
  // Same as getTopNearbyCities
  return await db.query(
    `SELECT slug, name FROM cities WHERE country_slug = $1 AND slug != $2 LIMIT $3`,
    [country_slug, city_slug, limit]
  );
}
