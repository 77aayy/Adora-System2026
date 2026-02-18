# ADORA — System Investigation Report
## Autonomous Senior Engineer — Operational Correctness Audit

**Date:** 2025-02-15  
**Scope:** Full repository; production readiness as if going live tomorrow.  
**Method:** Infinite audit loop (Steps 1–9 + recursive re-run from Step 2).

---

## STEP 1 — SYSTEM MAP

### 1.1 Modules (high level)
| Layer | Modules |
|-------|--------|
| **Client UI** | App, AppRoutes, AuthContext, TenantContext, ThemeContext, GlobalServicesProvider |
| **Features** | LoginScreen, ReceptionDashboard, HousekeepingDashboard, BellmanDashboard, MaintenanceDashboard, GuestDashboard, AdminDashboard, KPIDashboard, SettingsManager, ScheduledTasksManager, ProcurementDashboard, CoffeeShopDashboard |
| **Services (core)** | requestService, stateTransitionService, workflowService, roomService, roomCardService, tenantSecurityService |
| **Services (support)** | offlineSyncService, offlineQueueService, firebaseOptimizationService, backupService, demoFactory, analyticsService, autoReportsService |
| **Cloud Functions** | loginHandler, userBinding, requestActions (requestConfirmCompletion, requestComplete, requestTransferToDepartment), roomOperations (processCheckIn, checkOutGuest, checkRoomAvailability), procurementActions, systemSettings, demoAutoDestruct |

### 1.2 Request flow (simplified)
```
Create: createRequest (client) → tenants/{tenantId}/requests (addDoc)
Confirm: confirmRequest (client) → stateTransitionService.moveRequest + updateDoc legacy
        OR requestConfirmCompletion (callable) → Admin update
Complete: completeRequest (client) → requestComplete (callable) → Admin update
Transfer: transferRequestToDepartment (client) → requestTransferToDepartment (callable) → Admin update
Bulk:    bulkConfirmRequests / bulkCompleteRequests (client) → moveRequest + updateDoc or batch
```

### 1.3 Database entities (Firestore)
- **Tenant-scoped (operational truth):**  
  `tenants/{tenantId}/requests`, `tenants/{tenantId}/rooms`, `tenants/{tenantId}/roomCards`, `tenants/{tenantId}/employees`, `tenants/{tenantId}/branches`, `tenants/{tenantId}/chatRooms`
- **Root / global:**  
  `userBindings`, `globalCodes`, `scheduled_tasks`, `system`, `systemSettings`, `audit_logs`, `health_reports`, etc.
- **Rules:**  
  Root `requests`, `rooms`, `roomCards` → `allow write: if false`.  
  `tenants/{tenantId}/{document=**}` → read/write if `getUserTenantId() == tenantId \|\| isOwner()`.

### 1.4 Background workers / async
- **ScheduledTaskRunner** (client): every 60s, queries `scheduled_tasks` (active, due), claims with transaction (status → processing), creates request in `tenants/{tenantId}/requests`, then marks task completed or nextRun.
- **OverdueAlertService**: monitors overdue requests (branch + tenantId).
- **PendingAlertService**: pending/urgent counts.
- **AutoTransferService**: auto-transfer logic (branch + tenantId).
- **Offline sync**: offlineSyncService.syncOfflineQueue (on online), roomCardService.syncOfflineCheckoutQueue (on online), firebaseOptimizationService.processBatch (batched writes).
- **Live timers, backup scheduler, license notification scheduler**: timers/intervals.

### 1.5 API endpoints (Callable)
- `loginWithPin`, `secureApiCall`, `resetUserRateLimit`
- `deployTenantFirebase`, `testTenantConnection`
- `setUserCustomClaims`, `getUserCustomClaims`, `revokeUserClaims`
- `checkExpiredDemoAccounts`, `checkDemoAccountExpiry`
- `loginWithPin` (auth)
- `createUserBinding`
- `getSystemSettings`, `setSystemSettings`
- `createManager`
- `checkRoomAvailability`, `processCheckIn`, `checkInGuest`, `checkOutGuest`
- `requestConfirmCompletion`, `requestComplete`, `requestTransferToDepartment`
- `procurementApprove`, `procurementClose`

