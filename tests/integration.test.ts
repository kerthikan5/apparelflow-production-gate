import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const base = "http://localhost:3100/api/";
const sessions: Record<string, string> = {};
let recipe: {
  id: string;
  components: { id: string; piecesPerGarment: number }[];
};
async function request(path: string, role: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: sessions[role] ?? "",
      Origin: "http://localhost:3100",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie"),
  };
}
before(async () => {
  for (const role of [
    "cutting_supervisor",
    "cutting_verifier",
    "sewing_supervisor",
  ]) {
    const r = await request("auth/login", "", {
      email: `${role}@apparelflow.demo`,
      password: process.env.DEMO_PASSWORD,
    });
    assert.equal(r.status, 200);
    sessions[role] = r.cookie!.split(";")[0];
  }
  recipe = (await request("recipes", "cutting_supervisor")).data[0];
});
after(() => db.$disconnect());
test("both seeded recipes match the assessment exactly", async () => {
  const recipes = (await request("recipes", "cutting_supervisor")).data;
  const expected = [
    {
      code: "REC-BL01",
      name: "Casual Blouse",
      category: "Blouse",
      fabric: 1.8,
      cap: 5,
      parts: {
        "Front Body Panel": 1,
        "Back Body Panel": 1,
        "Sleeves (Left & Right)": 2,
        "Collar & Stand": 1,
        "Sleeve Cuffs": 2,
      },
    },
    {
      code: "REC-CT02",
      name: "Crop Top",
      category: "Crop Top",
      fabric: 1.1,
      cap: 8,
      parts: {
        "Front Chest Panel": 1,
        "Back Support Panel": 1,
        "Neck Binding Strip": 1,
        "Hem Elastic Casing": 1,
        "Side Strap Accents": 2,
      },
    },
  ];
  for (const e of expected) {
    const r = recipes.find(
      (r: { recipeCode: string }) => r.recipeCode === e.code,
    );
    assert.equal(r.name, e.name);
    assert.equal(r.category, e.category);
    assert.equal(Number(r.stdFabricYards), e.fabric);
    assert.equal(Number(r.wastageCap), e.cap);
    assert.deepEqual(
      Object.fromEntries(
        r.components.map(
          (c: { componentName: string; piecesPerGarment: number }) => [
            c.componentName,
            c.piecesPerGarment,
          ],
        ),
      ),
      e.parts,
    );
  }
});
const supervisor = "cutting_supervisor",
  verifier = "cutting_verifier",
  sewing = "sewing_supervisor";
