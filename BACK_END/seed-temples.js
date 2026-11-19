require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');

const catalogPath = path.join(__dirname, 'data', 'temples.json');
const allowedLicenses = /^(CC BY(?:-SA)? [0-9.]+|CC0|GODL-India|Public domain)$/i;

function assertCatalog(temples) {
  const requiredFields = [
    'slug',
    'temple_name',
    'location',
    'deity',
    'historical_background',
    'darshan_timings',
    'festivals',
    'visitor_guidelines',
    'image_file',
    'religion',
    'site_type',
    'image_url',
    'image_attribution',
    'image_license',
    'image_license_url',
    'image_source_url',
    'booking_information',
    'official_links'
  ];
  const slugs = new Set();

  if (!Array.isArray(temples) || temples.length < 251) {
    throw new Error('The catalog must contain more than 250 verified places of worship.');
  }

  for (const temple of temples) {
    for (const field of requiredFields) {
      if (!(field in temple)) {
        throw new Error(`Catalog entry is missing required field: ${field}`);
      }
    }
    if (typeof temple.slug !== 'string' || !temple.slug || slugs.has(temple.slug)) {
      throw new Error(`Catalog entry has a missing or duplicate slug: ${temple.slug}`);
    }
    slugs.add(temple.slug);
    if (!Array.isArray(temple.festivals) || !Array.isArray(temple.visitor_guidelines)
      || !Array.isArray(temple.official_links) || !temple.location.city || !temple.location.state) {
      throw new Error(`Catalog entry has invalid location or list fields: ${temple.slug}`);
    }
    if (!allowedLicenses.test(temple.image_license)) {
      throw new Error(`Unsupported image license for ${temple.temple_name}: ${temple.image_license}`);
    }
    if (!/^https:\/\/(thumb\.wikimedia\.org|upload\.wikimedia\.org)\//.test(temple.image_url)
      || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(temple.image_source_url)
      || !/^https?:\/\//.test(temple.image_license_url)
      || !temple.image_attribution.trim()) {
      throw new Error(`Catalog entry has invalid photo or license metadata: ${temple.slug}`);
    }
  }
}

async function main() {
  if (process.env.REPLACE_TEMPLE_DATA !== '1') {
    throw new Error('Set REPLACE_TEMPLE_DATA=1 to confirm replacing all place-of-worship records.');
  }
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('user_123')) {
    throw new Error('Set a valid MONGODB_URI in BACK_END/.env before seeding.');
  }

  const temples = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  assertCatalog(temples);
  const stagingCollectionName = `temples_staging_${process.pid}_${Date.now()}`;
  let stagingCollection;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    stagingCollection = db.collection(stagingCollectionName);
    await stagingCollection.createIndex({ slug: 1 }, { unique: true });
    await stagingCollection.insertMany(temples);

    await stagingCollection.rename('temples', { dropTarget: true });
    stagingCollection = undefined;
    console.log(`Replaced the places-of-worship collection with ${temples.length} records.`);
  } catch (error) {
    if (stagingCollection) {
      try {
        await stagingCollection.drop();
      } catch (cleanupError) {
        if (cleanupError.codeName !== 'NamespaceNotFound') {
          console.error('Staging collection cleanup failed:', cleanupError.message);
        }
      }
    }
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Catalog replacement failed:', error.message);
  process.exitCode = 1;
});
