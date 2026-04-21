import fs from "node:fs/promises";
import path from "node:path";

const WIKI_RAW_URL =
  "https://raw.githubusercontent.com/wiki/teorth/erdosproblems/AI-contributions-to-Erd%C5%91s-problems.md";
const WIKI_PAGE_URL =
  "https://github.com/teorth/erdosproblems/wiki/AI-contributions-to-Erd%C5%91s-problems";

function stablePayloadSignature(payload) {
  return JSON.stringify({
    ...payload,
    metadata: {
      ...payload.metadata,
      generatedAt: null,
    },
  });
}

async function readExistingPayload(filePath) {
  try {
    const source = await fs.readFile(filePath, "utf8");
    const prefix = "window.ERDOS_AI_DATA = ";

    if (!source.startsWith(prefix)) {
      return null;
    }

    const jsonText = source.slice(prefix.length).trim().replace(/;\s*$/, "");
    return JSON.parse(jsonText);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

const baseReleaseCatalog = [
  {
    id: "chatgpt-free",
    label: "ChatGPT free version",
    vendor: "OpenAI",
    family: "chatgpt",
    releaseDate: "2022-11-30",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/blog/chatgpt",
    notes: "Initial ChatGPT research preview release.",
    patterns: ["\\bChatGPT free version\\b"],
  },
  {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    family: "claude",
    releaseDate: "2023-03-14",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/introducing-claude",
    notes: "Initial Claude public announcement.",
    patterns: ["^Claude$"],
  },
  {
    id: "gemini",
    label: "Gemini",
    vendor: "Google",
    family: "gemini",
    releaseDate: "2023-12-06",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Google",
    sourceUrl: "https://blog.google/technology/ai/google-gemini-ai/",
    notes: "Initial Gemini family announcement.",
    patterns: ["^Gemini$"],
  },
  {
    id: "claude-opus",
    label: "Claude Opus",
    vendor: "Anthropic",
    family: "claude-opus",
    releaseDate: "2024-03-04",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/claude-3-family",
    notes: "Claude 3 family launch including Opus.",
    patterns: ["^Claude Opus$"],
  },
  {
    id: "alphaproof",
    label: "AlphaProof",
    vendor: "Google DeepMind",
    family: "alphaproof",
    releaseDate: "2024-07-25",
    releaseType: "research",
    sourceKind: "official",
    sourceLabel: "Google DeepMind",
    sourceUrl:
      "https://deepmind.google/blog/ai-solves-imo-problems-at-silver-medal-level/",
    notes: "Research announcement tied to the IMO silver-medal result.",
    patterns: ["\\bAlphaProof\\b"],
  },
  {
    id: "gemini-deep-research",
    label: "Gemini Deep Research",
    vendor: "Google",
    family: "gemini-deep-research",
    releaseDate: "2024-12-11",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Google",
    sourceUrl:
      "https://blog.google/products-and-platforms/products/gemini/google-gemini-deep-research/",
    notes: "Gemini Deep Research rollout in the Gemini app.",
    patterns: ["\\bGemini Deep Research\\b"],
  },
  {
    id: "chatgpt-deep-research",
    label: "ChatGPT Deep research",
    vendor: "OpenAI",
    family: "chatgpt-deep-research",
    releaseDate: "2025-02-02",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-deep-research/",
    notes: "ChatGPT deep research launch.",
    patterns: ["\\bChatGPT Deep research\\b"],
  },
  {
    id: "deepseek-deepthinking",
    label: "DeepSeek Deepthinking",
    vendor: "DeepSeek",
    family: "deepseek",
    releaseDate: "2025-01-20",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "DeepSeek",
    sourceUrl: "https://api-docs.deepseek.com/news/news250120",
    notes: "Mapped to the public DeepSeek-R1 release as the nearest public 'deep thinking' mode.",
    patterns: ["\\bDeepSeek Deepthinking\\b"],
  },
  {
    id: "alphaevolve",
    label: "AlphaEvolve",
    vendor: "Google DeepMind",
    family: "alphaevolve",
    releaseDate: "2025-05-14",
    releaseType: "research",
    sourceKind: "official",
    sourceLabel: "Google DeepMind",
    sourceUrl:
      "https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/",
    notes: "Research announcement for the algorithm-discovery agent.",
    patterns: ["\\bAlphaEvolve\\b"],
  },
  {
    id: "codex",
    label: "Codex",
    vendor: "OpenAI",
    family: "codex",
    releaseDate: "2025-05-16",
    releaseType: "research-preview",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-codex/",
    notes: "Cloud coding agent powered by codex-1.",
    patterns: ["(?<!-)\\bCodex\\b(?!-Spark)"],
  },
  {
    id: "seed-prover",
    label: "Seed Prover",
    vendor: "ByteDance Seed",
    family: "seed-prover",
    releaseDate: "2025-07-23",
    releaseType: "research",
    sourceKind: "official",
    sourceLabel: "ByteDance Seed",
    sourceUrl: "https://seed.bytedance.com/en/publication/seed-prover",
    notes: "Initial Seed Prover research release.",
    patterns: ["^Seed Prover$"],
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    vendor: "OpenAI",
    family: "gpt",
    releaseDate: "2025-08-07",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-5/",
    notes: "Main GPT-5 launch page.",
    patterns: ["\\bGPT-5(?!\\.[234]|-Codex)\\b"],
  },
  {
    id: "claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    vendor: "Anthropic",
    family: "claude-sonnet",
    releaseDate: "2025-09-29",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/claude-sonnet-4-5/",
    notes: "Frontier Claude Sonnet release for coding and agents.",
    patterns: ["\\bClaude Sonnet 4\\.5\\b"],
  },
  {
    id: "claude-opus-4.5",
    label: "Claude Opus 4.5",
    vendor: "Anthropic",
    family: "claude-opus",
    releaseDate: "2025-11-24",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/claude-opus-4-5/",
    notes: "Opus 4.5 public launch.",
    patterns: ["\\bClaude Opus 4\\.5\\b"],
  },
  {
    id: "gemini-3",
    label: "Gemini 3 / Gemini 3 Pro",
    vendor: "Google",
    family: "gemini-pro",
    releaseDate: "2025-11-18",
    releaseType: "preview",
    sourceKind: "official",
    sourceLabel: "Google",
    sourceUrl:
      "https://blog.google/products-and-platforms/products/gemini/gemini-3/",
    notes: "Gemini 3 era announcement with Gemini 3 Pro in preview.",
    patterns: ["\\bGemini 3(?!\\.1)(?:\\s+(?:Pro|Flash))?\\b"],
  },
  {
    id: "gemini-3-deep-think",
    label: "Gemini 3 Deep Think",
    vendor: "Google",
    family: "gemini-deep-think",
    releaseDate: "2025-11-18",
    releaseType: "tester-preview",
    publicDate: "2026-02-12",
    sourceKind: "official",
    sourceLabel: "Google",
    sourceUrl:
      "https://blog.google/products-and-platforms/products/gemini/gemini-3/",
    secondarySourceLabel: "Google",
    secondarySourceUrl:
      "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-deep-think/",
    notes:
      "Announced for safety testers on Gemini 3 launch; broader Gemini app rollout began on Feb 12, 2026.",
    patterns: ["\\bGemini(?: 3)? Deep Think\\b"],
  },
  {
    id: "google-antigravity",
    label: "Google Antigravity",
    vendor: "Google",
    family: "antigravity",
    releaseDate: "2025-11-18",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Google",
    sourceUrl:
      "https://blog.google/products-and-platforms/products/gemini/gemini-3/",
    notes: "Agentic development platform announced alongside Gemini 3.",
    patterns: ["\\bAntigravity\\b"],
  },
  {
    id: "seed-prover-1.5",
    label: "Seed Prover 1.5",
    vendor: "ByteDance Seed",
    family: "seed-prover",
    releaseDate: "2025-12-24",
    releaseType: "research",
    sourceKind: "official",
    sourceLabel: "ByteDance Seed",
    sourceUrl: "https://seed.bytedance.com/en/publication/seed-prover-1-5",
    notes: "Seed Prover 1.5 follow-on release.",
    patterns: ["^Seed Prover 1\\.5$"],
  },
  {
    id: "gpt-5.2",
    label: "GPT-5.2",
    vendor: "OpenAI",
    family: "gpt",
    releaseDate: "2025-12-11",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-5-2",
    notes: "GPT-5.2 family launch; covers Pro and Thinking variants.",
    patterns: [
      "\\bGPT-5\\.2(?!-Codex)(?:\\s+(?:Pro|Thinking))?(?:\\s+multi-agent system)?\\b",
    ],
  },
  {
    id: "gpt-5.2-codex",
    label: "GPT-5.2-Codex",
    vendor: "OpenAI",
    family: "codex-model",
    releaseDate: "2025-12-18",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/gpt-5-2-codex/",
    notes: "Agentic coding model release.",
    patterns: ["\\bGPT-5\\.2-Codex\\b"],
  },
  {
    id: "claude-opus-4.6",
    label: "Claude Opus 4.6",
    vendor: "Anthropic",
    family: "claude-opus",
    releaseDate: "2026-02-05",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/claude-opus-4-6",
    notes: "Opus 4.6 upgrade release.",
    patterns: ["\\bClaude Opus 4\\.6\\b"],
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3-Codex",
    vendor: "OpenAI",
    family: "codex-model",
    releaseDate: "2026-02-05",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-5-3-codex/",
    notes: "Codex expansion into broader computer work.",
    patterns: ["\\bGPT-5\\.3-Codex\\b"],
  },
  {
    id: "gpt-5.3-codex-spark",
    label: "GPT-5.3-Codex-Spark",
    vendor: "OpenAI",
    family: "codex-model",
    releaseDate: "2026-02-12",
    releaseType: "research-preview",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl:
      "https://openai.com/index/introducing-gpt-5-3-codex-spark/",
    notes: "Ultra-fast real-time coding research preview.",
    patterns: ["\\bGPT-5\\.3-Codex-Spark\\b"],
  },
  {
    id: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    vendor: "Anthropic",
    family: "claude-sonnet",
    releaseDate: "2026-02-17",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "Anthropic",
    sourceUrl: "https://www.anthropic.com/claude/sonnet",
    notes: "Sonnet 4.6 public launch.",
    patterns: ["\\bClaude Sonnet 4\\.6\\b"],
  },
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    vendor: "Google",
    family: "gemini-pro",
    releaseDate: "2026-02-19",
    releaseType: "preview",
    sourceKind: "official",
    sourceLabel: "Google",
    sourceUrl:
      "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/",
    notes: "Gemini 3.1 Pro rollout across consumer and developer products.",
    patterns: ["\\bGemini 3\\.1(?:\\s+(?:Pro|Deep Think))?\\b"],
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    vendor: "OpenAI",
    family: "gpt",
    releaseDate: "2026-03-05",
    releaseType: "public",
    sourceKind: "official",
    sourceLabel: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-5-4/",
    notes: "GPT-5.4 launch; covers Pro and Thinking variants.",
    patterns: ["\\bGPT-5\\.4(?:\\s+(?:Pro|Thinking))?\\b"],
  },
];

function splitTableRow(line) {
  const normalized = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function extractMarkdownLinks(text) {
  const matches = [
    ...text.matchAll(/(\[\[[^\]]+\]\]|\[[^\]]+\])\(([^)]+)\)/g),
  ];
  return matches.map((match) => ({
    label: match[1].replace(/^\[\[?/, "").replace(/\]\]?$/, ""),
    url: match[2],
  }));
}

