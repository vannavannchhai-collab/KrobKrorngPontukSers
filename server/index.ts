import "./env.js";
import { createApp } from "./app.js";
import { initSchema } from "./db.js";
import { getGoogleConfig } from "./google.js";

const PORT = Number(process.env.PORT ?? 4173);

await initSchema();

const app = createApp();

app.listen(PORT, "0.0.0.0", async () => {
  const google = await getGoogleConfig();
  console.log(`🚀 ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស ដំណើរការ http://0.0.0.0:${PORT}`);
  console.log(
    google.enabled
      ? `   Google OAuth: បានបើក (${google.source === "env" ? "environment variables" : "ការកំណត់ក្នុងប្រព័ន្ធ"})`
      : "   Google OAuth: មិនទាន់បើក — កំណត់នៅ ការកំណត់ → ព័ត៌មានសាលា",
  );
  console.log(
    process.env.TURSO_DATABASE_URL
      ? "   Database: libSQL / Turso (remote)"
      : `   Database: SQLite file (${process.env.DB_PATH ?? "data/school.db"})`,
  );
});
