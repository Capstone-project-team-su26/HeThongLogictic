/**
 * Soát barrel của mọi feature.
 *
 * Hai lỗi chỉ lộ ra lúc chạy chứ không làm hỏng build, nên cần kiểm bằng máy:
 *
 *  1. `export *` từ hai module cùng đưa ra một tên -> ESM biến tên đó thành
 *     undefined một cách âm thầm. Import nó về sẽ ra undefined, và component
 *     chỉ nổ khi người dùng bấm đúng nút gọi nó.
 *  2. Barrel re-export một tên mà module đích không hề có -> cũng ra undefined.
 *
 * Script nạp thật từng barrel qua Vite (để alias @features/... hoạt động) rồi
 * kiểm mọi tên xuất ra có khác undefined không, đồng thời liệt kê các tên trùng
 * giữa các feature để biết chỗ nào không được gộp bằng `export *`.
 *
 *   node tools/verify-barrels.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FEATURES_DIR = path.join(ROOT, "src", "features");

const features = fs
  .readdirSync(FEATURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const server = await createServer({
  configFile: path.join(ROOT, "vite.config.js"),
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

const problems = [];
const exportsByFeature = new Map();
let totalNames = 0;

for (const feature of features) {
  const barrel = path.join(FEATURES_DIR, feature, "index.js");

  if (!fs.existsSync(barrel)) {
    problems.push(`THIẾU BARREL  src/features/${feature}/index.js`);
    continue;
  }

  let mod;
  try {
    mod = await server.ssrLoadModule(`/src/features/${feature}/index.js`);
  } catch (error) {
    problems.push(
      `KHÔNG NẠP ĐƯỢC  ${feature}: ${String(error.message).split("\n")[0]}`
    );
    continue;
  }

  const names = Object.keys(mod);
  const dead = names.filter((name) => mod[name] === undefined);

  for (const name of dead) {
    problems.push(
      `UNDEFINED     ${feature}.${name}  (trùng tên giữa hai "export *", hoặc module đích không có tên này)`
    );
  }

  exportsByFeature.set(feature, new Set(names));
  totalNames += names.length;
}

await server.close();

/* Tên trùng giữa các feature: không phải lỗi, nhưng là chỗ cấm gộp bằng export *. */
const seen = new Map();
for (const [feature, names] of exportsByFeature) {
  for (const name of names) {
    if (name === "default") continue;
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push(feature);
  }
}
const collisions = [...seen.entries()]
  .filter(([, owners]) => owners.length > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log(`barrel kiểm tra : ${exportsByFeature.size}/${features.length}`);
console.log(`tên xuất ra     : ${totalNames}`);

if (collisions.length) {
  console.log(
    `\ntên trùng giữa các feature (${collisions.length}) — KHÔNG được gộp bằng "export *", phải đặt alias:`
  );
  for (const [name, owners] of collisions) {
    console.log(`  ${name}  <-  ${owners.join(", ")}`);
  }
}

if (problems.length) {
  console.log(`\n${problems.length} VẤN ĐỀ:`);
  for (const problem of problems) console.log("  " + problem);
  process.exit(1);
}

console.log("\nMọi barrel nạp được, không tên nào là undefined.");
