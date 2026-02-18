/**
 * Zod schemas for request actions (Phase 6)
 * Used before calling requestConfirmCompletion, requestComplete, requestTransferToDepartment
 */

import { z } from 'zod';

const tenantIdSchema = z.string().min(1, 'tenantId مطلوب').max(128);
const requestIdSchema = z.string().min(1, 'requestId مطلوب').max(128);
const userIdSchema = z.string().min(1, 'userId مطلوب').max(128);
const userNameSchema = z.string().min(1, 'userName مطلوب').max(200);
const departmentSchema = z.string().min(1, 'department مطلوب').max(64);

export const confirmCompletionPayloadSchema = z.object({
  requestId: requestIdSchema,
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  userName: userNameSchema,
  department: departmentSchema,
});

export const completeRequestPayloadSchema = z.object({
  requestId: requestIdSchema,
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  userName: userNameSchema,
  rating: z.number().min(0).max(5).optional(),
  feedback: z.string().max(2000).optional(),
});

export const transferRequestPayloadSchema = z.object({
  requestId: requestIdSchema,
  tenantId: tenantIdSchema,
  targetDepartment: z.string().min(1, 'targetDepartment مطلوب').max(64),
  userId: userIdSchema,
  userName: userNameSchema,
  fromDepartment: z.string().max(64).optional(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'COMPLETED']).optional(),
  notes: z.string().max(1000).optional(),
});

export type ConfirmCompletionPayload = z.infer<typeof confirmCompletionPayloadSchema>;
export type CompleteRequestPayload = z.infer<typeof completeRequestPayloadSchema>;
export type TransferRequestPayload = z.infer<typeof transferRequestPayloadSchema>;
