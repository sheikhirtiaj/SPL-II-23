const fs = require("fs");
const path = require("path");
const pool = require("./config/db");

async function seedWards() {
  try {
    const geojsonPath = path.join(__dirname, "dhaka_wards.geojson");
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));
    console.log(`Found ${geojsonData.features.length} features. Starting ward import...`);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const feature of geojsonData.features) {
      const props = feature.properties || {};
      const rawWardNumber = props.ward_number ?? props.ward_no ?? props.WARD_NO ?? props.WARD ?? props.Ward ?? null;
      const match = rawWardNumber === null ? null : String(rawWardNumber).match(/\d+/);
      const wardNumber = match ? Number(match[0]) : null;

      let corporationCode = props.corporation_code ?? props.corp_code ?? props.CORPORATION ?? props.city_corporation ?? null;
      const adminName = String(props.Admin_Name ?? props.admin_name ?? props.corporation ?? "").toLowerCase();

      if (!corporationCode) {
        if (adminName.includes("north") || adminName.includes("dncc") || adminName.includes("উত্তর")) corporationCode = "DNCC";
        else if (adminName.includes("south") || adminName.includes("dscc") || adminName.includes("দক্ষিণ")) corporationCode = "DSCC";
      }

      corporationCode = corporationCode ? String(corporationCode).toUpperCase() : null;
      const isIutCampus = corporationCode === "IUT" && props.location_type === "campus_demo_buffer" && Number(wardNumber) === 1;

      if (!wardNumber || (!["DNCC", "DSCC"].includes(corporationCode) && !isIutCampus) || !feature.geometry) {
        skipped++;
        continue;
      }
      if (!["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
        skipped++;
        continue;
      }

      const conflictAction = isIutCampus
        ? "DO UPDATE SET boundaries = EXCLUDED.boundaries"
        : "DO NOTHING";

      const sql = `
        INSERT INTO wards (corporation_code, ward_number, boundaries)
        VALUES (
          $1, $2,
          ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3::text), 4326))
        )
        ON CONFLICT (corporation_code, ward_number) ${conflictAction}
      `;

      const result = await pool.query(sql, [
        corporationCode,
        wardNumber,
        JSON.stringify(feature.geometry)
      ]);

      if (result.rowCount === 1) {
        if (isIutCampus) {
          updated++;
          console.log("Inserted/updated IUT demo coverage zone (IUT Ward 1)");
        } else {
          inserted++;
          console.log(`Inserted ${corporationCode} Ward ${wardNumber}`);
        }
      }
    }

    console.log("----------------------------");
    console.log(`Inserted city wards: ${inserted}`);
    console.log(`Inserted/updated IUT demo zone: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log("----------------------------");
  } catch (error) {
    console.error("Ward seeding error:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
seedWards();
