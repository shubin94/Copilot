#!/usr/bin/env npx tsx
/**
 * Script: generate-location-slugs.ts
 *
 * - Loads all countries and states
 * - Generates URL-safe slugs using the `slugify` library (fallback implemented)
 * - Updates each row with a unique slug (handles collisions with -1, -2 ...)
 *
 * Usage:
 *   npx tsx scripts/generate-location-slugs.ts
 */

import { db, pool } from "../db/index";
import { countries, states, cities } from "../shared/schema";
import { and } from "drizzle-orm";
import { eq } from "drizzle-orm";

// dynamic import slugify if available, otherwise use fallback
async function loadSlugify() {
  try {
    const mod = await import('slugify');
    return (text: string) => (mod.default || mod)(text, { lower: true, strict: true });
  } catch (e) {
    // fallback implementation
    return (text: string) => {
      return text
        .toString()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 255);
    };
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const slugify = await loadSlugify();

    // Use DB (drizzle) selects/updates to keep types consistent
    await client.query('BEGIN');

    // --- COUNTRIES ---
    const countriesRows = await db.select({ id: countries.id, name: countries.name, code: countries.code, slug: countries.slug }).from(countries);
    if (!countriesRows || countriesRows.length === 0) {
      console.log('No countries found or `countries` table missing.');
    } else {
      const used = new Set<string>();
      for (const row of countriesRows) {
        if (row.slug && String(row.slug).trim()) used.add(String(row.slug));
      }

      for (const row of countriesRows) {
        const id = String(row.id);
        const name = (row.name as string) || (row.code as string) || 'country';
        let base = slugify(name || 'country');
        if (!base) base = ((row.code as string) || 'country').toString().toLowerCase();
        let candidate = base;
        let suffix = 1;
        while (used.has(candidate)) {
          candidate = `${base}-${suffix}`;
          suffix++;
        }
        if (!row.slug || String(row.slug) !== candidate) {
          await db.update(countries).set({ slug: candidate }).where(eq(countries.id, id));
          console.log(`Updated country ${name} -> ${candidate}`);
        }
        used.add(candidate);
      }
    }

    // --- STATES ---
    const statesRows = await db.select({ id: states.id, name: states.name, countryId: states.countryId, slug: states.slug }).from(states);
    if (!statesRows || statesRows.length === 0) {
      console.log('No states found or `states` table missing.');
    } else {
      const countrySlugMap = new Map<string, Set<string>>();
      for (const row of statesRows) {
        const countryId = String(row.countryId);
        const set = countrySlugMap.get(countryId) || new Set<string>();
        if (row.slug && String(row.slug).trim()) set.add(String(row.slug));
        countrySlugMap.set(countryId, set);
      }

      for (const row of statesRows) {
        const id = String(row.id);
        const name = (row.name as string) || 'state';
        const countryId = String(row.countryId);
        const sset = countrySlugMap.get(countryId) || new Set<string>();

        let base = slugify(name || 'state');
        if (!base) base = 'state';
        let candidate = base;
        let suffix = 1;
        while (sset.has(candidate)) {
          candidate = `${base}-${suffix}`;
          suffix++;
        }

        if (!row.slug || String(row.slug) !== candidate) {
          await db.update(states).set({ slug: candidate }).where(eq(states.id, id));
          console.log(`Updated state ${name} (country_id=${countryId}) -> ${candidate}`);
        }
        sset.add(candidate);
        countrySlugMap.set(countryId, sset);
      }
    }
    // --- CITIES ---
    const citiesRows = await db.select({ id: cities.id, name: cities.name, stateId: cities.stateId, slug: cities.slug }).from(cities);
    if (!citiesRows || citiesRows.length === 0) {
      console.log('No cities found or `cities` table missing.');
    } else {
      const stateSlugMap = new Map<string, Set<string>>();
      for (const row of citiesRows) {
        const stateId = String(row.stateId);
        const set = stateSlugMap.get(stateId) || new Set<string>();
        if (row.slug && String(row.slug).trim()) set.add(String(row.slug));
        stateSlugMap.set(stateId, set);
      }

      for (const row of citiesRows) {
        const id = String(row.id);
        const name = (row.name as string) || 'city';
        const stateId = String(row.stateId);
        const sset = stateSlugMap.get(stateId) || new Set<string>();

        let base = slugify(name || 'city');
        if (!base) base = 'city';
        let candidate = base;
        let suffix = 1;
        while (sset.has(candidate)) {
          candidate = `${base}-${suffix}`;
          suffix++;
        }

        if (!row.slug || String(row.slug) !== candidate) {
          await db.update(cities).set({ slug: candidate }).where(eq(cities.id, id));
          console.log(`Updated city ${name} (state_id=${stateId}) -> ${candidate}`);
        }
        sset.add(candidate);
        stateSlugMap.set(stateId, sset);
      }
    }

    await client.query('COMMIT');
    console.log('Slug generation completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to generate slugs:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
