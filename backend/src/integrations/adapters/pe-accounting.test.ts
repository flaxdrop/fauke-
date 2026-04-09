import test from "node:test";
import assert from "node:assert/strict";

import { PEAccountingAdapter, mapEntryToPEXml } from "./pe-accounting.js";
import { PEAccountingConfig, SyncTimeEntry } from "../types.js";

function responseWith(status: number, body = "") {
    return new Response(body, { status });
}

const config: PEAccountingConfig = {
    apiToken: "token-123",
    companyId: "comp-1",
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

test("mapEntryToPEXml escapes XML-sensitive characters", () => {
    const xml = mapEntryToPEXml({
        date: "2026-04-03",
        hours: 1,
        projectName: "P3",
        projectId: "proj&<>\"'",
        note: "note <xml>",
        externalEmployeeId: "emp&01",
    });

    assert.match(xml, /emp&amp;01/);
    assert.match(xml, /proj&amp;&lt;&gt;&quot;&apos;/);
    assert.match(xml, /note &lt;xml&gt;/);
});

test("PEAccountingAdapter.testConnection succeeds for valid token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new PEAccountingAdapter(async (url, init) => {
        calls.push({ url, init });
        return responseWith(200, "ok");
    });

    const result = await adapter.testConnection(config);

    assert.equal(result.success, true);
    assert.match(result.message, /Connected to PE Accounting/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/v1\/company\/comp-1$/);
});

test("PEAccountingAdapter.syncTimeEntries returns partial result when one call fails", async () => {
    let count = 0;
    const adapter = new PEAccountingAdapter(async () => {
        count += 1;
        if (count === 2) {
            return responseWith(400, "bad row");
        }
        return responseWith(201, "created");
    });

    const result = await adapter.syncTimeEntries(config, entries);

    assert.equal(result.success, false);
    assert.equal(result.entriesSynced, 1);
    assert.deepEqual(result.failedEntryIds, ["p2"]);
    assert.match(result.message ?? "", /1\/2/);
});

test("PEAccountingAdapter.syncTimeEntries short-circuits empty entry list", async () => {
    let called = false;
    const adapter = new PEAccountingAdapter(async () => {
        called = true;
        return responseWith(201, "created");
    });

    const result = await adapter.syncTimeEntries(config, []);

    assert.equal(result.success, true);
    assert.equal(result.entriesSynced, 0);
    assert.equal(called, false);
});
