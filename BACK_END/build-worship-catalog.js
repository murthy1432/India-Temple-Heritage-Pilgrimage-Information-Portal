require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');

const catalogPath = path.join(__dirname, 'data', 'temples.json');
const cachePath = path.join(__dirname, 'data', '.worship-catalog-cache.json');
const photoCachePath = path.join(__dirname, 'data', '.worship-photo-cache.json');
const wikidataEndpoint = 'https://query.wikidata.org/sparql';
const commonsApi = 'https://commons.wikimedia.org/w/api.php';
const userAgent = 'IndianInformationPortal/1.0 (India places of worship catalog)';
const minimumSitesPerState = 25;
const maximumSitesPerRegion = 35;
const candidateSitesPerRegion = 60;
const regions = [
  ['Andhra Pradesh', 'Q1159', 'state'],
  ['Arunachal Pradesh', 'Q1162', 'state'],
  ['Assam', 'Q1164', 'state'],
  ['Bihar', 'Q1165', 'state'],
  ['Chhattisgarh', 'Q1168', 'state'],
  ['Goa', 'Q1171', 'state'],
  ['Gujarat', 'Q1061', 'state'],
  ['Haryana', 'Q1174', 'state'],
  ['Himachal Pradesh', 'Q1177', 'state'],
  ['Jharkhand', 'Q1184', 'state'],
  ['Karnataka', 'Q1185', 'state'],
  ['Kerala', 'Q1186', 'state'],
  ['Madhya Pradesh', 'Q1188', 'state'],
  ['Maharashtra', 'Q1191', 'state'],
  ['Manipur', 'Q1193', 'state'],
  ['Meghalaya', 'Q1195', 'state'],
  ['Mizoram', 'Q1502', 'state'],
  ['Nagaland', 'Q1599', 'state'],
  ['Odisha', 'Q22048', 'state'],
  ['Punjab', 'Q22424', 'state'],
  ['Rajasthan', 'Q1437', 'state'],
  ['Sikkim', 'Q1505', 'state'],
  ['Tamil Nadu', 'Q1445', 'state'],
  ['Telangana', 'Q677037', 'state'],
  ['Tripura', 'Q1363', 'state'],
  ['Uttar Pradesh', 'Q1498', 'state'],
  ['Uttarakhand', 'Q1499', 'state'],
  ['West Bengal', 'Q1356', 'state'],
  ['Andaman and Nicobar Islands', 'Q40888', 'union territory'],
  ['Chandigarh', 'Q120971341', 'union territory'],
  ['Dadra and Nagar Haveli and Daman and Diu', 'Q77997266', 'union territory'],
  ['Delhi', 'Q9357528', 'union territory'],
  ['Jammu and Kashmir', 'Q66278313', 'union territory'],
  ['Ladakh', 'Q200667', 'union territory'],
  ['Lakshadweep', 'Q26927', 'union territory'],
  ['Puducherry', 'Q66743', 'union territory']
];
const worshipClasses = [
  'Q44539',
  'Q16970',
  'Q32815',
  'Q337986',
  'Q5393308',
  'Q2613100',
  'Q34627',
  'Q44613',
  'Q24398318',
  'Q111286333',
  'Q697295'
];

