/**
 * Zod schemas for procurement actions (Phase 6)
 * Used before calling procurementApprove, procurementClose
 */

import { z } from 'zod';

const tenantIdSchema = z.string().min(1, 'tenantId مطلوب').max(128);
const requestIdSchema = z.string().min(1, 'requestId مطلوب').max(128);
const managerIdSchema = z.string().min(1, 'managerId مطلوب').max(128);
const managerNameSchema = z.string().min(1, 'managerName مطلوب').max(200);

export const approveProcurementPayloadSchema = z.object({
  requestId: requestIdSchema,
  tenantId: tenantIdSchema,
  managerId: managerIdSchema,
  managerName: managerNameSchema,
});

export const closeProcurementPayloadSchema = z.object({
  requestId: requestIdSchema,
  tenantId: tenantIdSchema,
});

export type ApproveProcurementPayload = z.infer<typeof approveProcurementPayloadSchema>;
export type CloseProcurementPayload = z.infer<typeof closeProcurementPayloadSchema>;
