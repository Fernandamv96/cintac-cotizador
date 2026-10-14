// Regenera db/schema.sql a partir de db/schema.js (para adjuntarlo al informe).
import { writeFileSync } from "node:fs";
import { SCHEMA_SQL } from "./schema.js";

writeFileSync(new URL("./schema.sql", import.meta.url), SCHEMA_SQL.trimStart());
console.log("db/schema.sql actualizado");
