import test from "node:test";
import assert from "node:assert/strict";

import { createMagicLinkToken, verifyMagicLinkToken, buildMagicLinkUrl } from "./magic-link.js";

const user = {
    userId: "user-1",
    username: "alice",
    role: "admin",
};

test("createMagicLinkToken and verifyMagicLinkToken round-trip", () => {
    const token = createMagicLinkToken(user);
    const payload = verifyMagicLinkToken(token);

    assert.deepEqual(payload, user);
});

test("buildMagicLinkUrl includes token on app base url", () => {
    const token = "abc123";
    const previous = process.env.FAUKE_APP_BASE_URL;
    process.env.FAUKE_APP_BASE_URL = "http://localhost:5174";

    const url = buildMagicLinkUrl(token);

    assert.equal(url, "http://localhost:5174/?magicToken=abc123");
    process.env.FAUKE_APP_BASE_URL = previous;
});
