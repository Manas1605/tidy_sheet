/**
 * Manual/lightweight test cases for lib/operations.ts.
 *
 * This project has no test runner configured (kept out of scope per the
 * v1 spec), so this file is a plain script you can run directly with:
 *   npx tsx lib/operations.test.ts
 * It throws on the first failing assertion so problems are obvious.
 */
import {
  title_case,
  trim_whitespace,
  format_phone_us,
  flag_invalid_email,
  extract_zip,
  remove_duplicates,
  lowercase,
  uppercase,
  validatePlan,
  applyPlan,
} from "./operations";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} - ${label}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}

// title_case
assertEqual(title_case("john smith"), "John Smith", "title_case basic");
assertEqual(title_case(""), "", "title_case empty string");
assertEqual(title_case(null), "", "title_case null");
assertEqual(title_case("mary-jane o'brien"), "Mary-Jane O'Brien", "title_case hyphen/apostrophe");

// trim_whitespace
assertEqual(trim_whitespace("  hello   world  "), "hello world", "trim_whitespace collapses + trims");
assertEqual(trim_whitespace(""), "", "trim_whitespace empty string");
assertEqual(trim_whitespace(undefined), "", "trim_whitespace undefined");

// format_phone_us
assertEqual(format_phone_us("5551234567"), "(555) 123-4567", "format_phone_us 10 digits");
assertEqual(format_phone_us("(555) 123-4567"), "(555) 123-4567", "format_phone_us already formatted");
assertEqual(format_phone_us("15551234567"), "(555) 123-4567", "format_phone_us with country code");
assertEqual(format_phone_us("12345"), "12345", "format_phone_us invalid length returns original");
assertEqual(format_phone_us(""), "", "format_phone_us empty string");

// flag_invalid_email
assertEqual(flag_invalid_email("test@example.com"), "test@example.com", "flag_invalid_email valid");
assertEqual(flag_invalid_email("not-an-email"), "INVALID: not-an-email", "flag_invalid_email invalid");
assertEqual(flag_invalid_email(""), "", "flag_invalid_email empty string untouched");
assertEqual(
  flag_invalid_email("INVALID: not-an-email"),
  "INVALID: not-an-email",
  "flag_invalid_email no double-flagging"
);

// extract_zip
assertEqual(extract_zip("123 Main St, Springfield, IL 62704"), "62704", "extract_zip from address");
assertEqual(extract_zip("62704-1234"), "62704", "extract_zip zip+4");
assertEqual(extract_zip("no zip here"), "", "extract_zip none found");
assertEqual(extract_zip(null), "", "extract_zip null");

// lowercase / uppercase
assertEqual(lowercase("HELLO"), "hello", "lowercase basic");
assertEqual(uppercase("hello"), "HELLO", "uppercase basic");
assertEqual(lowercase(null), "", "lowercase null");

// remove_duplicates
assertEqual(
  remove_duplicates(
    [
      { email: "a@x.com", name: "A" },
      { email: "b@x.com", name: "B" },
      { email: "a@x.com", name: "A2 (dup)" },
      { email: "", name: "no email 1" },
      { email: "", name: "no email 2" },
    ],
    "email"
  ),
  [
    { email: "a@x.com", name: "A" },
    { email: "b@x.com", name: "B" },
    { email: "", name: "no email 1" },
    { email: "", name: "no email 2" },
  ],
  "remove_duplicates keeps first occurrence, keeps blanks"
);
assertEqual(remove_duplicates([], "email"), [], "remove_duplicates empty array");

// validatePlan — the safety boundary between the AI's raw response and
// what actually executes. Simulates a model hallucinating a column that
// doesn't exist and an operation that was never offered.
const realColumns = ["email", "name", "phone"];
assertEqual(
  validatePlan(
    [
      { column: "email", operation: "flag_invalid_email" }, // valid
      { column: "ssn", operation: "title_case" }, // hallucinated column -> dropped
      { column: "name", operation: "delete_row" }, // hallucinated operation -> dropped
      { column: "phone", operation: "format_phone_us" }, // valid
      "not even an object", // malformed entry -> dropped
    ],
    realColumns
  ),
  [
    { column: "email", operation: "flag_invalid_email" },
    { column: "phone", operation: "format_phone_us" },
  ],
  "validatePlan drops hallucinated columns/operations and malformed entries"
);
assertEqual(validatePlan("not an array", realColumns), [], "validatePlan rejects non-array input");
assertEqual(validatePlan([], realColumns), [], "validatePlan handles empty plan");

// applyPlan — cell ops + a row op (remove_duplicates) chained together,
// exercising the same function page.tsx calls after a successful /api/clean.
assertEqual(
  applyPlan(
    [
      { email: "A@X.COM", name: "  bob  " },
      { email: "a@x.com", name: "carol" },
    ],
    [
      { column: "email", operation: "lowercase" },
      { column: "name", operation: "trim_whitespace" },
      { column: "email", operation: "remove_duplicates" },
    ]
  ).rows,
  [{ email: "a@x.com", name: "bob" }],
  "applyPlan chains cell ops then dedupes on the (now-lowercased) email"
);

console.log("\nDone.");
