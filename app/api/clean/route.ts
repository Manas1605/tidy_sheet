import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  ALL_OPERATION_NAMES,
  OPERATION_DESCRIPTIONS,
  validatePlan,
} from "@/lib/operations";

export const runtime = "nodejs";

interface CleanRequestBody {
  columns: string[];
  sampleRows: Record<string, unknown>[];
  instruction: string;
}

interface UnsupportedOperationError {
  error: "unsupported_operation";
  message: string;
}

const UNSUPPORTED_MESSAGE =
  "I can't do that yet, but I can fix formatting, casing, duplicates, phone numbers, emails, and zip codes.";

function unsupported(message: string = UNSUPPORTED_MESSAGE): NextResponse<UnsupportedOperationError> {
  return NextResponse.json({ error: "unsupported_operation", message }, { status: 200 });
}

function buildSystemPrompt(columns: string[]): string {
  const opsList = ALL_OPERATION_NAMES.map((name) => `- "${name}": ${OPERATION_DESCRIPTIONS[name]}`).join(
    "\n"
  );

  return `You are a planning assistant for a CSV-cleaning tool. You NEVER write code, regex, or transformation logic. Your ONLY job is to select which of the following pre-approved operations to apply to which column(s), based on the user's plain-English instruction.

Available operations (use these exact names, nothing else):
${opsList}

The dataset's exact column names are:
${columns.map((c) => `"${c}"`).join(", ")}

Rules:
1. Only ever use column names EXACTLY as given above. Never invent or guess a column name.
2. Only ever use operation names EXACTLY as listed above. Never invent an operation.
3. If the user's instruction doesn't clearly map to one or more of the available operations and columns, do not guess or force a bad match. Instead return the unsupported-operation error shape.
4. A single column may appear more than once in the plan if multiple operations should apply to it (e.g. trim_whitespace then title_case), and they will be applied in the order listed.
5. Respond with ONLY a JSON object, no conversational text, no markdown fences, matching exactly one of these two shapes:

Success:
{ "plan": [ { "column": "<exact column name>", "operation": "<exact operation name>" }, ... ] }

Unsupported:
{ "error": "unsupported_operation", "message": "<short, friendly explanation of what you can do instead>" }`;
}

export async function POST(req: NextRequest) {
  let body: CleanRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "unsupported_operation", message: "That request wasn't valid. Please try again." },
      { status: 400 }
    );
  }

  const { columns, sampleRows, instruction } = body ?? {};

  if (!Array.isArray(columns) || columns.length === 0) {
    return NextResponse.json(
      { error: "unsupported_operation", message: "No columns were provided. Please upload a CSV first." },
      { status: 400 }
    );
  }
  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    return NextResponse.json(
      { error: "unsupported_operation", message: "Please describe how you'd like the data cleaned." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_key_here") {
    return NextResponse.json(
      {
        error: "unsupported_operation",
        message:
          "No Groq API key is configured. Add GROQ_API_KEY to .env.local (get a free key at console.groq.com) and restart the server.",
      },
      { status: 200 }
    );
  }

  const groq = new Groq({ apiKey });

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: buildSystemPrompt(columns) },
        {
          role: "user",
          content: JSON.stringify({
            instruction: instruction.trim(),
            sampleRows: Array.isArray(sampleRows) ? sampleRows.slice(0, 10) : [],
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return unsupported("The assistant didn't return a plan. Please try rephrasing your instruction.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return unsupported("The assistant's response wasn't valid JSON. Please try again.");
    }

    if (!parsed || typeof parsed !== "object") {
      return unsupported();
    }

    const asRecord = parsed as Record<string, unknown>;

    // Model explicitly signaled it can't help.
    if (asRecord.error === "unsupported_operation") {
      const message = typeof asRecord.message === "string" ? asRecord.message : UNSUPPORTED_MESSAGE;
      return unsupported(message);
    }

    if (!Array.isArray(asRecord.plan)) {
      return unsupported();
    }

    // Validate every step against the real column list and operation
    // registry — never trust the model's output blindly. Shared with
    // lib/operations.test.ts so validation behavior is directly testable.
    const validatedPlan = validatePlan(asRecord.plan, columns);

    if (validatedPlan.length === 0) {
      return unsupported();
    }

    return NextResponse.json({ plan: validatedPlan }, { status: 200 });
  } catch (err) {
    console.error("Groq API call failed:", err);
    return NextResponse.json(
      {
        error: "unsupported_operation",
        message: "Something went wrong talking to the AI service. Please try again in a moment.",
      },
      { status: 200 }
    );
  }
}
