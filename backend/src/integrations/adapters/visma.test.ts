import test from "node:test";
import assert from "node:assert/strict";

import { VismaAdapter } from "./visma.js";
import { VismaConfig, SyncTimeEntry } from "../types.js";

function okJsonResponse(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
    });
}

const payrollConfig: VismaConfig = {
    clientId: "cid",
    clientSecret: "secret",
    accessToken: "token",
    targetApi: "payroll",
};

const bookkeepingConfig: VismaConfig = {
    clientId: "cid",
    clientSecret: "secret",
    accessToken: "token",
    targetApi: "bookkeeping",
};

test("VismaAdapter.testConnection succeeds for valid token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new VismaAdapter(async (url, init) => {
        calls.push({ url, init });
        return okJsonResponse({ ok: true });
    });

    const result = await adapter.testConnection(payrollConfig);

    assert.equal(result.success, true);
    assert.match(result.message, /Connected to Visma Lön Smart/);
    assert.equal(calls.length, 1);
});

test("VismaAdapter.syncTimeEntries payroll returns partial result when one call fails", async () => {
    let count = 0;
    const adapter = new VismaAdapter(async () => {
        count += 1;
        if (count === 2) {
            return okJsonResponse({ error: "bad row" }, { status: 400 });
        }
        return okJsonResponse({ ok: true }, { status: 201 });
    });

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

    const result = await adapter.syncTimeEntries(payrollConfig, entries);

    assert.equal(result.success, false);
    assert.equal(result.entriesSynced, 1);
    assert.deepEqual(result.failedEntryIds, ["p2"]);
    assert.match(result.message ?? "", /1\/2/);
});

test("VismaAdapter.syncTimeEntries bookkeeping syncs all rows in one request", async () => {
    let called = 0;
    const adapter = new VismaAdapter(async () => {
        called += 1;
        return okJsonResponse({ ok: true }, { status: 201 });
    });

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

    const result = await adapter.syncTimeEntries(bookkeepingConfig, entries);

    assert.equal(result.success, true);
    assert.equal(result.entriesSynced, 2);
    assert.equal(called, 1);
});
