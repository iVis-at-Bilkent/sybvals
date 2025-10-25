// batch_process.js
const fs  = require("fs");
const path  = require( "path");
const fetch = require("node-fetch");
const FormData = require("form-data");

// === CONFIGURATION ===
const SERVER_URL = "http://localhost:3400/validation?showResolutionAlternatives = false"  + "&generateErrors=true";  // Change this to your endpoint
const SERVER_URL_RESOLVE = "http://localhost:3400/fixError?showResolutionAlternatives=false";  // Change this to your endpoint
const FILES_DIR = "./samples";                                // Folder with 15 input files
const OUTPUT_DIR = "./results";                            // Folder to save responses

// === CREATE OUTPUT FOLDER IF NEEDED ===
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}


function formatErrors(errors) {
  if (!errors || errors.length === 0) return "✅ No errors detected.";

  
  return errors
  .map((err) => {
    return [
      `Error #${err.errorNo ?? "?"}`,
      `Text: ${typeof err.text === "string" ? err.text.trim() : String(err.text || "").trim()}`,
      `Pattern: ${err.pattern ?? ""}`,
      `Role: ${err.role ?? ""}`,
      `Label: ${err.label ?? ""}`,
      `Status: ${err.status ?? ""}`,
      `Explanation: ${err.explanation ?? ""}`,
      `Color: ${err.colorCode ?? ""}`,
      `Option: ${err.selectedOption ?? ""}`,
      "----------------------------------------"
    ].join("\n");
  })
  .join("\n");
}

async function processFile(filePath, fileName) {

  try {
    let formData = fs.readFileSync(filePath, "utf-8");

    console.log(`📤 Uploading ${fileName}...`);
    //console.log( formData);
    let data = formData;
    let options = {
		imageOptions: {
            format: 'png',
            background: 'transparent',
            width: 1280,
            height: 720,
            color: 'greyscale',
            highlightColor: '#ff0000',
            highlightWidth: 10,
            autoSize: true
		}
	};
	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: data + JSON.stringify( options )
	};
	let res = await fetch(SERVER_URL, settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log( e);
		});
    const settingsForResolve = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'text/plain'
      },
      body: res.sbgn + JSON.stringify(res.errors) + JSON.stringify( options )
    };
    let resForResolve = await fetch(SERVER_URL_RESOLVE, settingsForResolve)
      .then(response => response.json())
      .then(result => {
        return result;
      })
      .catch(e => {
        console.log( e);
      });
  

    /*const response = await fetch(SERVER_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server responded ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();*/

    //console.log( resForResolve.errors );
   // console.log( res.sbgn );
    
    
    const sbgnOutputPath = path.join(
      OUTPUT_DIR,
      `${path.basename(fileName, ".sbgn")}_response.sbgn`
    );
    fs.writeFileSync(sbgnOutputPath, resForResolve.sbgn);
    console.log(`🧬 Saved processed SBGN → ${sbgnOutputPath}`);

    // ✅ Write the errors (if any)
    const errorOutputPath = path.join(
      OUTPUT_DIR,
      `${path.basename(fileName, ".sbgn")}_errors.txt`
    );
    let errors = resForResolve.errors;
    const errorText = formatErrors( errors );
        fs.writeFileSync(errorOutputPath, errorText);
        const header = `\n=== Errors from ${fileName} ===\n`;
    console.log(`⚠️ Saved error report → ${errorOutputPath}`);

    const errorCounter = {};
    for (const err of errors) {
      const message = err.pattern || "Unknown error";
      errorCounter[message] = {total : (errorCounter[message]?.total || 0) + 1, unsolved : (errorCounter[message]?.unsolved || 0) + (err.status == "solved" ? 0 : 1 )};
    }

   /* // ✅ Build summary lines
    const summaryLines =
      Object.keys(errorCounter).length > 0
        ? Object.entries(errorCounter)
            .map(([errorText, count]) => `${count.total} × ${errorText} ${count.unsolved} × ${errorText}`)
            .join("\n")
        : "No errors found ✅";

    // ✅ Write to per-file summary file
    const summaryFile = path.join(
      OUTPUT_DIR,
      `errors_${path.basename(fileName, ".sbgn")}_summary.txt`
    );
    fs.writeFileSync(summaryFile, summaryLines);*/

  

    console.log(`✅ Processed ${fileName} → ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error.message);
  }
}

async function main() {
  console.log("🚀 Starting batch processing...");
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  } else {
    const oldFiles = fs.readdirSync(OUTPUT_DIR);
    for (const file of oldFiles) {
      const filePath = path.join(OUTPUT_DIR, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }

  const allFiles = fs.readdirSync(FILES_DIR)
    .filter(f => fs.lstatSync(path.join(FILES_DIR, f)).isFile())
    .slice(0, 15); // process only first 15 files

  if (allFiles.length === 0) {
    console.error("❌ No files found in", FILES_DIR);
    return;
  }

  for (const fileName of allFiles) {
    const filePath = path.join(FILES_DIR, fileName);
    await processFile(filePath, fileName);
  }

  console.log("🎉 All files processed successfully!");
}
}

main()