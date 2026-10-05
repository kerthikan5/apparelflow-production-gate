import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { db } from './db';
import { HttpError } from './security';

const count = z.number().int().min(0).max(10000000);
export const orderInput = z.object({ recipeId: z.string().min(1), targetQty: count.min(1).max(100000), fabricRollId: z.string().trim().min(1).max(80), actualFabricYds: z.number().positive().max(10000000).refine(n => Math.abs(n * 10000 - Math.round(n * 10000)) < 0.00001, 'Use up to four decimal places.') }).strict();
export const countsInput = z.object({ version: z.number().int().min(0), items: z.array(z.object({ componentId: z.string(), actualQty: count.nullable() }).strict()).max(100) }).strict();
export const decisionInput = countsInput.extend({ decision: z.enum(['APPROVED', 'REJECTED']), rejectionNote: z.string().trim().max(2000).optional() });
export const versionInput = z.object({ version: z.number().int().min(0) }).strict();
export const orderInclude = { recipe: { include: { components: true } }, items: { include: { component: true } }, logs: { include: { verifier: { select: { fullName: true, email: true } } }, orderBy: { timestamp: 'desc' as const } } };
export function fabric(actual: Prisma.Decimal | string | number, standard: Prisma.Decimal | string | number, quantity: number) {
  const expected = new Prisma.Decimal(standard).mul(quantity);
  return { expectedFabric: expected.toString(), wastagePct: new Prisma.Decimal(actual).sub(expected).div(expected).mul(100).toFixed(4) };
}
export async function listOrders(role: Role) {
  // This predicate is server-owned and cannot be overridden by query parameters.
  return db.cuttingOrder.findMany({ where: role === 'sewing_supervisor' ? { status: 'VERIFIED' } : role === 'cutting_verifier' ? { status: { in: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'] } } : {}, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 200 });
}
export async function createOrder(input: unknown, userId: string) {
  const data = orderInput.parse(input);
  const recipe = await db.recipe.findUnique({ where: { id: data.recipeId }, include: { components: true } });
  if (!recipe) throw new HttpError(422, 'Choose an existing recipe.');
  return db.cuttingOrder.create({ data: { ...data, createdBy: userId, items: { create: recipe.components.map(c => ({ componentId: c.id, expectedQty: c.piecesPerGarment * data.targetQty })) } }, include: orderInclude });
}
export async function actOnOrder(id: string, action: string, input: unknown, userId: string) {
  return db.$transaction(async tx => {
    // Row lock serializes all mutations of a batch, including counts and corrections.
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "CuttingOrder" WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw new HttpError(404, 'Batch not found.');
    const order = await tx.cuttingOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
    const requireVersion = (version: number) => { if (order.version !== version) throw new HttpError(409, 'This batch changed. Refresh before trying again.'); };
    const bump = { version: { increment: 1 } };
    if (action === 'correct') {
      const parsed = orderInput.extend({ version: z.number().int().min(0) }).parse(input);
      requireVersion(parsed.version);
      if (!['CUTTING_IN_PROGRESS','REJECTED'].includes(order.status)) throw new HttpError(409, 'Only draft or rejected batches can be corrected.');
      const { version: _version, ...data } = parsed;
      const recipe = await tx.recipe.findUnique({ where: { id: data.recipeId }, include: { components: true } });
      if (!recipe) throw new HttpError(422, 'Recipe not found.');
      await tx.verificationItem.deleteMany({ where: { orderId: id } });
      return tx.cuttingOrder.update({ where: { id }, data: { ...data, ...bump, status: 'CUTTING_IN_PROGRESS', items: { create: recipe.components.map(c => ({ componentId: c.id, expectedQty: data.targetQty * c.piecesPerGarment })) } } });
    }
    if (action === 'submit' || action === 'assemble') {
      const data = versionInput.parse(input);
      if (action === 'assemble' && order.status !== 'VERIFIED') throw new HttpError(404, 'Verified batch not found.');
      requireVersion(data.version);
      if (action === 'submit') {
        if (order.status !== 'CUTTING_IN_PROGRESS') throw new HttpError(409, 'Prepare or correct the batch before submission.');
        return tx.cuttingOrder.update({ where: { id }, data: { status: 'PENDING_VERIFICATION', ...bump } });
      }
      // Use 404 to avoid exposing an unverified order to sewing users.
      if (order.status !== 'VERIFIED') throw new HttpError(404, 'Verified batch not found.');
      if (order.assemblyStartedAt) throw new HttpError(409, 'Assembly has already started.');
      return tx.cuttingOrder.update({ where: { id }, data: { assemblyStartedAt: new Date(), ...bump } });
    }
    const decision = action === 'decision' ? decisionInput.parse(input) : null;
    const parsed = decision ?? countsInput.parse(input);
    requireVersion(parsed.version);
    if (order.status !== 'PENDING_VERIFICATION') throw new HttpError(409, 'Only pending batches can be counted or verified.');
    const ids = new Set(parsed.items.map(i => i.componentId));
    if (ids.size !== parsed.items.length || ids.size !== order.recipe.components.length || order.recipe.components.some(c => !ids.has(c.id))) throw new HttpError(422, 'Include each recipe component exactly once.');
    const snapshots = order.recipe.components.map(c => {
      const actualQty = parsed.items.find(i => i.componentId === c.id)!.actualQty;
      const expectedQty = c.piecesPerGarment * order.targetQty;
      return { componentId: c.id, componentName: c.componentName, expectedQty, actualQty, variance: actualQty === null ? null : actualQty - expectedQty, status: actualQty === null ? null : actualQty < expectedQty ? 'RED' as const : actualQty > expectedQty ? 'YELLOW' as const : 'GREEN' as const };
    });
    if (decision) {
      if (decision.decision === 'APPROVED' && snapshots.some(s => s.actualQty === null || s.status === 'RED')) throw new HttpError(422, 'Every component must be counted with no shortages.');
      if (decision.decision === 'REJECTED' && !decision.rejectionNote) throw new HttpError(422, 'A rejection reason is required.');
      const metrics = fabric(order.actualFabricYds, order.recipe.stdFabricYards, order.targetQty);
      await tx.verificationLog.create({ data: { orderId: id, verifierId: userId, decision: decision.decision, rejectionNote: decision.decision === 'REJECTED' ? decision.rejectionNote : null, wastagePct: metrics.wastagePct, snapshot: { recipeCode: order.recipe.recipeCode, targetQty: order.targetQty, actualFabricYds: order.actualFabricYds.toString(), ...metrics, items: snapshots } } });
    }
    for (const item of snapshots) await tx.verificationItem.update({ where: { orderId_componentId: { orderId: id, componentId: item.componentId } }, data: { actualQty: item.actualQty, expectedQty: item.expectedQty, status: item.status } });
    return tx.cuttingOrder.update({ where: { id }, data: { ...bump, ...(decision ? { status: decision.decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED' } : {}) } });
  });
}
