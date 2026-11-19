# Backend

## Build the places-of-worship catalog

The catalog is stored in `data/temples.json` and served through the existing
`/api/temples` endpoints. Records include a site type, faith/tradition,
Wikidata source link, and Wikimedia Commons image attribution and license.
The existing `temple_name` and `deity` field names remain for API compatibility.

From `BACK_END/`, run:

```powershell
npm run build:catalog
```

The builder retrieves photo-indexed worship sites for India's 28 states and
eight Union Territories from Wikidata, verifies each photo's Commons license,
and writes the resulting records to `data/temples.json`. It keeps the existing
curated records and caps the catalog at 35 records per region. States with
fewer than 25 verified photos remain below that target; the builder reports
those counts instead of inventing entries or photo associations.
If interrupted, regional query results and verified photo metadata are kept in
hidden cache files under `data/` so the build can resume; a successful build
removes those caches.

## Replace the MongoDB catalog

After reviewing the generated catalog, seed MongoDB only when a valid
`MONGODB_URI` is configured in `.env`:

```powershell
$env:REPLACE_TEMPLE_DATA = "1"
npm run seed:temples
Remove-Item Env:\REPLACE_TEMPLE_DATA
```

Seeding validates the catalog's Commons photo URLs, attribution, and supported
license metadata before replacing the MongoDB `temples` collection. The
builder verifies this metadata directly with Commons. Seeding does not replace
local image files; catalog photos are served from Wikimedia's image host. The
confirmation environment variable is required because replacement removes
records not present in the JSON file. User accounts and sessions are not
modified.
