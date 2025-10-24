// combine_to_excel_4slash0.js
const fs = require( "fs" );
const path = require ("path");
const  XLSX = require( "xlsx" ); // run: npm install xlsx

const RESULTS_DIR = "./results";
const OUTPUT_FILE = path.join(RESULTS_DIR, "error_summary2.xlsx");

// 🔍 Parse each summary file into { code: "4/0", ... }
function parseSummaryFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();
  const lines = content.split("\n").map(line => line.trim()).filter(Boolean);

  const data = {};

  for (const line of lines) {
    // Matches patterns like: "4 × pd10102 0 × pd10102"
    // or "4 x pd10102 0 x pd10102"
    const matches = [...line.matchAll(/(\d+)\s*[×x]\s*([A-Za-z0-9]+)/g)];
    if (matches.length === 1) {
      const [, count, code] = matches[0];
      data[code] = `${count}/0`; // only one number found
    } else if (matches.length >= 2) {
      // Take first two as total and resolved
      const [, count1, code1] = matches[0];
      const [, count2, code2] = matches[1];
      // ensure same code for both parts
      const code = code1 === code2 ? code1 : `${code1}_${code2}`;
      data[code] = `${count1}/${count2}`;
    }
  }

  return data;
}

function main() {
  console.log("📊 Combining per-file summaries into Excel (4/0 format)...");

  const summaryFiles = fs
    .readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith("errors_") && f.endsWith("_summary.txt"));

  if (summaryFiles.length === 0) {
    console.error("❌ No summary files found in", RESULTS_DIR);
    return;
  }

  // Collect all unique error codes
  const allCodes = new Set();
  const fileSummaries = {};

  for (const file of summaryFiles) {
    const filePath = path.join(RESULTS_DIR, file);
    const data = parseSummaryFile(filePath);
    fileSummaries[file] = data;
    Object.keys(data).forEach(code => allCodes.add(code));
  }

  const codes = Array.from(allCodes).sort();

  // Build table for Excel
  const rows = [
    ["File", ...codes], // header
    ...summaryFiles.map(file => {
      const row = [file];
      const data = fileSummaries[file];
      for (const code of codes) {
        row.push(data[code] || "0/0");
      }
      return row;
    }),
  ];

  // Convert to worksheet & workbook
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Error Summary");

  XLSX.writeFile(workbook, OUTPUT_FILE);
  console.log(`✅ Excel summary created → ${OUTPUT_FILE}`);
}

main();