function markdownToPlain(text) {
  return text
    .replace(/<a[^>]*>/g, "")
    .replace(/<\/a>/g, "")
    .replace(/\[\[([^\]]+)\]\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProblemIds(text) {
  return [...text.matchAll(/\[\[(\d+)\]\]/g)].map((match) => Number(match[1]));
}

function getPrimaryText(fields) {
  const orderedKeys = [
    "Outcome",
    "Result",
    "Artifacts",
    "Computation",
    "Proof to be formalized",
    "Previous argument",
  ];
  for (const key of orderedKeys) {
    if (fields[key]) {
      return fields[key];
    }
  }
  return "";
}

function buildRecord(section, major, headers, row, rowIndex) {
  const fields = {};
  headers.forEach((header, idx) => {
    fields[header] = row[idx] ?? "";
  });

  const normalizedFields = normalizeFields(section, fields);

  const aiSystemsRaw = normalizedFields["AI systems"] || "";
  const humansRaw = normalizedFields["Humans"] || "";
  const problemRaw = normalizedFields["Problem"] || "";
  const dateRaw = normalizedFields["Date"] || "";
  const primaryText = getPrimaryText(normalizedFields);
  const links = extractMarkdownLinks(problemRaw);
  const problemIds = extractProblemIds(problemRaw);

  return {
    id: `${section.anchor || "section"}-${String(rowIndex + 1).padStart(3, "0")}`,
    majorSection: major.title,
    majorAnchor: major.anchor,
    subsection: section.title,
    subsectionAnchor: section.anchor,
    subsectionOrder: section.order,
    rowOrder: rowIndex + 1,
    problemRaw,
    problemLabel: markdownToPlain(problemRaw),
    problemIds,
    problemLinks: links,
    aiSystemsRaw,
    aiSystemsLabel: markdownToPlain(aiSystemsRaw),
    humansRaw,
    humansLabel: markdownToPlain(humansRaw),
    dateRaw,
    descriptionRaw: primaryText,
    descriptionLabel: markdownToPlain(primaryText),
    fieldsRaw: normalizedFields,
    fieldsPlain: Object.fromEntries(
      Object.entries(normalizedFields).map(([key, value]) => [key, markdownToPlain(value)])
    ),
  };
}

function normalizeFields(section, fields) {
  if (section.anchor === "sect-3") {
    return {
      Problem: fields.Problem || "",
      Humans: fields.A || "",
      "AI systems": fields.B || "",
      Date: fields.C || "",
      Outcome: fields.D || "",
      E: fields.E || "",
      F: fields.F || "",
    };
  }

  return fields;
}

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const PLACEHOLDER_TOKENS = new Set(["Unspecified", "Various"]);

const MANUAL_INFERENCE_GROUPS = [
  {
    id: "openai-internal-model",
    label: "OpenAI internal model",
    vendor: "OpenAI",
    family: "openai-internal-model",
    tokens: ["OpenAI internal model", "OpenAI internal model (independently)"],
    strategy: "first_full_then_positive_then_seen",
    notes:
      "No public model identifier is listed on the wiki. Date inferred from the earliest solved or otherwise positive wiki entry attributed to the internal model.",
  },
];

function splitAiSystems(text) {
  return (text || "")
    .split(/;|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function monthIndex(month) {
  return MONTHS[String(month).slice(0, 3).toLowerCase()] ?? 0;
}

function makeDate(year, month, day) {
  return new Date(Date.UTC(Number(year), monthIndex(month), Number(day)));
}

function parseSingleDate(token) {
  let match = token.match(/^(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})$/);
  if (match) {
    const date = makeDate(match[3], match[2], match[1]);
    return { start: date, end: date };
  }

  match = token.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (match) {
    const date = makeDate(match[3], match[1], match[2]);
    return { start: date, end: date };
  }

  match = token.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const start = makeDate(match[2], match[1], 1);
    const end = new Date(Date.UTC(Number(match[2]), monthIndex(match[1]) + 1, 0));
    return { start, end };
  }

  match = token.match(/^(\d{4})$/);
  if (match) {
    return {
      start: new Date(Date.UTC(Number(match[1]), 0, 1)),
      end: new Date(Date.UTC(Number(match[1]), 11, 31)),
    };
  }

  return null;
}

function parseDateInfo(raw) {
  if (!raw) {
    return fallbackDateInfo();
  }

  const cleaned = raw
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\(([^)]*)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const ranges = [];
  let scrubbed = cleaned;

  const patterns = [
    {
      regex:
        /(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
      build(groups) {
        return {
          start: makeDate(groups[2], groups[1], groups[0]),
          end: makeDate(groups[5], groups[4], groups[3]),
        };
      },
    },
    {
      regex:
        /(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
      build(groups) {
        return {
          start: makeDate(groups[4], groups[1], groups[0]),
          end: makeDate(groups[4], groups[3], groups[2]),
        };
      },
    },
    {
      regex: /(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})/g,
      build(groups) {
        return {
          start: makeDate(groups[3], groups[2], groups[0]),
          end: makeDate(groups[3], groups[2], groups[1]),
        };
      },
    },
    {
      regex: /([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})/g,
      build(groups) {
        return {
          start: makeDate(groups[3], groups[0], groups[1]),
          end: makeDate(groups[3], groups[0], groups[2]),
        };
      },
    },
  ];

  patterns.forEach((pattern) => {
    scrubbed = scrubbed.replace(pattern.regex, (...args) => {
      const groups = args.slice(1, -2);
      ranges.push(pattern.build(groups));
      return " ";
    });
  });

  const singles = [];
  const singlePatterns = [
    /(\d{1,2}\s+[A-Za-z]+,\s*\d{4})/g,
    /([A-Za-z]+\s+\d{1,2},\s*\d{4})/g,
    /([A-Za-z]+\s+\d{4})/g,
    /(\b\d{4}\b)/g,
  ];

  singlePatterns.forEach((pattern) => {
    for (const match of scrubbed.matchAll(pattern)) {
      const value = parseSingleDate(match[1]);
      if (value) {
        singles.push(value);
      }
    }
    scrubbed = scrubbed.replace(pattern, " ");
  });

  const allDates = [
    ...ranges.map((range) => range.start),
    ...ranges.map((range) => range.end),
    ...singles.map((entry) => entry.start),
    ...singles.map((entry) => entry.end),
  ].filter(Boolean);

  if (!allDates.length) {
    return fallbackDateInfo(raw);
  }

  return {
    start: new Date(Math.min(...allDates.map((date) => date.getTime()))),
    end: new Date(Math.max(...allDates.map((date) => date.getTime()))),
    raw,
    valid: true,
  };
}

function fallbackDateInfo(raw = "") {
  const date = new Date(Date.UTC(1970, 0, 1));
  return { start: date, end: date, raw, valid: false };
}

function classifyOutcome(record) {
  const text = [
    record.descriptionLabel,
    record.fieldsPlain.Outcome,
    record.fieldsPlain.Result,
    record.fieldsPlain.Computation,
    record.fieldsPlain.Artifacts,
    record.fieldsPlain["Proof to be formalized"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/incorrect|major gaps|wrong reference|wrong references/.test(text)) {
    return "incorrect";
  }

  if (
    /full solution|full solution found|new proof found|proof found|solution to stronger problem|counterexample to one part|optimal construction found numerically/.test(
      text
    )
  ) {
    return "full";
  }

  if (
    /partial|variant problem|related result|improved|cheap|reduction|initial exploration|code generation|computational|oeis|formalized/.test(
      text
    )
  ) {
    return "partial";
  }

  return "neutral";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function inferVendor(name) {
  if (/openai|gpt|chatgpt|codex/i.test(name)) {
    return "OpenAI";
  }
  if (/claude/i.test(name)) {
    return "Anthropic";
  }
  if (/gemini|deepmind|alpha/i.test(name)) {
    return /deepmind|alpha/i.test(name) ? "Google DeepMind" : "Google";
  }
  if (/seed|bytedance/i.test(name)) {
    return "ByteDance Seed";
  }
  if (/deepseek/i.test(name)) {
    return "DeepSeek";
  }
  if (/grok/i.test(name)) {
    return "xAI";
  }
  return "Inferred";
}

function inferCandidate(records, strategy) {
  const sorted = records
    .filter((record) => record.dateInfo.valid)
    .sort(
      (left, right) => left.dateInfo.start.getTime() - right.dateInfo.start.getTime()
    );
  const full = sorted.find((record) => record.outcomeKind === "full");
  const positive = sorted.find(
    (record) => record.outcomeKind === "full" || record.outcomeKind === "partial"
  );

  if (strategy === "first_full_then_positive_then_seen") {
    return full || positive || sorted[0] || null;
  }

  if (strategy === "first_positive_then_seen") {
    return positive || sorted[0] || null;
  }

  return sorted[0] || null;
}

function buildInferredRelease(groups, candidate, strategy) {
  const inferredFromUrl = candidate.problemLinks?.[0]?.url || WIKI_PAGE_URL;
  const inferredFromProblem = candidate.problemIds?.length
    ? `#${candidate.problemIds.join(", #")}`
    : candidate.problemLabel;

  return {
    id: groups.id || slugify(groups.label),
    label: groups.label,
    vendor: groups.vendor,
    family: groups.family || slugify(groups.label),
    releaseDate: formatIsoDate(candidate.dateInfo.start),
    releaseType: `inferred-${strategy}`,
    sourceKind: "inferred",
    sourceLabel: "Erdos wiki inference",
    sourceUrl: inferredFromUrl,
    notes: groups.notes,
    inferenceType: strategy,
    inferredFrom: {
      dateRaw: candidate.dateRaw,
      problem: inferredFromProblem,
      subsection: candidate.subsection,
      outcome: candidate.outcomeKind,
    },
    patterns: groups.patterns || groups.tokens.map((token) => `^${escapeRegExp(token)}$`),
  };
}

function buildReleaseCatalog(records) {
  const enrichedRecords = records.map((record) => ({
    ...record,
    dateInfo: parseDateInfo(record.dateRaw),
    outcomeKind: classifyOutcome(record),
  }));

  const catalog = [...baseReleaseCatalog];
  const regexMatchers = () =>
    catalog.map((release) => ({
      release,
      regexes: (release.patterns || []).map((pattern) => new RegExp(pattern, "i")),
    }));

  const tokenMap = new Map();
  enrichedRecords.forEach((record) => {
    splitAiSystems(record.aiSystemsLabel).forEach((token) => {
      if (!tokenMap.has(token)) {
        tokenMap.set(token, []);
      }
      tokenMap.get(token).push(record);
    });
  });

  const coveredTokens = new Set();

  MANUAL_INFERENCE_GROUPS.forEach((group) => {
    const rows = group.tokens.flatMap((token) => tokenMap.get(token) || []);
    const candidate = inferCandidate(rows, group.strategy);
    if (!candidate) {
      return;
    }
    catalog.push(buildInferredRelease(group, candidate, group.strategy));
    group.tokens.forEach((token) => coveredTokens.add(token));
  });

  const matchers = regexMatchers();

  for (const [token, rows] of [...tokenMap.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    if (coveredTokens.has(token)) {
      continue;
    }

    const alreadyCovered = matchers.some(({ regexes }) => regexes.some((regex) => regex.test(token)));
    if (alreadyCovered) {
      continue;
    }

    const strategy = PLACEHOLDER_TOKENS.has(token)
      ? "first_seen"
      : "first_positive_then_seen";
    const candidate = inferCandidate(rows, strategy);

    if (!candidate) {
      continue;
    }

    catalog.push(
      buildInferredRelease(
        {
          id: slugify(token),
          label: token,
          vendor: inferVendor(token),
          family: slugify(token),
          tokens: [token],
          notes: PLACEHOLDER_TOKENS.has(token)
            ? "Placeholder token from the wiki rather than a single named model; date inferred from first appearance."
            : "No official release page was cataloged for this exact system name; date inferred from the earliest positive wiki entry, or first appearance if no positive entry exists.",
        },
        candidate,
        strategy
      )
    );
  }

  return catalog.sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));
}

async function main() {
  const root = process.cwd();
  const response = await fetch(WIKI_RAW_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch wiki source: ${response.status}`);
  }

  const markdown = await response.text();
  const lines = markdown.split(/\r?\n/);

  let pendingAnchor = null;
  let currentMajor = { title: "", anchor: "" };
  let sectionOrder = 0;
  const sections = [];
  const records = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx];
    const line = rawLine.trim();

    const anchorMatch = line.match(/^<a id="([^"]+)"><\/a>$/);
    if (anchorMatch) {
      pendingAnchor = anchorMatch[1];
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[2].trim();
      const isMajor = /^\d+\./.test(title);
      const isSubsection = /^\d+\([a-z]\)/i.test(title);

      if (isMajor) {
        currentMajor = {
          title,
          anchor: pendingAnchor || "",
        };
        pendingAnchor = null;

        const nextHeading = lines[idx + 1]?.trim().match(/^(#{1,3})\s+(.+)$/);
        const nextIsSubsection = nextHeading && /^\d+\([a-z]\)/i.test(nextHeading[2].trim());
        if (nextIsSubsection) {
          continue;
        }
      }

      if (!isMajor && !isSubsection) {
        pendingAnchor = null;
        continue;
      }

      const effectiveMajor = isMajor
        ? { title, anchor: currentMajor.anchor || pendingAnchor || "" }
        : currentMajor;

      const section = {
        title,
        anchor: pendingAnchor || effectiveMajor.anchor || "",
        majorTitle: effectiveMajor.title,
        majorAnchor: effectiveMajor.anchor,
        order: sectionOrder,
      };
      pendingAnchor = null;
      sectionOrder += 1;

      let headerIndex = -1;
      for (let scan = idx + 1; scan < lines.length; scan += 1) {
        const candidate = lines[scan].trim();
        if (candidate.startsWith("#")) {
          break;
        }
        if (
          candidate.startsWith("|") &&
          lines[scan + 1]?.trim().startsWith("|") &&
          lines[scan + 1].includes("---")
        ) {
          headerIndex = scan;
          break;
        }
      }

      if (headerIndex !== -1) {
        const headers = splitTableRow(lines[headerIndex]);
        let rowIndex = 0;
        idx = headerIndex + 2;

        while (idx < lines.length && lines[idx].trim().startsWith("|")) {
          const row = splitTableRow(lines[idx]);
          records.push(buildRecord(section, effectiveMajor, headers, row, rowIndex));
          rowIndex += 1;
          idx += 1;
        }

        idx -= 1;
        sections.push({
          ...section,
          headers,
          rowCount: rowIndex,
        });
      }

      continue;
    }
  }

  const payload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      wikiRawUrl: WIKI_RAW_URL,
      wikiPageUrl: WIKI_PAGE_URL,
      recordCount: records.length,
      sectionCount: sections.length,
    },
    sections,
    releases: buildReleaseCatalog(records),
    records,
  };

  const appDataPath = path.join(root, "app-data.js");
  const existingPayload = await readExistingPayload(appDataPath);

  if (
    existingPayload?.metadata?.generatedAt &&
    stablePayloadSignature(existingPayload) === stablePayloadSignature(payload)
  ) {
    payload.metadata.generatedAt = existingPayload.metadata.generatedAt;
  }

  await fs.writeFile(path.join(root, "wiki-source.md"), markdown, "utf8");
  await fs.writeFile(
    appDataPath,
    `window.ERDOS_AI_DATA = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8"
  );

  console.log(
    `Generated app-data.js with ${records.length} records across ${sections.length} sections.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