function decodeHtml(value) {
  return value
    .replace(/<[^<>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeText(value) {
  return value.normalize('NFKC').replace(/[\W_]+/g, ' ').trim().toLowerCase();
}

function religionFor(siteType, wikidataReligion, siteName = '') {
  const type = `${siteType} ${wikidataReligion || ''} ${siteName}`.toLowerCase();
  if (/sikh|gurdwara|gurudwara/.test(type)) return 'Sikhism';
  if (/islam|mosque|masjid|sunni|shia|sufism/.test(type)) return 'Islam';
  if (/christian|catholic|orthodox|anglican|protestant|methodist|methodism|church|cathedral|chapel|basilica/.test(type)) {
    return 'Christianity';
  }
  if (/buddh|tibetan|gelug|kagyu|drukpa|drikung|gompa|vihara|stupa/.test(type)) return 'Buddhism';
  if (/jain/.test(type)) return 'Jainism';
  if (/judaism|jewish|synagogue/.test(type)) return 'Judaism';
  if (/zoroastr|parsi|agiyari|fire temple/.test(type)) return 'Zoroastrianism';
  if (/bah[aá]/.test(type)) return 'Baháʼí Faith';
  if (/sanamahism/.test(type)) return 'Sanamahism';
  if (/hindu|vaishnav|shaiv|shakt|radha|temple|mandir|devasthan|devalaya|swamy/.test(type)) {
    return 'Hinduism';
  }
  if (wikidataReligion && !/^Q\d+$/.test(wikidataReligion)) return wikidataReligion;
  return 'Not specified';
}

function siteTypeFor(siteType, siteName) {
  const type = `${siteType} ${siteName}`.toLowerCase();
  if (/gurdwara|gurudwara/.test(type)) return 'Gurdwara';
  if (/mosque|masjid|dargah/.test(type)) return 'Mosque or dargah';
  if (/church|cathedral|chapel|basilica|mary matha/.test(type)) return 'Church or chapel';
  if (/stupa|chorten|gompa|vihara|buddhist/.test(type)) return 'Buddhist site';
  if (/jain/.test(type)) return 'Jain temple';
  if (/synagogue/.test(type)) return 'Synagogue';
  if (/zoroastrian|parsi|agiyari|fire temple/.test(type)) return 'Zoroastrian fire temple';
  if (/temple|mandir|devasthan|devalaya/.test(type)) return 'Temple';
  return siteType || 'Place of worship';
}

function religionForSite(site) {
  const siteType = siteTypeFor(site.site_type, site.temple_name);
  const religion = religionFor(siteType, site.religion, `${site.temple_name} ${site.historical_background || ''}`);
  return {
    ...site,
    site_type: siteType,
    religion,
    deity: site.wikidata_id || site.deity === site.religion ? religion : site.deity
  };
}

function enrichExisting(site) {
  const siteType = site.site_type || (/gurdwara/i.test(site.temple_name) ? 'Gurdwara' : 'Temple');
  const religion = site.religion || religionFor(
    `${siteType} ${site.temple_name} ${site.deity} ${site.historical_background}`,
    ''
  );
  return {
    ...site,
    site_type: siteType,
    religion,
    source_url: site.source_url || ''
  };
}

function imageFileTitle(imageUrl) {
  const filename = decodeURIComponent(new URL(imageUrl).pathname.split('/').pop());
  if (!filename) throw new Error(`Wikidata returned an invalid Commons image URL: ${imageUrl}`);
  return `File:${filename.replace(/_/g, ' ')}`;
}

function normalizeImageTitle(title) {
  return title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function fetchJson(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/sparql-results+json, application/json'
        },
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) {
        const error = new Error(`${label} failed (${response.status}).`);
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const retrySeconds = Number(retryAfter);
          error.retryDelayMs = Number.isFinite(retrySeconds)
            ? Math.max(1000, retrySeconds * 1000)
            : attempt * 5000;
        }
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, error.retryDelayMs || attempt * 2000));
      }
    }
  }
  throw lastError;
}

