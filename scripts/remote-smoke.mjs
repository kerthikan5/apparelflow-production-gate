import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL?.replace(/\/$/, "");
const password = process.env.DEMO_PASSWORD;
if (!baseUrl || !password) {
  throw new Error("Set BASE_URL and DEMO_PASSWORD before running this script.");
}

const roles = ["cutting_supervisor", "cutting_verifier", "sewing_supervisor"];
const sessions = {};

async function request(path, role, body) {
  const response = await fetch(`${baseUrl}/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      ...(sessions[role] ? { Cookie: sessions[role] } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

for (const role of roles) {
  const { response } = await request("auth/login", "", {
    email: `${role}@apparelflow.demo`,
    password,
  });
  assert.equal(response.status, 200, `${role} login failed`);
  sessions[role] = response.headers.get("set-cookie").split(";")[0];
}
console.log("PASS: all three roles authenticated using server sessions");

const supervisor = "cutting_supervisor";
const verifier = "cutting_verifier";
const sewing = "sewing_supervisor";
const recipesResult = await request("recipes", supervisor);
assert.equal(recipesResult.response.status, 200);
const recipe = recipesResult.data.find(
  (item) => item.recipeCode === "REC-BL01",
);
assert.ok(recipe, "Casual Blouse recipe not found");

async function createSubmitted(suffix) {
  const created = await request("orders", supervisor, {
    recipeId: recipe.id,
    targetQty: 50,
    fabricRollId: `REMOTE-${suffix}-${Date.now()}`,
    actualFabricYds: 94.5,
  });
  assert.equal(created.response.status, 201, "order creation failed");
  const submitted = await request(
    `orders/${created.data.id}/submit`,
    supervisor,
    { version: 0 },
  );
  assert.equal(submitted.response.status, 200, "order submission failed");
  return { ...created.data, version: 1 };
}

const expectedCounts = recipe.components.map((component) => ({
  componentId: component.id,
  actualQty: component.piecesPerGarment * 50,
}));
const shortageCounts = expectedCounts.map((item, index) =>
  index === 0 ? { ...item, actualQty: item.actualQty - 1 } : item,
);

const order = await createSubmitted("WORKFLOW");
for (const role of [supervisor, sewing]) {
  const denied = await request(`orders/${order.id}/decision`, role, {
    version: 1,
    decision: "APPROVED",
    items: expectedCounts,
  });
  assert.equal(
    denied.response.status,
    403,
    `${role} approval was not forbidden`,
  );
}
console.log("PASS: non-verifier approvals return 403");

const missing = await request(`orders/${order.id}/decision`, verifier, {
  version: 1,
  decision: "APPROVED",
  items: expectedCounts.slice(1),
});
assert.equal(missing.response.status, 422);
const shortage = await request(`orders/${order.id}/decision`, verifier, {
  version: 1,
  decision: "APPROVED",
  items: shortageCounts,
});
assert.equal(shortage.response.status, 422);
const noReason = await request(`orders/${order.id}/decision`, verifier, {
  version: 1,
  decision: "REJECTED",
  items: shortageCounts,
  rejectionNote: "",
});
assert.equal(noReason.response.status, 422);
console.log("PASS: missing/shortage approvals and blank rejection return 422");

const rejected = await request(`orders/${order.id}/decision`, verifier, {
  version: 1,
  decision: "REJECTED",
  items: shortageCounts,
  rejectionNote: "Remote deployment verification: recut front panel",
});
assert.equal(rejected.response.status, 200);
assert.equal(rejected.data.status, "REJECTED");
let queue = await request("sewing/queue?status=REJECTED", sewing);
assert.equal(queue.response.status, 200);
assert.ok(!queue.data.some((item) => item.id === order.id));
console.log("PASS: rejected batch is absent from Sewing Queue");

const corrected = await request(`orders/${order.id}/correct`, supervisor, {
  version: 2,
  recipeId: recipe.id,
  targetQty: 50,
  fabricRollId: `REMOTE-CORRECTED-${Date.now()}`,
  actualFabricYds: 95,
});
assert.equal(corrected.response.status, 200);
assert.equal(corrected.data.status, "CUTTING_IN_PROGRESS");
const resubmitted = await request(`orders/${order.id}/submit`, supervisor, {
  version: 3,
});
assert.equal(resubmitted.response.status, 200);

const pending = await createSubmitted("PENDING");
queue = await request(`sewing/queue?status=PENDING_VERIFICATION`, sewing);
assert.ok(!queue.data.some((item) => item.id === pending.id));
console.log(
  "PASS: correction/resubmission works; pending batch stays out of queue",
);

const yellowCounts = expectedCounts.map((item, index) =>
  index === 2 ? { ...item, actualQty: item.actualQty + 1 } : item,
);
const saved = await request(`orders/${order.id}/counts`, verifier, {
  version: 4,
  items: yellowCounts,
});
assert.equal(saved.response.status, 200);
const refreshedOrders = await request("orders", verifier);
const persisted = refreshedOrders.data.find((item) => item.id === order.id);
assert.ok(persisted);
assert.ok(persisted.items.some((item) => item.status === "YELLOW"));
console.log(
  "PASS: saved counts persist across a fresh request; YELLOW is stored",
);

const approved = await request(`orders/${order.id}/decision`, verifier, {
  version: 5,
  decision: "APPROVED",
  items: yellowCounts,
});
assert.equal(approved.response.status, 200);
assert.equal(approved.data.status, "VERIFIED");
queue = await request("sewing/queue", sewing);
const queued = queue.data.find((item) => item.id === order.id);
assert.ok(queued);
assert.ok(queued.logs.some((log) => log.decision === "APPROVED"));
assert.ok(queued.logs.some((log) => log.decision === "REJECTED"));
console.log(
  "PASS: YELLOW approval succeeds and preserves rejection/audit history",
);

const assembled = await request(`orders/${order.id}/assemble`, sewing, {
  version: 6,
});
assert.equal(assembled.response.status, 200);
queue = await request("sewing/queue", sewing);
const afterAssembly = queue.data.find((item) => item.id === order.id);
assert.ok(afterAssembly.assemblyStartedAt);
const repeatedAssembly = await request(`orders/${order.id}/assemble`, sewing, {
  version: 7,
});
assert.equal(repeatedAssembly.response.status, 409);
console.log("PASS: assembly starts, persists, and cannot be started twice");

console.log(`REMOTE SMOKE PASS: ${baseUrl}`);