async function batch(submit = true) {
  const created = await request("orders", supervisor, {
    recipeId: recipe.id,
    targetQty: 50,
    fabricRollId: "TEST-" + Date.now(),
    actualFabricYds: 94.5,
  });
  assert.equal(created.status, 201);
  if (submit) {
    const r = await request(`orders/${created.data.id}/submit`, supervisor, {
      version: 0,
    });
    assert.equal(r.status, 200);
    return { ...created.data, version: 1 };
  }
  return created.data;
}
function counts(delta = 0) {
  return recipe.components.map((c) => ({
    componentId: c.id,
    actualQty: c.piecesPerGarment * 50 + delta,
  }));
}
test("1: authenticated verifier approves GREEN; audit has authenticated identity, counts and wastage", async () => {
  const o = await batch();
  const r = await request(`orders/${o.id}/decision`, verifier, {
    version: 1,
    decision: "APPROVED",
    items: counts(),
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "VERIFIED");
  const log = await db.verificationLog.findFirstOrThrow({
    where: { orderId: o.id },
    include: { verifier: true },
  });
  assert.equal(log.verifier.role, verifier);
  assert.equal(Number(log.wastagePct), 5);
  assert.ok(log.timestamp instanceof Date);
  assert.equal(
    (
      await request(`sewing/queue?status=PENDING_VERIFICATION`, sewing)
    ).data.some((x: { id: string }) => x.id === o.id),
    true,
  );
});
test("2: RED shortage returns 422 and writes no approval", async () => {
  const o = await batch();
  const items = counts();
  items[0].actualQty--;
  assert.equal(
    (
      await request(`orders/${o.id}/decision`, verifier, {
        version: 1,
        decision: "APPROVED",
        items,
      })
    ).status,
    422,
  );
  assert.equal(await db.verificationLog.count({ where: { orderId: o.id } }), 0);
});
test("3: rejection without reason returns 422", async () => {
  const o = await batch();
  for (const rejectionNote of [undefined, "", "   "])
    assert.equal(
      (
        await request(`orders/${o.id}/decision`, verifier, {
          version: 1,
          decision: "REJECTED",
          items: counts(-1),
          rejectionNote,
        })
      ).status,
      422,
    );
});
test("4: both non-verifier roles receive 403", async () => {
  const o = await batch();
  for (const role of [supervisor, sewing])
    assert.equal(
      (
        await request(`orders/${o.id}/decision`, role, {
          version: 1,
          decision: "APPROVED",
          items: counts(),
        })
      ).status,
      403,
    );
});
test("5: database query isolates unapproved batches even with forged URL params", async () => {
  const pending = await batch();
  const draft = await batch(false);
  const rejected = await batch();
  await request(`orders/${rejected.id}/decision`, verifier, {
    version: 1,
    decision: "REJECTED",
    items: counts(-1),
    rejectionNote: "Recut sleeves",
  });
  const q = await request(
    `sewing/queue?status=REJECTED&orderId=${pending.id}`,
    sewing,
  );
  assert.equal(q.status, 200);
  assert.ok(q.data.every((o: { status: string }) => o.status === "VERIFIED"));
  for (const o of [pending, draft, rejected])
    assert.ok(!q.data.some((x: { id: string }) => x.id === o.id));
  assert.equal((await request("orders", sewing)).status, 403);
  for (const role of [supervisor, verifier])
    assert.equal((await request("sewing/queue", role)).status, 403);
});
test("YELLOW excess approval is allowed", async () => {
  const o = await batch();
  assert.equal(
    (
      await request(`orders/${o.id}/decision`, verifier, {
        version: 1,
        decision: "APPROVED",
        items: counts(1),
      })
    ).status,
    200,
  );
});
test("missing, uncounted, duplicate, unknown and malformed counts all return 422", async () => {
  const o = await batch();
  const good = counts();
  const variants = [
    good.slice(1),
    [{ ...good[0], actualQty: null }, ...good.slice(1)],
    [good[0], good[0], ...good.slice(2)],
    [{ ...good[0], componentId: "unknown" }, ...good.slice(1)],
    ...[-1, 1.5, "50", "", true].map((actualQty) => [
      { ...good[0], actualQty },
      ...good.slice(1),
    ]),
  ];
  for (const items of variants)
    assert.equal(
      (
        await request(`orders/${o.id}/decision`, verifier, {
          version: 1,
          decision: "APPROVED",
          items,
        })
      ).status,
      422,
    );
});
test("count drafts persist and stale updates conflict", async () => {
  const o = await batch();
  const items = counts();
  assert.equal(
    (await request(`orders/${o.id}/counts`, verifier, { version: 1, items }))
      .status,
    200,
  );
  assert.equal(
    (await db.verificationItem.findMany({ where: { orderId: o.id } })).every(
      (i) => i.actualQty !== null,
    ),
    true,
  );
  assert.equal(
    (await request(`orders/${o.id}/counts`, verifier, { version: 1, items }))
      .status,
    409,
  );
});
test("invalid order inputs and client-owned authority are rejected", async () => {
  const valid = {
    recipeId: recipe.id,
    targetQty: 50,
    fabricRollId: "ROLL",
    actualFabricYds: 90,
  };
  for (const patch of [
    { targetQty: 0 },
    { targetQty: -2 },
    { targetQty: 1.5 },
    { targetQty: "50" },
    { actualFabricYds: 0 },
    { actualFabricYds: "90" },
    { actualFabricYds: 1.12345 },
    { fabricRollId: " " },
    { status: "VERIFIED" },
    { role: verifier },
    { wastagePct: 0 },
  ])
    assert.equal(
      (await request("orders", supervisor, { ...valid, ...patch })).status,
      422,
    );
  for (const role of [verifier, sewing])
    assert.equal((await request("orders", role, valid)).status, 403);
  assert.equal((await request("orders", "", valid)).status, 401);
});
test("approved records are immutable through API and direct database writes", async () => {
  const o = await batch();
  await request(`orders/${o.id}/decision`, verifier, {
    version: 1,
    decision: "APPROVED",
    items: counts(),
  });
  assert.equal(
    (
      await request(`orders/${o.id}/counts`, verifier, {
        version: 2,
        items: counts(1),
      })
    ).status,
    409,
  );
  const log = await db.verificationLog.findFirstOrThrow({
    where: { orderId: o.id },
  });
  await assert.rejects(
    db.verificationLog.update({
      where: { id: log.id },
      data: { rejectionNote: "tampered" },
    }),
  );
  await assert.rejects(db.verificationLog.delete({ where: { id: log.id } }));
  await assert.rejects(
    db.verificationItem.updateMany({
      where: { orderId: o.id },
      data: { actualQty: 999, status: "YELLOW" },
    }),
  );
  await assert.rejects(
    db.cuttingOrder.update({ where: { id: o.id }, data: { targetQty: 51 } }),
  );
});
test("correction preserves rejected snapshots and permits resubmission", async () => {
  const o = await batch();
  await request(`orders/${o.id}/decision`, verifier, {
    version: 1,
    decision: "REJECTED",
    items: counts(-1),
    rejectionNote: "Recut required",
  });
  assert.equal(
    (
      await request(`orders/${o.id}/correct`, supervisor, {
        version: 2,
        recipeId: recipe.id,
        targetQty: 50,
        fabricRollId: "RECUT",
        actualFabricYds: 96,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`orders/${o.id}/submit`, supervisor, { version: 3 })).status,
    200,
  );
  assert.equal(
    (
      await request(`orders/${o.id}/decision`, verifier, {
        version: 4,
        decision: "APPROVED",
        items: counts(),
      })
    ).status,
    200,
  );
  const logs = await db.verificationLog.findMany({
    where: { orderId: o.id },
    orderBy: { timestamp: "asc" },
  });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].rejectionNote, "Recut required");
});
test("invalid transitions blocked; assembly cannot disclose hidden orders through stale version", async () => {
  const draft = await batch(false);
  assert.equal(
    (
      await request(`orders/${draft.id}/decision`, verifier, {
        version: 0,
        decision: "APPROVED",
        items: counts(),
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(`orders/${draft.id}/assemble`, sewing, { version: 999 }))
      .status,
    404,
  );
  const o = await batch();
  assert.equal(
    (await request(`orders/${o.id}/submit`, supervisor, { version: 1 })).status,
    409,
  );
  await request(`orders/${o.id}/decision`, verifier, {
    version: 1,
    decision: "APPROVED",
    items: counts(),
  });
  assert.equal(
    (await request(`orders/${o.id}/assemble`, supervisor, { version: 2 }))
      .status,
    403,
  );
  assert.equal(
    (await request(`orders/${o.id}/assemble`, sewing, { version: 2 })).status,
    200,
  );
  assert.equal(
    (await request(`orders/${o.id}/assemble`, sewing, { version: 3 })).status,
    409,
  );
});
test("concurrent approvals produce one decision and one conflict", async () => {
  const o = await batch();
  const results = await Promise.all(
    [1, 2].map(() =>
      request(`orders/${o.id}/decision`, verifier, {
        version: 1,
        decision: "APPROVED",
        items: counts(),
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await db.verificationLog.count({ where: { orderId: o.id } }), 1);
});
test("forged audit identity, expected counts and cookies cannot grant authority", async () => {
  const o = await batch();
  assert.equal(
    (
      await request(`orders/${o.id}/decision`, verifier, {
        version: 1,
        decision: "APPROVED",
        items: counts(),
        verifierId: "fake",
        timestamp: "2000-01-01",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request(`orders/${o.id}/decision`, verifier, {
        version: 1,
        decision: "APPROVED",
        items: counts().map((i) => ({ ...i, expectedQty: 0 })),
      })
    ).status,
    422,
  );
  sessions.fake = "af_session=forged; role=cutting_verifier";
  assert.equal(
    (
      await request(`orders/${o.id}/decision`, "fake", {
        version: 1,
        decision: "APPROVED",
        items: counts(),
      })
    ).status,
    401,
  );
});
test("cross-origin writes and incorrect passwords fail", async () => {
  const r = await fetch(base + "orders", {
    method: "POST",
    headers: {
      Origin: "https://evil.example",
      cookie: sessions[supervisor],
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
  assert.equal(
    (
      await request("auth/login", "", {
        email: `${verifier}@apparelflow.demo`,
        password: "wrong",
      })
    ).status,
    401,
  );
});