async function fetchRegionSites([state, stateId]) {
  const classValues = worshipClasses.map((id) => `wd:${id}`).join(' ');
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?image ?typeLabel ?religionLabel ?parentLabel WHERE {
      ?item wdt:P131+ wd:${stateId} ;
        wdt:P18 ?image ;
        wdt:P31 ?directType .
      ?directType wdt:P279* ?worshipType .
      VALUES ?worshipType { ${classValues} }
      OPTIONAL { ?item wdt:P140 ?religion . }
      OPTIONAL { ?item wdt:P131 ?parent . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 500
  `;
  const url = `${wikidataEndpoint}?query=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson(url, `Wikidata query for ${state}`);
  const sites = new Map();

  for (const binding of data.results.bindings) {
    const id = binding.item.value.split('/').pop();
    if (!/^Q\d+$/.test(id) || sites.has(id)) continue;
    const name = binding.itemLabel?.value?.trim();
    if (/\bgroup\s*\(?\d+\)?\b/i.test(name || '')) continue;
    const image = binding.image?.value;
    if (!name || !image) continue;

    const description = binding.itemDescription?.value?.trim();
    const siteType = siteTypeFor(binding.typeLabel?.value || 'Place of worship', name);
    const parent = binding.parentLabel?.value;
    const city = parent && normalizeText(parent) !== normalizeText(state) ? parent : state;
    const religion = religionFor(siteType, binding.religionLabel?.value, `${name} ${description || ''}`);
    const sourceUrl = `https://www.wikidata.org/wiki/${id}`;
    sites.set(id, {
      slug: `wikidata-${id.toLowerCase()}`,
      wikidata_id: id,
      temple_name: name,
      location: { state, city },
      religion,
      site_type: siteType,
      deity: religion === 'Not specified' ? 'Not specified in the source.' : religion,
      historical_background: description || `${name} is listed as a ${siteType.toLowerCase()} in ${city}, ${state}.`,
      darshan_timings: 'Opening and prayer times are not listed in the source; confirm locally before visiting.',
      festivals: [],
      visitor_guidelines: ['Check local visitor guidance and access rules before travelling.'],
      image_file: imageFileTitle(image),
      booking_information: 'Entry and booking details are not listed in the source; check with the site before visiting.',
      official_links: [],
      source_url: sourceUrl
    });
  }

  return [...sites.values()];
}

async function fetchCommonsMetadata(sites) {
  const images = new Map();
  const checkedTitles = new Set();
  try {
    const cached = JSON.parse(await fs.readFile(photoCachePath, 'utf8'));
    if (cached.version === 1 && cached.images && typeof cached.images === 'object') {
      for (const [title, metadata] of Object.entries(cached.images)) {
        images.set(title, metadata);
      }
      if (Array.isArray(cached.checkedTitles)) {
        for (const title of cached.checkedTitles) checkedTitles.add(title);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const titles = [...new Map(sites.map((site) => [
    normalizeImageTitle(site.image_file),
    site.image_file
  ])).entries()].map(([key, title]) => ({ key, title }));
  const batchCount = Math.ceil(titles.length / 50);
  for (let start = 0; start < titles.length; start += 50) {
    const batch = titles.slice(start, start + 50);
    const uncachedTitles = batch.filter(({ key }) => !checkedTitles.has(key));
    if (!uncachedTitles.length) continue;
    const params = new URLSearchParams({
      action: 'query',
      titles: uncachedTitles.map(({ title }) => title).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '1280',
      format: 'json'
    });
    console.log(`Checking Commons metadata ${Math.floor(start / 50) + 1}/${batchCount}.`);
    const data = await fetchJson(`${commonsApi}?${params}`, 'Wikimedia Commons metadata request');

    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const metadata = info.extmetadata || {};
      const license = metadata.LicenseShortName?.value?.trim() || '';
      const licenseUrl = metadata.LicenseUrl?.value?.trim() || '';
      const imageUrl = info.thumburl || info.url;
      if (!imageUrl || !info.descriptionurl || !license || !/^https?:\/\//.test(licenseUrl)) continue;
      if (!/^(CC BY(?:-SA)? [0-9.]+|CC0|GODL-India|Public domain)$/i.test(license)) continue;
      if (!/^https:\/\/(thumb\.wikimedia\.org|upload\.wikimedia\.org)\//.test(imageUrl)) continue;
      if (!/^https:\/\/commons\.wikimedia.org\/wiki\/File:/.test(info.descriptionurl)) continue;

      const artist = decodeHtml(metadata.Artist?.value || 'Unknown author').trim();
      images.set(normalizeImageTitle(page.title), {
        image_url: imageUrl,
        image_attribution: artist || 'Unknown author',
        image_license: license,
        image_license_url: licenseUrl,
        image_source_url: info.descriptionurl
      });
    }
    for (const { key } of uncachedTitles) checkedTitles.add(key);
    await fs.writeFile(
      photoCachePath,
      `${JSON.stringify({
        version: 1,
        images: Object.fromEntries(images),
        checkedTitles: [...checkedTitles]
      })}\n`,
      'utf8'
    );
    console.log(`Checked Commons photo metadata ${Math.min(start + batch.length, titles.length)}/${titles.length}.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return sites.flatMap((site) => {
    const image = images.get(normalizeImageTitle(site.image_file));
    if (!image) return [];
    return [{ ...site, ...image }];
  });
}

async function main() {
  const existing = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const currentKeys = new Set(existing.map((site) => `${normalizeText(site.location.state)}:${normalizeText(site.temple_name)}`));
  let nextRegion = 0;
  const regionSites = new Array(regions.length);
  const queryFailures = [];
  let cachedRegions = {};
  try {
    const cache = JSON.parse(await fs.readFile(cachePath, 'utf8'));
    if (cache.version === 1 && cache.regions && typeof cache.regions === 'object') {
      cachedRegions = Object.fromEntries(Object.entries(cache.regions).map(([state, sites]) => [
        state,
        Array.isArray(sites) ? sites.map(religionForSite) : sites
      ]));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let cacheWrite = Promise.resolve();

  async function worker() {
    while (true) {
      const index = nextRegion++;
      if (index >= regions.length) return;
      const [state] = regions[index];
      if (Array.isArray(cachedRegions[state])) {
        regionSites[index] = cachedRegions[state];
        console.log(`Loaded ${regionSites[index].length} cached sites for ${state}.`);
        continue;
      }
      try {
        regionSites[index] = await fetchRegionSites(regions[index]);
        console.log(`Found ${regionSites[index].length} photo-indexed worship sites for ${state}.`);
        cachedRegions[state] = regionSites[index];
        cacheWrite = cacheWrite.then(() => fs.writeFile(
          cachePath,
          `${JSON.stringify({ version: 1, regions: cachedRegions })}\n`,
          'utf8'
        ));
        await cacheWrite;
      } catch (error) {
        console.error(`Could not retrieve sites for ${state}: ${error.message}`);
        queryFailures.push(state);
        regionSites[index] = [];
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  await Promise.all(Array.from({ length: 3 }, worker));
  await cacheWrite;
  if (queryFailures.length) {
    throw new Error(`Catalog build stopped because these region queries failed: ${queryFailures.join(', ')}.`);
  }
  const candidates = [];
  for (const sites of regionSites) {
    const faithGroups = new Map();
    for (const site of sites) {
      if (/\bgroup\s*\(?\d+\)?\b/i.test(site.temple_name)) continue;
      if (currentKeys.has(`${normalizeText(site.location.state)}:${normalizeText(site.temple_name)}`)) continue;
      if (!faithGroups.has(site.religion)) faithGroups.set(site.religion, []);
      faithGroups.get(site.religion).push(site);
    }
    const selected = [];
    const groups = [...faithGroups.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([, group]) => group);
    while (selected.length < candidateSitesPerRegion && groups.some((group) => group.length)) {
      for (const group of groups) {
        if (selected.length >= candidateSitesPerRegion) break;
        const site = group.shift();
        if (site) selected.push(site);
      }
    }
    candidates.push(...selected);
  }

  const verifiedSites = await fetchCommonsMetadata([
    ...existing.map(enrichExisting),
    ...candidates
  ]);
  const catalog = [];
  const seen = new Set();
  const regionCounts = new Map();
  for (const site of verifiedSites) {
    const key = `${normalizeText(site.location.state)}:${normalizeText(site.temple_name)}`;
    if (seen.has(key)) continue;
    const count = regionCounts.get(site.location.state) || 0;
    if (count >= maximumSitesPerRegion) continue;
    seen.add(key);
    regionCounts.set(site.location.state, count + 1);
    catalog.push(site);
  }

  const newSiteCount = catalog.length - existing.length;
  if (catalog.length <= 250) {
    throw new Error(`Only ${catalog.length} verified records were found; refusing to write a catalog of 250 or fewer.`);
  }

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await fs.rm(cachePath, { force: true });
  await fs.rm(photoCachePath, { force: true });

  const counts = new Map();
  for (const site of catalog) {
    counts.set(site.location.state, (counts.get(site.location.state) || 0) + 1);
  }
  console.log(`Wrote ${catalog.length} records, including ${newSiteCount} newly verified sites.`);
  for (const [state, , kind] of regions) {
    const count = counts.get(state) || 0;
    if (kind === 'state' && count < minimumSitesPerState) {
      console.log(`Below ${minimumSitesPerState} verified sites: ${state} (${count}).`);
    }
  }
  const faithCounts = new Map();
  for (const site of catalog) {
    faithCounts.set(site.religion, (faithCounts.get(site.religion) || 0) + 1);
  }
  console.log(`Faith labels: ${[...faithCounts].map(([faith, count]) => `${faith} (${count})`).join(', ')}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
