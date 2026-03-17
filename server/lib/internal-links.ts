import { pool } from "../../db/index.js";

export async function getTopNearbyCities(country_slug: string, city_slug: string, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT ci.slug, ci.name
       FROM cities ci
       INNER JOIN states s ON ci.state_id = s.id
       INNER JOIN countries c ON s.country_id = c.id
       WHERE c.slug = $1 AND ci.slug != $2
       ORDER BY ci.name
       LIMIT $3`,
      [country_slug, city_slug, limit]
    );
    return result;
  } catch {
    return { rows: [] };
  }
}

export async function getPopularServicesInCity(_city_slug: string, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT slug, name FROM service_categories WHERE is_active = true ORDER BY name LIMIT $1`,
      [limit]
    );
    return result;
  } catch {
    return { rows: [] };
  }
}

export async function getOtherAreasInCity(_city_slug: string, _area_slug: string, _limit = 20) {
  return { rows: [] };
}

export async function getOtherServicesInCity(_city_slug: string, _service_slug: string, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT slug, name FROM service_categories WHERE is_active = true ORDER BY name LIMIT $1`,
      [limit]
    );
    return result;
  } catch {
    return { rows: [] };
  }
}

export async function getNearbyCities(country_slug: string, city_slug: string, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT ci.slug, ci.name
       FROM cities ci
       INNER JOIN states s ON ci.state_id = s.id
       INNER JOIN countries c ON s.country_id = c.id
       WHERE c.slug = $1 AND ci.slug != $2
       ORDER BY ci.name
       LIMIT $3`,
      [country_slug, city_slug, limit]
    );
    return result;
  } catch {
    return { rows: [] };
  }
}