### 1.6 Stateful objects (key)
- **Request:** status (NEW, IN_PROGRESS, COMPLETED, CANCELLED + legacy PENDING_RECEPTION, CONFIRMED, etc.), currentDepartment, departmentHistory, timeline.
- **Room:** status (available, occupied, cleaning, maintenance, blocked), currentGuestId.
- **RoomCard:** status (active, checked_out, expired), qrActive, checkIn/checkOut.
- **ScheduledTask:** status (active, processing, completed), nextRun.

### Answer: "What is the single source of operational truth?"
- **Requests:** No single source. Both client (stateTransitionService.moveRequest, requestService updateDoc/batch) and Cloud Functions (requestConfirmCompletion, requestComplete, requestTransferToDepartment) write to `tenants/{tenantId}/requests`. State machine is enforced partly in callables (e.g. requestComplete allows only IN_PROGRESS/CONFIRMED → COMPLETED) and partly in client (moveRequest, bulk fallbacks).
- **Rooms:** Client-only (roomService.updateRoomStatus, transferGuest). No callable for room status; roomOperations do check-in/out with Admin SDK.
- **RoomCards:** Client (roomCardService) + callables not used for status in the same way; check-in/out can go through roomOperations.

**DESIGN RISK:** Multiple writers for request status (client + callables) and no single gateway for room status (getDoc + updateDoc, non-atomic). Operational truth is split between client and server.

---

## STEP 2 — FOLLOW EVERY STATE

### Requests
| State (conceptual) | Who changes | When | Validation / prevention |
|-------------------|-------------|------|--------------------------|
| NEW / PENDING_RECEPTION | createRequest, moveRequest, requestTransferToDepartment (callable), bulkConfirm fallback | Create, confirm, transfer in | None on client moveRequest (any → NEW allowed) |
| IN_PROGRESS / CONFIRMED | moveRequest, startRequest, requestComplete (callable) | Start work, complete path | requestComplete allows only IN_PROGRESS/CONFIRMED → COMPLETED |
| COMPLETED | requestComplete, requestConfirmCompletion (callable), moveRequest, bulkComplete fallback | Completion, confirm at reception | requestConfirmCompletion previously did not reject CANCELLED → FIXED |
| CANCELLED | cancelRequest, cancelAllActiveRequestsByBranch | Cancel / branch disable | cancelAllActiveRequestsByBranch uses legacy status list (PENDING_RECEPTION, CONFIRMED, …) |

- **Missing validation:** requestConfirmCompletion now rejects CANCELLED (fix applied). moveRequest (client) does not validate “allowed from-status” for COMPLETED (e.g. could move CANCELLED to COMPLETED from client if UI called moveRequest with COMPLETED).
- **Direct DB writes:** requestService (tenant path), stateTransitionService (tenant path), bulk confirm/complete (tenant path). All allowed by rules.
- **Multiple owners:** Client and callables both write request status → HIGH RISK if client and server disagree (e.g. cancel on one, complete on the other).

### Rooms
| State | Who changes | When | Validation |
|-------|-------------|------|------------|
| available, occupied, cleaning, maintenance, blocked | updateRoomStatus (client), transferGuest (transaction) | Manual status change, transfer | **None.** getDoc + updateDoc (non-atomic). No allowed-transition matrix. |

- **Race:** Two tabs: both read status "occupied"; both write (e.g. "cleaning" and "available") → last write wins, inconsistent state.
- **Bypassed logic:** Any component with tenant access can call updateRoomStatus with any value.

### RoomCards
- roomCardService (checkIn, checkOut, recordGuestCheckout, DND, etc.) under tenant path. Offline queue (checkout_inspection) replayed on online via syncOfflineCheckoutQueue.

