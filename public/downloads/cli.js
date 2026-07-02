#!/usr/bin/env node
/*
 * CLI: node cli.js <input.sb3> [output.xml]
 *
 * Requires: npm install jszip
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { convert } = require("./converter.js");

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    console.log("Usage: node cli.js <input.sb3> [output.xml]");
    process.exit(args.length === 0 ? 1 : 0);
  }
  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.sb3?$/i, "") + ".xml";

  if (!fs.existsSync(inputPath)) {
    console.error("Input not found: " + inputPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(inputPath);
  // Copy into a fresh ArrayBuffer so JSZip is happy.
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const { xml, warnings } = await convert(ab);
  fs.writeFileSync(outputPath, xml, "utf8");

  console.log("Wrote " + outputPath + " (" + Math.round(xml.length / 1024) + " KB)");
  if (warnings.length) {
    console.log("Unconverted opcodes: " + warnings.join(", "));
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
