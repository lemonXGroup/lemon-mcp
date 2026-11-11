import { z } from "zod";

const maximumInt64 = 9223372036854775807n;
const decimalPolicyID = /^[1-9][0-9]{0,18}(?![\s\S])/;
const invalidIDMessage = "Rewrite policy id must be a safe positive integer or an exact positive Int64 decimal string. Use the original id_text string from list_rewrite_rules, or SELECT CAST(id AS TEXT); an unsafe JavaScript number has already lost precision.";

export function rewritePolicyID(value: unknown): number | string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && decimalPolicyID.test(value) && BigInt(value) <= maximumInt64) return value;
  throw new Error(invalidIDMessage);
}

export const rewritePolicyIDSchema = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(decimalPolicyID).refine(value => decimalPolicyID.test(value) && BigInt(value) <= maximumInt64, "Must not exceed Int64.max"),
]).describe("Exact policy id: prefer the id_text decimal string returned by list_rewrite_rules (1..9223372036854775807, no leading zeros). Numeric input must be a safe positive JavaScript integer.");

export function validateRewritePolicyID(rule: unknown): void {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new Error("rule_json must contain a policy metadata object.");
  const value = rule as Record<string, unknown>;
  if (value.id !== undefined) rewritePolicyID(value.id);
  if (Object.prototype.hasOwnProperty.call(value, "id_text")) {
    throw new Error("Use the returned id_text value as rule.id (a string), and omit id_text from rule_json metadata. Omit both fields when creating a new rule.");
  }
}