### Assignments / Users
- Employees under tenants. userBindings at root: client can create/update own (rules allow). IDOR risk if binding can point to another tenant (app should validate).

---

## STEP 3 — CLOSED LOOP VERIFICATION

| Action | Create | Assign | Acknowledge | Execute | Confirm | Close |
|--------|--------|--------|-------------|---------|---------|-------|
| Request (guest → reception → dept) | ✅ addDoc | ✅ currentDepartment / moveRequest | viewedBy / deliveredAt | startRequest / IN_PROGRESS | confirmCompletion / requestComplete | COMPLETED |
| Inspection (checkout) | ✅ addDoc tenant requests | currentDepartment housekeeping | — | — | confirmCompletion | COMPLETED |

- **Actions without confirmation:** Request can be marked COMPLETED via client moveRequest without going through callable (no server-side “confirm” step).
- **Confirmations without action:** requestConfirmCompletion (callable) sets COMPLETED; if UI calls it by mistake for a request that was never executed, it still closes (idempotency only for already COMPLETED/CANCELLED now).
- **Closure without execution:** Client bulkComplete fallback only sets COMPLETED for IN_PROGRESS/CONFIRMED (fixed). But client moveRequest(..., 'COMPLETED', ...) can close without going through callable.
- **Execution without ownership:** moveRequest does not check “current department” or “assigned to”; any authenticated user with tenantId can transition.

**Open loop:** Client can close requests via state machine (moveRequest) without server confirmation → operational reality (reception never saw it) can differ from DB (COMPLETED).

---

## STEP 4 — LOGICAL CONTRADICTIONS

- **Room: clean AND dirty**  
  Possible if two updates race: one sets cleaning → ready (available), another sets occupied. No invariant enforced.

- **Room: occupied AND available**  
  Same race: updateRoomStatus(available) and updateRoomStatus(occupied) from different sources → last write wins.

- **Request: closed AND unexecuted**  
  Possible if UI calls requestConfirmCompletion or moveRequest(..., 'COMPLETED', ...) before any department actually did the work (no server check that work was done).

- **Request: executed AND unassigned**  
  currentDepartment/assignedTo can be out of sync if updates are partial or order is wrong.

- **Request: CANCELLED then COMPLETED**  
  Previously: requestConfirmCompletion did not check CANCELLED → could overwrite. **Fixed:** callable now throws failed-precondition if currentStatus === 'CANCELLED'.

Chain that allowed CANCELLED → COMPLETED: Reception cancels request → Housekeeping still has old “Complete” button → confirmCompletion callable ran → update({ status: 'COMPLETED' }). Now blocked by guard.

---

## STEP 5 — TIME & CONCURRENCY

- **Two receptionists, same room:**  
  Both read room (e.g. available), both assign to different guests (check-in). roomOperations.processCheckIn uses transaction; if client does updateRoomStatus only, no transaction → last write wins.

- **Housekeeping finishes, manager overrides:**  
  Housekeeping sets room “available”; manager sets “blocked”. No conflict resolution; last write wins.

- **Duplicate mobile submission:**  
  createRequest is not idempotent (no idempotency key). Double tap → two requests.

- **Network reconnect, stale data:**  
  Offline queue replays (offlineSyncService, roomCardService.syncOfflineCheckoutQueue). If a “complete” was queued and request was later cancelled, replay could still apply (offlineSyncService does not know request status). requestComplete callable rejects non–IN_PROGRESS/CONFIRMED, so if replay calls callable, server rejects; if replay were a direct client update, it could overwrite CANCELLED.

- **Room status:** getDoc(roomRef) then updateDoc(roomRef, { status }) — classic TOCTOU. Sequence: Tab A read occupied, Tab B read occupied; A write cleaning, B write available → one overwrites the other.

---

## STEP 6 — ASYNC & RETRIES

