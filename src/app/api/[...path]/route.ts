import { randomBytes } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  authenticate,
  checkPassword,
  hashPassword,
  HttpError,
  protectOrigin,
  sessionToken,
  tokenHash,
} from "@/lib/security";
import { actOnOrder, createOrder, fabric, listOrders } from "@/lib/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dummyHash = hashPassword(randomBytes(32).toString("hex"));
const cookie = (value: string, age: number) =>
  `af_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
async function handle(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await ctx.params;
    const route = path.join("/");
    const write = req.method === "POST";
    if (write) protectOrigin(req);
    const body = async () => {
      try {
        const text = await req.text();
        if (text.length > 20000) throw new HttpError(413, "Request too large.");
        return JSON.parse(text);
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(422, "Send a valid JSON payload.");
      }
    };
    if (write && route === "auth/login") {
      const data = z
        .object({ email: z.email(), password: z.string().min(1).max(256) })
        .strict()
        .parse(await body());
      const user = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      const valid = checkPassword(
        data.password,
        user?.passwordHash ?? dummyHash,
      );
      if (!user || !valid)
        throw new HttpError(401, "Email or password is incorrect.");
      const old = sessionToken(req);
      const token = randomBytes(32).toString("hex");
      await db.$transaction(async (tx) => {
        if (old) await tx.session.deleteMany({ where: { id: tokenHash(old) } });
        await tx.session.create({
          data: {
            id: tokenHash(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
          },
        });
      });
      return json({ role: user.role }, 200, {
        "Set-Cookie": cookie(token, 28800),
      });
    }
    if (write && route === "auth/logout") {
      const token = sessionToken(req);
      if (token)
        await db.session.deleteMany({ where: { id: tokenHash(token) } });
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (!write && route === "me") {
      const user = await authenticate(req);
      return json({
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      });
    }
    if (!write && route === "recipes") {
      await authenticate(req, ["cutting_supervisor", "cutting_verifier"]);
      return json(
        await db.recipe.findMany({
          include: { components: true },
          orderBy: { recipeCode: "asc" },
        }),
      );
    }
    if (!write && (route === "orders" || route === "sewing/queue")) {
      const user = await authenticate(
        req,
        route === "sewing/queue"
          ? ["sewing_supervisor"]
          : ["cutting_supervisor", "cutting_verifier"],
      );
      const orders = await listOrders(user.role);
      return json(
        orders.map((o) => ({
          ...o,
          ...fabric(o.actualFabricYds, o.recipe.stdFabricYards, o.targetQty),
        })),
      );
    }
    if (write && route === "orders") {
      const user = await authenticate(req, ["cutting_supervisor"]);
      return json(await createOrder(await body(), user.id), 201);
    }
    if (write && path.length === 3 && path[0] === "orders") {
      const action = path[2];
      const roles: Record<string, Role[]> = {
        correct: ["cutting_supervisor"],
        submit: ["cutting_supervisor"],
        counts: ["cutting_verifier"],
        decision: ["cutting_verifier"],
        assemble: ["sewing_supervisor"],
      };
      if (!roles[action]) throw new HttpError(404, "Action not found.");
      const user = await authenticate(req, roles[action]);
      return json(await actOnOrder(path[1], action, await body(), user.id));
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join("; "),
        },
        422,
      );
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2002"].includes(e.code)
    )
      return json({ error: "Conflicting request. Refresh and retry." }, 409);
    console.error(e);
    return json({ error: "The server could not complete this request." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
