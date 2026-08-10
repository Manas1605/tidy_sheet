/**
 * End-to-end pipeline smoke test (no server, no real Groq key needed).
 *
 * Runs the exact parse -> validate -> applyPlan -> unparse pipeline the
 * real app uses against 4 varied hand-crafted "messy CSV" scenarios
 * (leads, Shopify orders, recruiting candidates, a CRM export), each with
 * a realistic plan of the kind the AI should return for a natural
 * instruction. Also checks that a plan referencing hallucinated
 * columns/operations gets safely filtered by validatePlan before it ever
 * reaches applyPlan — the same safety boundary app/api/clean/route.ts
 * relies on.
 *
 * Run with: npx tsx sample-data/pipeline.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { applyPlan, validatePlan, type PlanStep } from "../lib/operations";

let failures = 0;

function check(label: string, pass: boolean) {
  console.log(`${pass ? "PASS" : "FAIL"} - ${label}`);
  if (!pass) failures++;
}

function loadCsv(filename: string) {
  const csvText = fs.readFileSync(path.join(__dirname, filename), "utf-8");
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  return { columns: parsed.meta.fields ?? [], rows: parsed.data };
}

function runScenario(
  label: string,
  filename: string,
  plan: PlanStep[],
  assertions: (rows: Record<string, unknown>[], startCount: number) => void
) {
  console.log(`\n=== ${label} (${filename}) ===`);
  const { columns, rows } = loadCsv(filename);

  // Every plan first passes through the same validation the API route
  // applies to the AI's raw response, proving the two stay in sync.
  const validated = validatePlan(plan, columns);
  check(`${label}: all plan steps validate against real columns`, validated.length === plan.length);

  const { rows: cleaned, changedColumns } = applyPlan(rows, validated);
  console.log(`  columns: ${columns.join(", ")}`);
  console.log(`  changed columns: ${[...changedColumns].join(", ")}`);
  console.log(`  rows: ${rows.length} -> ${cleaned.length}`);
  assertions(cleaned as Record<string, unknown>[], rows.length);
}

// --- Scenario 1: leads (messy_leads.csv) ---
runScenario(
  "Leads",
  "messy_leads.csv",
  [
    { column: "full name", operation: "trim_whitespace" },
    { column: "full name", operation: "title_case" },
    { column: "phone", operation: "format_phone_us" },
    { column: "email_address", operation: "flag_invalid_email" },
    { column: "address", operation: "extract_zip" },
    { column: "email_address", operation: "remove_duplicates" },
  ],
  (rows, start) => {
    check("Leads: dedupe removes the duplicate John Smith row", rows.length === start - 1);
    check("Leads: name is trimmed + title-cased", rows[0]["full name"] === "John Smith");
    check("Leads: bad email flagged", String(rows[1]["email_address"]).startsWith("INVALID: "));
    check("Leads: zip extracted from address", rows[0]["address"] === "62704");
  }
);

// --- Scenario 2: Shopify orders (case-insensitive email dedupe + mixed
//     whitespace in the name column) ---
runScenario(
  "Shopify orders",
  "shopify_orders.csv",
  [
    { column: "customer name", operation: "trim_whitespace" },
    { column: "customer name", operation: "title_case" },
    { column: "customer email", operation: "lowercase" },
    { column: "customer email", operation: "flag_invalid_email" },
    { column: "phone number", operation: "format_phone_us" },
    { column: "customer email", operation: "remove_duplicates" },
  ],
  (rows, start) => {
    check("Orders: dedupe removes the repeat Jane Doe order", rows.length === start - 1);
    check("Orders: name trimmed + title-cased", rows[0]["customer name"] === "Jane Doe");
    check(
      "Orders: malformed email (no TLD) flagged",
      String(rows.find((r) => r["customer name"] === "Mark Stein")?.["customer email"]).startsWith(
        "INVALID: "
      )
    );
    check(
      "Orders: dotted phone reformatted",
      rows.find((r) => r["customer name"] === "Anna Lee")?.["phone number"] === "(303) 555-0177"
    );
  }
);

// --- Scenario 3: recruiter candidates ---
runScenario(
  "Recruiter candidates",
  "recruiter_candidates.csv",
  [
    { column: "candidate", operation: "trim_whitespace" },
    { column: "candidate", operation: "title_case" },
    { column: "contact email", operation: "flag_invalid_email" },
    { column: "cell", operation: "format_phone_us" },
    { column: "contact email", operation: "remove_duplicates" },
  ],
  (rows, start) => {
    check("Candidates: dedupe removes repeat Sam Okonkwo", rows.length === start - 1);
    check(
      "Candidates: missing-TLD email flagged",
      String(rows.find((r) => r["candidate"] === "Derek Chu")?.["contact email"]).startsWith(
        "INVALID: "
      )
    );
    check(
      "Candidates: unparseable phone left unchanged",
      rows.find((r) => r["candidate"] === "Priya Patel")?.["cell"] === "not a number"
    );
  }
);

// --- Scenario 4: CRM export ---
runScenario(
  "CRM export",
  "crm_export.csv",
  [
    { column: "Contact Name", operation: "trim_whitespace" },
    { column: "Contact Name", operation: "title_case" },
    { column: "Contact Email", operation: "flag_invalid_email" },
    { column: "Phone", operation: "format_phone_us" },
    { column: "Zip Extract Source", operation: "extract_zip" },
    { column: "Contact Email", operation: "remove_duplicates" },
  ],
  (rows, start) => {
    check("CRM: dedupe removes repeat Tom Baker", rows.length === start - 1);
    check(
      "CRM: address-only column reduced to a 5-digit zip",
      rows.find((r) => r["Contact Name"] === "Lena Fox")?.["Zip Extract Source"] === "92101"
    );
    check(
      "CRM: email missing a TLD is flagged",
      String(rows.find((r) => r["Contact Name"] === "Lena Fox")?.["Contact Email"]).startsWith(
        "INVALID: "
      )
    );
  }
);

// --- Scenario 5: safety check — a plan with a hallucinated column and an
//     unknown operation, exactly the kind of bad response a model could
//     return. validatePlan must filter it down to only the real step. ---
console.log("\n=== Safety: hallucinated plan gets filtered ===");
{
  const { columns } = loadCsv("messy_leads.csv");
  const hallucinated = [
    { column: "full name", operation: "title_case" }, // real
    { column: "social_security_number", operation: "title_case" }, // fake column
    { column: "phone", operation: "delete_everything" }, // fake operation
  ];
  const validated = validatePlan(hallucinated, columns);
  check("Safety: only the one real, valid step survives validation", validated.length === 1);
  check(
    "Safety: the surviving step is the real one, not a hallucinated one",
    validated[0]?.column === "full name" && validated[0]?.operation === "title_case"
  );
}

console.log(failures === 0 ? "\nAll scenarios passed." : `\n${failures} check(s) failed.`);
if (failures > 0) process.exitCode = 1;
