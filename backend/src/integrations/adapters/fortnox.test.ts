import test from "node:test";
import assert from "node:assert/strict";

import { FortnoxAdapter } from "./fortnox.js";
import { FortnoxConfig, SyncTimeEntry } from "../types.js";

function okJsonResponse(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
    });
}

test("FortnoxAdapter.testConnection succeeds for valid token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new FortnoxAdapter(async (url, init) => {
        calls.push({ url, init });
        return okJsonResponse({ CompanyInformation: { Name: "Acme" } });
    });

    const cfg: FortnoxConfig = {
        clientId: "cid",
        clientSecret: "secret",
        accessToken: "token",
    };

    const result = await adapter.testConnection(cfg);

    assert.equal(result.success, true);
    assert.match(result.message, /Connected to Fortnox/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/3\/companyinformation$/);
});

test("FortnoxAdapter.syncTimeEntries returns partial result when one call fails", async () => {
    let count = 0;
    const adapter = new FortnoxAdapter(async () => {
        count += 1;
        if (count === 2) {
            return okJsonResponse({ error: "bad row" }, { status: 400 });
        }
        return okJsonResponse({ ok: true }, { status: 201 });
    });

    const cfg: FortnoxConfig = {
        clientId: "cid",
        clientSecret: "secret",
        accessToken: "token",
    };

    const entries: SyncTimeEntry[] = [
        {
            date: "2026-04-01",
            hours: 2,
            projectName: "P1",
            projectId: "p1",
            note: "n1",
            externalEmployeeId: "e1",
        },
        {
            date: "2026-04-02",
            hours: 3,
            projectName: "P2",
            projectId: "p2",
            note: null,
            externalEmployeeId: "e1",
        },
    ];

    const result = await adapter.syncTimeEntries(cfg, entries);

    assert.equal(result.success, false);
    assert.equal(result.entriesSynced, 1);
    assert.deepEqual(result.failedEntryIds, ["p2"]);
    assert.match(result.message ?? "", /1\/2/);
});

test("FortnoxAdapter.syncTimeEntries short-circuits empty entry list", async () => {
    let called = false;
    const adapter = new FortnoxAdapter(async () => {
        called = true;
        return okJsonResponse({ ok: true });
    });

    const cfg: FortnoxConfig = {
        clientId: "cid",
        clientSecret: "secret",
        accessToken: "token",
    };

    const result = await adapter.syncTimeEntries(cfg, []);

    assert.equal(result.success, true);
    assert.equal(result.entriesSynced, 0);
    assert.equal(called, false);
});
