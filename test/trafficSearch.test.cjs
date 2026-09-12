const assert = require("node:assert/strict");
const test = require("node:test");

const { exactHostForKeyword, filterTrafficItems } = require("../build/trafficSearch.js");

const items = [
  { id: "target", host: "accounts.google.com", url: "https://accounts.google.com/" },
  { id: "subdomain", host: "www.accounts.google.com", url: "https://www.accounts.google.com/" },
  { id: "unrelated", host: "example.com", url: "https://example.com/accounts.google.com" },
];

test("domain-looking keyword is normalized to an exact host", () => {
  assert.equal(exactHostForKeyword(" Accounts.Google.com. "), "accounts.google.com");
  assert.equal(exactHostForKeyword("h2tcbox"), null);
});

test("exact host filtering excludes token-only FTS matches", () => {
  assert.deepEqual(
    filterTrafficItems(items, "accounts.google.com", 50).map((item) => item.id),
    ["target"],
  );
});

test("ordinary keyword searches keep server-provided fuzzy results", () => {
  assert.deepEqual(
    filterTrafficItems(items, "h2tcbox", 2).map((item) => item.id),
    ["target", "subdomain"],
  );
});
