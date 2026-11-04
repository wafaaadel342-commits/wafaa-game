const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputPublic = path.join(root, ".output", "public");
const distDir = path.join(root, "dist");

try {
  if (fs.existsSync(outputPublic)) {
    // Remove existing dist if any
    fs.rmSync(distDir, { recursive: true, force: true });
    // Copy .output/public -> dist
    fs.cpSync(outputPublic, distDir, { recursive: true });

    // Ensure 404.html exists for SPA fallback routing on static hosts
    const indexHtml = path.join(distDir, "index.html");
    const notFoundHtml = path.join(distDir, "404.html");
    if (fs.existsSync(indexHtml) && !fs.existsSync(notFoundHtml)) {
      fs.copyFileSync(indexHtml, notFoundHtml);
    }

    console.log(
      `[build] Successfully populated dist/ directory (${fs.readdirSync(distDir).length} entries).`,
    );
  } else {
    console.warn(`[build] .output/public not found at ${outputPublic}`);
  }
} catch (err) {
  console.error("[build] Failed to populate dist/:", err);
}
