> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# Regex

Regex Tester lets you validate a pattern against sample text before putting it into Rewrite, a script, or another matching rule. It shows full matches, capture groups, and no-match states so you can test safely before using real traffic.

## Tester sections

- **Source Text**: the sample text to match.
- **Regular Expression**: the pattern.
- **Matches**: each full match and its capture groups.
- **Guide**: the built-in regex notes.

Results recalculate as inputs change. An invalid pattern is reported as an error rather than being treated as a valid pattern with no matches.

## A minimal workflow

1. Prepare a redacted sample that resembles the real header, URL, or body.
2. Start with a small pattern, such as `user_id=([0-9]+)`.
3. Check that the full match covers exactly the intended text.
4. Check that each capture group contains only the value needed by the next action.
5. Test a second sample containing boundary cases.

Example:

```text
source:  user_id=42&region=cn
pattern: user_id=([0-9]+)
full match: user_id=42
group 1: 42
```

## Rule-writing advice

- Use Host, Path, or Method constraints when they can narrow the scope; do not put every condition into one large regex.
- Add clear boundaries and avoid allowing `.*` to consume later fields.
- Test empty values, newlines, case, repeated fields, and special characters.
- Use redacted samples for cookies, tokens, and personal data.
- A successful tester result does not prove a Rewrite action will work; verify encoding and runtime context with a controlled request.

## Common problems

### No match

Confirm that the sample contains the target and check case, newlines, and escaping. If the pattern came from a JSON or script string, verify that string escaping did not change it.

### Too many matches

Narrow the context with field names, separators, or host information. Prefer explicit character sets and non-greedy quantifiers where appropriate.

### Capture groups are unexpected

Distinguish the full match from capture groups. Only parenthesized groups appear as group results; use non-capturing groups where supported when a group is only structural.
