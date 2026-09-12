const test = require("node:test");
const assert = require("node:assert/strict");

const { targetFromService } = require("../build/discovery.js");

test("targetFromService prefers the advertised IPv4 address and port", () => {
  assert.deepEqual(
    targetFromService({
      name: "Lemon.Local",
      host: "Lemon.Local.",
      port: 10003,
      addresses: ["fe80::1", "192.168.3.145"],
    }),
    { host: "192.168.3.145", port: 10003, serviceName: "Lemon.Local" },
  );
});

test("targetFromService falls back to the Bonjour host when no IPv4 is advertised", () => {
  assert.deepEqual(
    targetFromService({
      name: "Lemon.Local",
      host: "Lemon.Local.",
      port: 9999,
      addresses: ["fe80::1"],
    }),
    { host: "Lemon.Local", port: 9999, serviceName: "Lemon.Local" },
  );
});

test("targetFromService rejects an invalid advertised port", () => {
  assert.equal(
    targetFromService({ name: "Lemon.Local", host: "Lemon.Local.", port: 0, addresses: [] }),
    undefined,
  );
});
