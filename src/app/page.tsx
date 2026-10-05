"use client";

import { FormEvent, useEffect, useState } from "react";

type Component = {
  id: string;
  componentName: string;
  piecesPerGarment: number;
};
type Recipe = {
  id: string;
  name: string;
  recipeCode: string;
  stdFabricYards: string;
  wastageCap: string;
  components: Component[];
};
type Item = {
  componentId: string;
  expectedQty: number;
  actualQty: number | null;
  component: Component;
};
type Audit = {
  id: string;
  decision: string;
  rejectionNote: string | null;
  timestamp: string;
  wastagePct: string;
  verifier: { fullName: string };
  snapshot: {
    items: {
      componentName: string;
      expectedQty: number;
      actualQty: number | null;
      variance: number | null;
    }[];
  };
};
type Order = {
  id: string;
  orderNo: number;
  recipe: Recipe;
  recipeId: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: string;
  status: string;
  version: number;
  items: Item[];
  logs: Audit[];
  assemblyStartedAt: string | null;
  expectedFabric: string;
  wastagePct: string;
};
type User = { fullName: string; role: string; email: string };
const roles = ["cutting_supervisor", "cutting_verifier", "sewing_supervisor"];
const label = (s: string) => s.toLowerCase().replaceAll("_", " ");
async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
  return result;
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>{label(status)}</span>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Order | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  async function refresh(current = user) {
    if (!current) return;
    const sewing = current.role === "sewing_supervisor";
    const [batches, productionRecipes] = await Promise.all([
      api<Order[]>(sewing ? "sewing/queue" : "orders"),
      sewing ? Promise.resolve([]) : api<Recipe[]>("recipes"),
    ]);
    setOrders(batches);
    setRecipes(productionRecipes);
  }
  useEffect(() => {
    api<User>("me")
      .then(async (u) => {
        setUser(u);
        await refresh(u);
      })
      .catch((e) => {
        if (e.message !== "Please sign in.") setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []); // initial session restoration
  async function run(task: () => Promise<unknown>, shouldRefresh = true) {
    setBusy(true);
    setError("");
    try {
      await task();
      if (shouldRefresh) await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="loading" aria-live="polite">
        Loading production workspace…
      </main>
    );
  if (!user)
    return (
      <Login
        error={error}
        onLogin={async (email, password) => {
          setError("");
          try {
            await api("auth/login", { email, password });
            const current = await api<User>("me");
            setUser(current);
            await refresh(current);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    );
  const sewing = user.role === "sewing_supervisor";
  const cutting = user.role === "cutting_supervisor";
  const active = orders.find((o) => o.id === selected);
  const visible = orders.filter((o) => filter === "ALL" || o.status === filter);
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          a
          <span>
            ApparelFlow<span className="brand-sub">PRODUCTION OPERATIONS</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="nav-active">
          {sewing
            ? "▦ Sewing queue"
            : cutting
              ? "▤ Cutting orders"
              : "◉ Verification terminal"}
        </div>
        <div className="sidebar-note">
          <span className="live-dot" /> Quality gate active
          <p>
            Every piece accounted for.
            <br />
            Every handoff verified.
          </p>
        </div>
        <div className="profile">
          <div className="avatar">
            {user.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{label(user.role)}</strong>
            <small>Authenticated workspace</small>
          </div>
        </div>
        <button
          className="sidebar-button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api("auth/logout", {});
              setUser(null);
              setOrders([]);
              setRecipes([]);
              setSelected(null);
            }, false)
          }
        >
          Sign out / switch role ↗
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Factory operations{" "}
            <span className="muted">
              / {sewing ? "Assembly" : "Cutting department"}
            </span>
          </span>
          <span className="top-tag">APPARELFLOW ERP</span>
        </header>
        <div className="page-heading">
          <div>
            <div className="eyebrow">PRODUCTION CONTROL</div>
            <h1>
              {sewing
                ? "Ready for the sewing floor."
                : cutting
                  ? "Good production starts here."
                  : "Count. Check. Release."}
            </h1>
            <p>
              {sewing
                ? "Verified batches, with a complete quality record."
                : cutting
                  ? "Prepare cutting batches and follow each one through quality control."
                  : "Verify every component before it reaches the assembly line."}
            </p>
          </div>
          {cutting && (
            <button className="primary" onClick={() => setEditing(null)}>
              + Create cutting order
            </button>
          )}
        </div>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        <section className="metrics">
          <Metric
            title={sewing ? "Verified batches" : "Total batches"}
            value={orders.length}
            detail="In this workspace"
          />
          <Metric
            title={sewing ? "Ready to assemble" : "Awaiting verification"}
            value={
              orders.filter((o) =>
                sewing
                  ? !o.assemblyStartedAt
                  : o.status === "PENDING_VERIFICATION",
              ).length
            }
            detail={
              sewing ? "Quality gate passed" : "At the quality checkpoint"
            }
          />
          <Metric
            title={sewing ? "Assembly started" : "Verified & released"}
            value={
              orders.filter((o) =>
                sewing ? o.assemblyStartedAt : o.status === "VERIFIED",
              ).length
            }
            detail="Traceable handoffs"
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{sewing ? "Sewing queue" : "Production batches"}</h2>
              <p>{visible.length} batches · latest first</p>
            </div>
            <div className="toolbar">
              {!sewing && (
                <label className="filter">
                  Status
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="ALL">All statuses</option>
                    {[
                      "CUTTING_IN_PROGRESS",
                      "PENDING_VERIFICATION",
                      "REJECTED",
                      "VERIFIED",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button disabled={busy} onClick={() => run(() => refresh())}>
                Refresh
              </button>
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">▤</div>
              <h3>
                {sewing
                  ? "No verified batches yet"
                  : "Your next batch starts here"}
              </h3>
              <p>
                {sewing
                  ? "Batches appear after a Cutting Verifier signs them off."
                  : cutting
                    ? "Create a cutting order to begin the production workflow."
                    : "Submitted cutting batches will appear here for counting."}
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Batch / recipe</th>
                    <th>Quantity</th>
                    <th>Fabric roll</th>
                    <th>Status</th>
                    <th>Wastage</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>AF-{String(o.orderNo).padStart(4, "0")}</strong>
                        <small>
                          {o.recipe.name} · {o.recipe.recipeCode}
                        </small>
                      </td>
                      <td>
                        {o.targetQty}
                        <small>garments</small>
                      </td>
                      <td>{o.fabricRollId}</td>
                      <td>
                        <Badge
                          status={
                            o.assemblyStartedAt ? "ASSEMBLY_STARTED" : o.status
                          }
                        />
                      </td>
                      <td>
                        <span
                          className={
                            Number(o.wastagePct) > Number(o.recipe.wastageCap)
                              ? "warning-text"
                              : ""
                          }
                        >
                          {Number(o.wastagePct).toFixed(2)}%
                        </span>
                        <small>Cap {o.recipe.wastageCap}%</small>
                      </td>
                      <td>
                        <button onClick={() => setSelected(o.id)}>
                          Open batch ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <footer>
          <span className="live-dot" /> Server-verified handoffs{" "}
          <span>Cutting → Quality control → Sewing</span>
        </footer>
      </main>
      {editing !== undefined && (
        <OrderForm
          recipes={recipes}
          order={editing}
          close={() => setEditing(undefined)}
          save={async (data) => {
            await api(
              editing ? `orders/${editing.id}/correct` : "orders",
              editing ? { ...data, version: editing.version } : data,
            );
            setEditing(undefined);
            await refresh();
          }}
        />
      )}
      {active && (
        <Batch
          key={`${active.id}-${active.version}`}
          order={active}
          role={user.role}
          close={() => setSelected(null)}
          edit={() => {
            setEditing(active);
            setSelected(null);
          }}
          act={async (action, data) => {
            await api(`orders/${active.id}/${action}`, data);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{String(value).padStart(2, "0")}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Login({
  error,
  onLogin,
}: {
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [role, setRole] = useState(roles[0]);
  const [password, setPassword] = useState(
    process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "",
  );
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          a<span>ApparelFlow</span>
        </div>
        <div>
          <div className="eyebrow">PRECISION AT EVERY HANDOFF</div>
          <h1>
            Better batches.
            <br />A smoother
            <br />
            <em>sewing floor.</em>
          </h1>
          <p>
            The production checkpoint that makes sure every piece is ready for
            what comes next.
          </p>
          <div className="flow">
            <span>01 Cutting</span>
            <span>02 Verification</span>
            <span>03 Sewing</span>
          </div>
        </div>
        <small>APPARELFLOW ERP / QUALITY OPERATIONS</small>
      </section>
      <section className="login-form">
        <div className="eyebrow">WELCOME TO YOUR WORKSPACE</div>
        <h2>Sign in to production</h2>
        <p>Choose a demo account to explore each role.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onLogin(`${role}@apparelflow.demo`, password);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Factory role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Email
            <input
              readOnly
              value={`${role}@apparelflow.demo`}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Enter workspace →"}
          </button>
        </form>
        <div className="demo-note">
          <strong>Demo access</strong>
          <p>
            Each selection signs in as a separate account with its own
            permissions.
          </p>
          {process.env.NEXT_PUBLIC_DEMO_PASSWORD ? (
            <p>
              Demo password:{" "}
              <code>{process.env.NEXT_PUBLIC_DEMO_PASSWORD}</code>
            </p>
          ) : (
            <p>Use the demo password configured during database setup.</p>
          )}
        </div>
      </section>
    </main>
  );
}
function OrderForm({
  recipes,
  order,
  close,
  save,
}: {
  recipes: Recipe[];
  order: Order | null;
  close: () => void;
  save: (data: {
    recipeId: string;
    targetQty: number;
    fabricRollId: string;
    actualFabricYds: number;
  }) => Promise<void>;
}) {
  const [recipeId, setRecipeId] = useState(
    order?.recipeId ?? recipes[0]?.id ?? "",
  );
  const [qty, setQty] = useState(String(order?.targetQty ?? 50));
  const [roll, setRoll] = useState(order?.fabricRollId ?? "");
  const [yards, setYards] = useState(order?.actualFabricYds ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const recipe = recipes.find((r) => r.id === recipeId);
  const validQty =
    /^\d+$/.test(qty) && Number(qty) > 0 && Number(qty) <= 100000;
  const expected =
    recipe && validQty ? Number(recipe.stdFabricYards) * Number(qty) : 0;
  const validYards =
    /^\d+(\.\d{1,4})?$/.test(yards) &&
    Number(yards) > 0 &&
    Number(yards) <= 10000000;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await save({
        recipeId,
        targetQty: Number(qty),
        fabricRollId: roll.trim(),
        actualFabricYds: Number(yards),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-title"
        className="dialog"
      >
        <div className="dialog-header">
          <div>
            <div className="eyebrow">CUTTING PREPARATION</div>
            <h2 id="order-title">
              {order ? "Correct cutting order" : "Create cutting order"}
            </h2>
          </div>
          <button onClick={close} aria-label="Close order form">
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Production recipe
            <select
              autoFocus
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.recipeCode}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Target garments
              <input
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                aria-invalid={!validQty}
              />
              {!validQty && (
                <span className="field-error">
                  Enter a whole quantity from 1 to 100,000.
                </span>
              )}
            </label>
            <label>
              Fabric roll ID
              <input
                placeholder="FAB-ROLL-882"
                maxLength={80}
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Actual fabric used (yards)
            <input
              inputMode="decimal"
              placeholder="e.g. 94.5"
              value={yards}
              onChange={(e) => setYards(e.target.value)}
              required
              aria-invalid={!!yards && !validYards}
            />
            {yards && !validYards && (
              <span className="field-error">
                Enter positive yards, up to four decimal places.
              </span>
            )}
          </label>
          <div className="calculation">
            <strong>Expected components</strong>
            <p>{validQty ? qty : "—"} garments × recipe quantities</p>
            {recipe?.components.map((c) => (
              <div key={c.id}>
                <span>{c.componentName}</span>
                <strong>
                  {validQty ? Number(qty) * c.piecesPerGarment : "—"} pcs
                </strong>
              </div>
            ))}
            <div>
              <span>Standard fabric</span>
              <strong>
                {expected.toFixed(2)} yd · cap {recipe?.wastageCap}%
              </strong>
            </div>
            {validYards && expected > 0 && (
              <div>
                <span>Estimated wastage</span>
                <strong>
                  {(((Number(yards) - expected) / expected) * 100).toFixed(2)}%
                </strong>
              </div>
            )}
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={
                busy || !validQty || !validYards || !roll.trim() || !recipeId
              }
            >
              {busy ? "Saving…" : "Save preparation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function Batch({
  order: o,
  role,
  close,
  edit,
  act,
}: {
  order: Order;
  role: string;
  close: () => void;
  edit: () => void;
  act: (action: string, data: unknown) => Promise<void>;
}) {
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(
      o.items.map((i) => [
        i.componentId,
        i.actualQty === null ? "" : String(i.actualQty),
      ]),
    ),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canCount =
    role === "cutting_verifier" && o.status === "PENDING_VERIFICATION";
  const valid = (s: string) => /^\d+$/.test(s) && Number(s) <= 10000000;
  const malformed = o.items.some(
    (i) => counts[i.componentId] !== "" && !valid(counts[i.componentId]),
  );
  const blocked = o.items.some(
    (i) =>
      !valid(counts[i.componentId]) ||
      Number(counts[i.componentId]) < i.expectedQty,
  );
  const items = o.items.map((i) => ({
    componentId: i.componentId,
    actualQty:
      counts[i.componentId] === "" ? null : Number(counts[i.componentId]),
  }));
  async function action(name: string, extra = {}) {
    setBusy(true);
    setError("");
    try {
      await act(name, { version: o.version, ...extra });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-title"
        className="dialog wide"
      >
        <div className="dialog-header">
          <div>
            <div className="eyebrow">
              BATCH AF-{String(o.orderNo).padStart(4, "0")}
            </div>
            <h2 id="batch-title">{o.recipe.name}</h2>
            <p>
              {o.targetQty} garments · {o.fabricRollId}
            </p>
          </div>
          <button autoFocus onClick={close} aria-label="Close batch">
            ✕
          </button>
        </div>
        <Badge status={o.assemblyStartedAt ? "ASSEMBLY_STARTED" : o.status} />
        <div className="fabric-summary">
          <span>
            Used <strong>{o.actualFabricYds} yd</strong>
          </span>
          <span>
            Expected <strong>{o.expectedFabric} yd</strong>
          </span>
          <span>
            Wastage <strong>{Number(o.wastagePct).toFixed(2)}%</strong>
          </span>
        </div>
        {Number(o.wastagePct) > Number(o.recipe.wastageCap) && (
          <div className="warning-banner">
            Above the {o.recipe.wastageCap}% recipe wastage cap. Review fabric
            use; this warning does not block approval.
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Variance / result</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i) => {
                const value = counts[i.componentId];
                const good = valid(value);
                const difference = Number(value) - i.expectedQty;
                return (
                  <tr key={i.componentId}>
                    <td>{i.component.componentName}</td>
                    <td>{i.expectedQty}</td>
                    <td>
                      {canCount ? (
                        <input
                          className="count-input"
                          aria-label={`Actual ${i.component.componentName}`}
                          inputMode="numeric"
                          value={value}
                          aria-invalid={value !== "" && !good}
                          onChange={(e) =>
                            setCounts({
                              ...counts,
                              [i.componentId]: e.target.value,
                            })
                          }
                        />
                      ) : (
                        (i.actualQty ?? "Uncounted")
                      )}
                    </td>
                    <td>
                      {!good ? (
                        <span className={value ? "field-error" : "muted"}>
                          {value ? "Invalid count" : "Uncounted"}
                        </span>
                      ) : (
                        <>
                          <Badge
                            status={
                              difference < 0
                                ? "RED"
                                : difference > 0
                                  ? "YELLOW"
                                  : "GREEN"
                            }
                          />
                          <small>
                            {difference > 0 ? "+" : ""}
                            {difference} ·{" "}
                            {difference < 0
                              ? "Shortage"
                              : difference > 0
                                ? "Excess"
                                : "Match"}
                          </small>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {canCount && (
          <>
            <p className="hint">
              Every component needs a whole count. Excess may pass; shortages
              cannot.
            </p>
            <label>
              Rejection reason (required to reject)
              <textarea
                value={note}
                maxLength={2000}
                placeholder="Describe the shortage or defect and the correction needed…"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                disabled={busy || malformed}
                onClick={() => action("counts", { items })}
              >
                Save counts
              </button>
              <button
                className="danger"
                disabled={busy || malformed || !note.trim()}
                onClick={() =>
                  action("decision", {
                    items,
                    decision: "REJECTED",
                    rejectionNote: note,
                  })
                }
              >
                Reject batch
              </button>
              <button
                className="primary"
                disabled={busy || blocked}
                onClick={() =>
                  action("decision", { items, decision: "APPROVED" })
                }
              >
                {busy ? "Saving…" : "Approve batch"}
              </button>
            </div>
            {blocked && (
              <p className="hint">
                Approval blocked: resolve all shortages and uncounted
                components.
              </p>
            )}
          </>
        )}
        {role === "cutting_supervisor" &&
          ["CUTTING_IN_PROGRESS", "REJECTED"].includes(o.status) && (
            <div className="actions">
              <button onClick={edit}>Edit / correct batch</button>
              {o.status === "CUTTING_IN_PROGRESS" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => action("submit")}
                >
                  Submit for verification →
                </button>
              )}
            </div>
          )}
        {role === "sewing_supervisor" && !o.assemblyStartedAt && (
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => action("assemble")}
            >
              Start Sewing Assembly →
            </button>
          </div>
        )}
        {o.assemblyStartedAt && (
          <p className="success-text">
            Assembly started {new Date(o.assemblyStartedAt).toLocaleString()}
          </p>
        )}
        <section className="audit">
          <h3>Verification history</h3>
          {!o.logs.length && <p>No verification decisions yet.</p>}
          {o.logs.map((log) => (
            <details key={log.id}>
              <summary>
                <Badge status={log.decision} />
                <strong>{log.verifier.fullName}</strong>
                <span>{new Date(log.timestamp).toLocaleString()}</span>
              </summary>
              {log.rejectionNote && <p>{log.rejectionNote}</p>}
              <p>Recorded wastage: {Number(log.wastagePct).toFixed(2)}%</p>
              {log.snapshot.items.map((i, index) => (
                <p key={index}>
                  {i.componentName}: {i.actualQty ?? "uncounted"} /{" "}
                  {i.expectedQty} · variance {i.variance ?? "—"}
                </p>
              ))}
            </details>
          ))}
        </section>
      </section>
    </div>
  );
}
