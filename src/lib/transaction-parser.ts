/**
 * Natural-language quick entry: turn "soft drinks 120" / "gas 1500" /
 * "Shopee 899" into amount + merchant + type, and suggest a category from
 * keywords. Pure and client-safe. Keyword rules are a deliberately plain,
 * transparent heuristic — the per-user learned mappings (server-side) take
 * precedence over these when present.
 */
import type { Category } from "@/lib/supabase/types";

export type ParsedEntry = {
  amount: number | null;
  merchant: string;
  type: "expense" | "income";
};

const INCOME_WORDS = [
  "salary",
  "sweldo",
  "sahod",
  "payroll",
  "bonus",
  "refund",
  "received",
  "income",
  "allowance",
  "commission",
  "dividend",
  "interest",
  "cashback",
  "payment from",
];

/**
 * Amount = the last money-looking token: "120", "1,500", "1500.50", "1.5k",
 * "₱120", "120php", "p120". Everything else (trimmed) is the merchant.
 */
export function parseQuickEntry(raw: string): ParsedEntry {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const type: ParsedEntry["type"] = INCOME_WORDS.some((w) => lower.includes(w))
    ? "income"
    : "expense";

  const re = /(?:₱|php|p)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(k)?(?:\s*php)?(?![\w])/gi;
  let match: RegExpExecArray | null = null;
  let last: RegExpExecArray | null = null;
  while ((match = re.exec(text)) !== null) last = match;

  if (!last) return { amount: null, merchant: text, type };

  const whole = Number(last[1].replace(/,/g, ""));
  const frac = last[2] ? Number(`0.${last[2]}`) : 0;
  let amount = whole + frac;
  if (last[3]) amount *= 1000;
  amount = Math.round((amount + Number.EPSILON) * 100) / 100;

  const merchant = (text.slice(0, last.index) + text.slice(last.index + last[0].length))
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–:]+|[\s\-–:]+$/g, "")
    .trim();

  return { amount: amount > 0 ? amount : null, merchant, type };
}

/** Keyword → seed-category name. Order matters: first hit wins. */
const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  {
    category: "Bills",
    words: [
      "meralco", "pldt", "globe", "smart", "converge", "sky", "water", "maynilad",
      "manila water", "electric", "internet", "wifi", "bill", "netflix", "spotify",
      "youtube", "disney", "prime", "rent", "condo dues", "hoa", "insurance",
      "postpaid", "load", "prepaid", "gcash load", "subscription",
    ],
  },
  {
    category: "Transportation",
    words: [
      "gas", "gasoline", "fuel", "petron", "shell", "caltex", "seaoil", "diesel",
      "grab", "angkas", "joyride", "taxi", "jeep", "jeepney", "tricycle", "bus",
      "mrt", "lrt", "toll", "parking", "uber", "fare", "lalamove", "car wash",
    ],
  },
  {
    category: "Food",
    words: [
      "soft drinks", "softdrinks", "coke", "pepsi", "coffee", "kape", "starbucks",
      "jollibee", "mcdo", "mcdonald", "kfc", "chowking", "mang inasal", "greenwich",
      "shakeys", "pizza", "burger", "lunch", "dinner", "breakfast", "merienda",
      "snack", "food", "grocery", "groceries", "supermarket", "sm supermarket",
      "puregold", "robinsons supermarket", "7-eleven", "7 eleven", "711",
      "ministop", "sari-sari", "rice", "bigas", "ulam", "milk tea", "milktea",
      "foodpanda", "grabfood", "water refill", "restaurant", "canteen", "drinks",
    ],
  },
  {
    category: "Shopping",
    words: [
      "shopee", "lazada", "tiktok shop", "zalora", "amazon", "sm", "mall", "uniqlo",
      "h&m", "penshoppe", "bench", "clothes", "shoes", "watsons", "daiso", "miniso",
      "gadget", "phone", "laptop", "shopping",
    ],
  },
  {
    category: "Health",
    words: [
      "mercury drug", "mercury", "pharmacy", "drugstore", "medicine", "gamot",
      "doctor", "clinic", "hospital", "dentist", "checkup", "check-up", "vitamins",
      "lab", "medical", "gym", "anytime fitness",
    ],
  },
  {
    category: "Church/Giving",
    words: ["tithe", "tithes", "offering", "church", "donation", "donate", "give"],
  },
  {
    category: "Entertainment",
    words: [
      "movie", "cinema", "concert", "game", "steam", "playstation", "xbox",
      "karaoke", "videoke", "bar", "beer", "travel", "hotel", "airbnb", "flight",
      "cebu pacific", "philippine airlines", "resort", "beach",
    ],
  },
  {
    category: "Family",
    words: ["mama", "papa", "nanay", "tatay", "kids", "baby", "school", "tuition", "allowance for", "pamilya", "family"],
  },
  {
    category: "Business",
    words: ["supplier", "inventory", "capital", "business", "client", "invoice", "ads", "facebook ads", "meta ads"],
  },
];

/** Suggest a seed-category NAME from free text, or null. */
export function suggestCategoryName(text: string): string | null {
  const lower = text.toLowerCase();
  if (!lower.trim()) return null;
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.words.some((w) => lower.includes(w))) return rule.category;
  }
  return null;
}

/**
 * Resolve a suggested category to one of the user's real categories by name
 * (case-insensitive, tolerant of "Food & Dining" vs "Food").
 */
export function resolveCategory(
  name: string | null,
  categories: Category[],
): Category | null {
  if (!name) return null;
  const needle = name.toLowerCase();
  return (
    categories.find((c) => c.name.toLowerCase() === needle) ??
    categories.find((c) => c.name.toLowerCase().includes(needle)) ??
    categories.find((c) => needle.includes(c.name.toLowerCase())) ??
    null
  );
}

/** Normalise a merchant for per-user learning keys ("SHELL  Station!" → "shell station"). */
export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
