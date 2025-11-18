const  {GoogleGenAI} = require("@google/genai");

// 1. --- Initialization and Prompt Template ---

// Initialize the client. It automatically uses the GEMINI_API_KEY environment variable.
const ai = new GoogleGenAI({apiKey : "AIzaSyDcC7R7DzrtIww7B1SHqgGbfrgl-7lEtK8"});

// The comprehensive prompt template function
const getSBGNFixPrompt = (errorDataString) => {
  return `
    You are an **expert Systems Biology Graphical Notation (SBGN)** validator specializing in the Process Description (PD) language. Your task is to analyze a single SBGN validation error and recommend the most optimal fix from the available candidates, or specify a superior structural fix if candidates are insufficient.

    --- SBGN PD Core Connectivity Rules ---
    1.  **Consumption Arc:** Must be connected from an **Entity Pool Node (EPN)** $\rightarrow$ **Process Node (PN) Port**.
    2.  **Production Arc:** Must be connected from a **Process Node (PN) Port** $\rightarrow$ **Entity Pool Node (EPN)**.
    3.  **Modulation Arcs (e.g., Catalysis):** Must be connected from an **EPN** $\rightarrow$ the **PN** itself.

    --- Fix Prioritization Logic ---
    When an arc's class contradicts its structural connectivity:
    * **Priority 1 (Highest Confidence):** **Reverse the arc direction** (swap source and target) while **preserving the original arc class**.
    * **Priority 2:** Select the best provided fix candidate.

    --- Database and Pathway Convention Context ---
    For semantic fixes, align recommendations with best practices used by major pathway databases (Reactome/KEGG).

    --- Input Error Data ---
    The following array contains all the validation errors detected:
     ${errorDataString}

    --- Task ---
    1. Select the best fix based on the 'Fix Prioritization Logic'.
    2. Determine the 'confidence' (**Very High**, **High**, **Medium**).

  Output ONLY a **JSON Array** of objects. Each object in the array must correspond to one input error and contain the recommended fix, justification, and confidence.

**JSON Output Structure (Array of Objects):**
[
    {
      "errorNo": 1, // Must match the input errorNo
      "recommended_fix_action": "A clear description of the fix.",
      "recommended_candidate_id": "ID of selected candidate or null.",
      "justification": "Brief justification citing the SBGN rule.",
      "confidence": "Very High"
    },
    // ... continues for all errors ...
]
    `;
};


// 2. --- Core Request Function ---

async function recommendSBGNFix(errorData) {
    const errorDataString = JSON.stringify(errorData, null, 2);
    const prompt = getSBGNFixPrompt(errorDataString);

    console.log("Sending request to Gemini API...");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Fast and capable model for reasoning tasks
            contents: prompt,
            config: {
                responseMimeType: "application/json" // Crucial for guaranteed JSON output
            }
        });

        // The response text is a JSON string due to responseMimeType
        const jsonResponse = JSON.parse(response.text.trim());
        return jsonResponse;

    } catch (error) {
        console.error("❌ Gemini API Error:", error.message);
        return { error: "Failed to get fix recommendation." };
    }
}


// 3. --- Example Execution ---

const exampleErrorData = [
    {
      text: 'The source and sink glyph can be connected to at most one consumption glyph \n',
      pattern: 'pd10103',
      role: 'glyph8',
      errorNo: 1,
      label: 'source and sink',
      colorCode: '#ff0000',
      selectedOption: 'default',
      status: 'unsolved',
      fixCandidate: []
    },
    {
      text: 'The association glyph can only be connected to one production glyph \n',
      pattern: 'pd10108',
      role: 'glyph9',
      errorNo: 2,
      label: 'association',
      colorCode: '#b0b000',
      selectedOption: 0,
      status: 'unsolved',
      fixCandidate: [ [Object], [Object] ]
    },
    {
      text: 'Arc with class logic arc must have target reference to  a logical operator\n',
      pattern: 'pd10125',
      role: 'nwtE_d8e46d18-1136-4c52-8ff6-2685ef599cf1',
      errorNo: 3,
      label: 'IRF1 - ',
      colorCode: '#006400',
      selectedOption: 0,
      status: 'unsolved',
      fixCandidate: [ [Object] ]
    },
    {
      text: 'Logic arc must be connected to an AND, OR or NOT operator\n',
      pattern: 'pd10142',
      role: 'nwtE_d8e46d18-1136-4c52-8ff6-2685ef599cf1',
      errorNo: 4,
      label: 'IRF1 - ',
      colorCode: '#006400',
      selectedOption: 'default',
      status: 'unsolved',
      fixCandidate: []
    }
  ]

recommendSBGNFix(exampleErrorData).then(result => {
    console.log("\n✅ Recommended Fix (JSON Output):");
    console.log(JSON.stringify(result, null, 2));
});