- **ScheduledTaskRunner:** Claim (status → processing) in transaction → create request → update task. If job runs twice (e.g. two tabs), second run sees status !== 'active' and skips → no duplicate request. If job runs late: creates request when due; no “skip if already past” for one-time tasks beyond nextRun. If job runs after “closure”: task doc can be deleted or status changed by admin; runner only processes status == 'active'.

- **firebaseOptimizationService:** On batch commit failure, re-queues only writes with retries ≤ MAX_WRITE_RETRIES; permission-denied/failed-precondition not re-queued. Reduces double-apply.

- **offlineSyncService:** executeOperation uses doc(db, collectionName, docId). collectionName is single segment unless caller passes full path (e.g. "tenants/xyz/requests"). So queued request/room updates stored as collection "requests" or "rooms" write to root; tenant path not supported unless caller explicitly uses full path. Replay after success: operation removed. If job runs after “closure” (e.g. request cancelled): queue may still have “update status COMPLETED”; on replay, update goes to root or wrong path → may fail (rules) or wrong collection.

- **roomCardService.syncOfflineCheckoutQueue:** Replays checkout_inspection by creating doc in tenants/{tenantId}/requests. Does not check if request already created (e.g. by another tab or retry). Possible duplicate inspection request if replay runs twice or queue not cleared.

---

## STEP 7 — DATABASE RELIABILITY

- **Transactional safety:** transferGuest uses runTransaction for room updates. updateRoomStatus does not (getDoc + updateDoc). requestComplete/requestConfirmCompletion use getDoc + update (no transaction).
- **Atomic updates:** Single-doc updates are atomic; multi-doc (e.g. bulk confirm) uses batch; some flows mix moveRequest (updateDoc) and batch in same loop — now only one batch.commit when hasLegacyUpdates.
- **Partial failures:** bulkConfirmRequests: if moveRequest fails for some and legacy batch.update is used, batch.commit runs once; if commit fails, no retry (exception thrown).
- **Orphan records:** Scheduled task “processing” with no request created (e.g. addDoc fails after claim) → task stuck in processing. No cleanup job.
- **Missing constraints:** No DB-level constraint that request.status is one of allowed values; no constraint that room.status is one of allowed values.
- **Idempotency:** requestComplete and requestConfirmCompletion are idempotent for already COMPLETED. createRequest is not idempotent.
- **Duplicate tasks:** ScheduledTaskRunner claim prevents duplicate request creation for same due run. Duplicate “manual” requests possible (no idempotency key).

---

## STEP 8 — FAILURE SIMULATION

- **Server restart mid-operation:** Client callable in flight → client may retry → callable idempotent for completion, so safe. Client updateDoc in flight → may succeed or fail; no server-side recovery.
- **Power loss:** Uncommitted client writes lost. Offline queue may replay later; risk of stale ops (e.g. complete a request that was cancelled after queue was written).
- **API timeout:** Callable may have completed on server but client sees timeout → client may retry → idempotent for complete/confirm. If client thinks it failed and also does local updateDoc, two writers.
- **Background worker crash:** ScheduledTaskRunner: task left in “processing” if addDoc or updateDoc fails after claim. Next run does not pick it (status !== 'active'). Orphan processing state.
- **Database latency:** getDoc slow → updateDoc uses stale data; another client may have changed status → overwrite.

---

## STEP 9 — SECURITY & MISUSE

- **Repeated clicks:** completeRequest/confirmCompletion call callable; idempotent. createRequest → multiple requests. Buttons should be disabled after first click (UI responsibility).
- **Manual API calls:** Callables validate auth and tenantId; requestComplete validates status. Malicious client could call with other requestIds in same tenant.
- **Invalid payloads:** Schemas (confirmCompletionPayloadSchema, etc.) validate before callable; callable re-validates required fields.
- **userBindings:** Client can create/update own binding (rules). If app does not enforce “can only set tenantId/role for self”, user could try to set another tenant (rules only allow request.auth.uid == uid for update, so only own doc — but create could set any tenantId). Application must ensure binding matches login flow.
- **Privilege abuse:** Tenant isolation by getUserTenantId() in rules. User in tenant A cannot write to tenant B’s data. Owner (custom claims) can read all.

