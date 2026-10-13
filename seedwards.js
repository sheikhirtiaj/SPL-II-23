const fs = require("fs");
const pool = require("./config/db");

async function seedWards() {
  try {
    const rawData = fs.readFileSync("./dhaka_wards.geojson", "utf-8");
    const geojsonData = JSON.parse(rawData);

    console.log(
      `Found ${geojsonData.features.length} features. Starting ward import...`
    );

    let inserted = 0;
    let skipped = 0;

    for (const feature of geojsonData.features) {
      const props = feature.properties || {};

      // Try common ward-number property names
      const rawWardNumber =
        props.ward_number ??
        props.ward_no ??
        props.WARD_NO ??
        props.WARD ??
        props.Ward ??
        null;

      let wardNumber = null;

      if (rawWardNumber !== null) {
        const match = String(rawWardNumber).match(/\d+/);

        if (match) {
          wardNumber = Number(match[0]);
        }
      }

      // Try common corporation fields
      let corporationCode =
        props.corporation_code ??
        props.corp_code ??
        props.CORPORATION ??
        props.city_corporation ??
        null;

      // If source uses descriptive names
      const adminName = String(
        props.Admin_Name ??
        props.admin_name ??
        props.corporation ??
        ""
      ).toLowerCase();

      if (!corporationCode) {
        if (
          adminName.includes("north") ||
          adminName.includes("dncc") ||
          adminName.includes("উত্তর")
        ) {
          corporationCode = "DNCC";
        } else if (
          adminName.includes("south") ||
          adminName.includes("dscc") ||
          adminName.includes("দক্ষিণ")
        ) {
          corporationCode = "DSCC";
        }
      }

      corporationCode = corporationCode
        ? String(corporationCode).toUpperCase()
        : null;

      if (!wardNumber) {
        console.log("Skipped feature: missing valid ward number");
        skipped++;
        continue;
      }

      if (!["DNCC", "DSCC"].includes(corporationCode)) {
        console.log(
          `Skipped Ward ${wardNumber}: corporation could not be identified`
        );
        skipped++;
        continue;
      }

      if (!feature.geometry) {
        console.log(
          `Skipped ${corporationCode} Ward ${wardNumber}: missing geometry`
        );
        skipped++;
        continue;
      }

      if (
        feature.geometry.type !== "Polygon" &&
        feature.geometry.type !== "MultiPolygon"
      ) {
        console.log(
          `Skipped ${corporationCode} Ward ${wardNumber}: invalid geometry type`
        );
        skipped++;
        continue;
      }

      const geometryString = JSON.stringify(feature.geometry);

      const query = `
        INSERT INTO wards
        (
          corporation_code,
          ward_number,
          boundaries
        )
        VALUES
        (
          $1,
          $2,
          ST_Multi(
            ST_SetSRID(
              ST_GeomFromGeoJSON($3::text),
              4326
            )
          )
        )
        ON CONFLICT (corporation_code, ward_number)
        DO NOTHING
      `;

      const result = await pool.query(query, [
        corporationCode,
        wardNumber,
        geometryString,
      ]);

      if (result.rowCount === 1) {
        inserted++;

        console.log(
          `Inserted ${corporationCode} Ward ${wardNumber}`
        );
      }
    }

    console.log("----------------------------");
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped: ${skipped}`);
    console.log("----------------------------");

  } catch (error) {
    console.error("Ward seeding error:", error);
  } finally {
    await pool.end();
  }
}

seedWards();