---

## RECOMMENDED FIXES (from this audit)

### Critical (done in this pass)
1. **requestConfirmCompletion:** Reject when currentStatus === 'CANCELLED' (prevent CANCELLED → COMPLETED). — **DONE**
2. **bulkConfirmRequests:** Remove double batch.commit(); track hasLegacyUpdates and commit once. — **DONE**

### High (recommended next)
3. **requestConfirmCompletion:** Also reject if currentStatus is not in a set that makes sense (e.g. only allow IN_PROGRESS, CONFIRMED, IN PROGRESS, NEW for “confirm completion”).
4. **roomService.updateRoomStatus:** Use runTransaction(read room, validate allowed transition, write). Add allowed-transition matrix (e.g. occupied → cleaning → available; any → blocked by reception). — **DONE**
5. **roomService.transferGuest:** Request query uses `where('branchId', '==', branchId)`. Request documents use field `branch`, not `branchId`. Change to `where('branch', '==', branchId)` so requests are found and migrated. — **DONE**
6. **ScheduledTaskRunner:** If addDoc or update fails after claim, set task status back to 'active' or 'failed' so it can be retried or cleaned up; avoid permanent “processing”.
7. **offlineSyncService:** Support full path or tenantId+collection+docId in queued ops so tenant-scoped request/room updates replay to correct path. — **DONE** (tenantId on queueOperation/smartSave; executeOperation uses tenants/{tenantId}/{collection})

### Medium
8. **stateTransitionService.moveRequest:** Server-side validation: when newStatus === 'COMPLETED', require currentStatus in [IN_PROGRESS, CONFIRMED] (e.g. via callable only, or add client-side guard that blocks COMPLETED from CANCELLED/NEW). — **DONE** (client guard added)
9. **Request status enum vs usage:** Align RequestStatus enum with actual values (PENDING_RECEPTION, CONFIRMED, PENDING_HOUSEKEEPING) or map them in one place to avoid scattered string checks. — **DONE** (enum extended in src/types/request.ts)
10. **syncOfflineCheckoutQueue:** Idempotency: before addDoc, check if an inspection request for this cardId/roomNumber already exists (e.g. by inspectionRequestId on room card) to avoid duplicate on double replay. — **DONE**

### Low
11. **userBindings:** Prefer creating/updating only via Cloud Function after login. — **DONE** (saveUserBinding tries createUserBinding callable first, then client setDoc fallback; rules still allow client write for fallback).
12. **Audit logging:** Ensure room status change and request completion are always logged (including from callables). — **DONE** (requestConfirmCompletion + requestComplete write to audit_logs from Functions).

---

## RECURSIVE LOOP (Second pass from Step 2)

### Additional finding (Step 2 — Room transferGuest query)
- **Location:** `src/services/roomService.ts` — transferGuest, query on requests.
- **Issue:** `where('branchId', '==', branchId)` but request schema uses `branch`. So active requests for the room are never found; migration and follow-up requests may be wrong or missing.
- **Risk:** High (wrong data after transfer).
- **Fix:** Use `where('branch', '==', branchId)` (and ensure request type filter and status list match schema).

---

## Summary

- **Single source of truth:** Not fully centralized; request status has dual writers (client + callables); room status is client-only and non-atomic.
- **Critical fixes applied:** (1) requestConfirmCompletion rejects CANCELLED. (2) bulkConfirmRequests single commit with hasLegacyUpdates.
- **Remaining critical/high:** Room status race (transaction + transition matrix), transferGuest request query field name, scheduled task orphan “processing”, offline replay path/idempotency.

No further failure scenario was invented in the second loop beyond the transferGuest query bug above. Audit can be extended by adding transaction to room status and full-path support for offline queue.
