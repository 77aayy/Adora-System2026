# ADORA — Full System Audit + UI Verification
## Autonomous Senior Engineer + Real Hotel Employee Simulation

**Date:** 2025-02-15  
**Scope:** Operational correctness + UI/workflow verification as if going live tomorrow.

---

# PART A — SYSTEM INVESTIGATION (Steps 1–9)

## STEP 1 — SYSTEM MAP

### 1.1 Modules
| Layer | Modules |
|-------|--------|
| **Client UI** | App, AppRoutes, AuthContext, TenantContext, ThemeContext, GlobalServicesProvider, ReceptionProvider |
| **Features** | LoginScreen, ReceptionDashboard, HousekeepingDashboard, BellmanDashboard, MaintenanceDashboard, GuestDashboard, AdminDashboard, KPIDashboard, SettingsManager, ScheduledTasksManager, ProcurementDashboard, CoffeeShopDashboard, DemoEntry, SetupWizard, FirebaseSetupWizard |
| **Services (core)** | requestService, stateTransitionService, workflowService, roomService, roomCardService, tenantSecurityService |
| **Services (support)** | offlineSyncService, offlineQueueService, firebaseOptimizationService, backupService, demoFactory, analyticsService, autoReportsService, roomTransferService |
| **Cloud Functions** | loginWithPin, createUserBinding, requestConfirmCompletion, requestComplete, requestTransferToDepartment, processCheckIn, checkOutGuest, checkRoomAvailability, procurementApprove, procurementClose, systemSettings, demoAutoDestruct |

### 1.2 Request flow
- **Create:** createRequest (client) → `tenants/{tenantId}/requests` (addDoc).
- **Confirm:** confirmRequest (client) → stateTransitionService.moveRequest + updateDoc legacy; or requestConfirmCompletion (callable) → Admin update.
- **Complete:** completeRequest (client) → requestComplete (callable) → Admin update (idempotent; rejects non–IN_PROGRESS/CONFIRMED).
- **Transfer:** transferRequestToDepartment (client) → requestTransferToDepartment (callable) → Admin update.
- **Bulk:** bulkConfirmRequests / bulkCompleteRequests (client) → moveRequest + batch (single commit when hasLegacyUpdates).

### 1.3 Database entities
- **Tenant-scoped:** `tenants/{tenantId}/requests`, `tenants/{tenantId}/rooms`, `tenants/{tenantId}/roomCards`, `tenants/{tenantId}/employees`, `tenants/{tenantId}/branches`, `tenants/{tenantId}/chatRooms`.
- **Root:** `userBindings`, `globalCodes`, `scheduled_tasks`, `system`, `systemSettings`, `audit_logs`, `health_reports`.
- **Rules:** Root `requests`, `rooms`, `roomCards` → write false. `tenants/{tenantId}/{document=**}` → read/write if getUserTenantId() == tenantId \|\| isOwner().

### 1.4 Background workers
- **ScheduledTaskRunner:** every 60s; claim (transaction status → processing), create request in `tenants/{tenantId}/requests`, then complete/nextRun; on failure reverts task to active.
- **OverdueAlertService, PendingAlertService, AutoTransferService:** branch + tenantId.
- **Offline:** offlineSyncService.syncOfflineQueue, roomCardService.syncOfflineCheckoutQueue (idempotent by roomCardId), firebaseOptimizationService.processBatch (retry cap, no blind re-queue).

### 1.5 API endpoints (Callable)
- Auth: loginWithPin, createUserBinding.
- Requests: requestConfirmCompletion, requestComplete, requestTransferToDepartment.
- Rooms: checkRoomAvailability, processCheckIn, checkInGuest, checkOutGuest.
- Procurement: procurementApprove, procurementClose.
- System: getSystemSettings, setSystemSettings, createManager, etc.

### 1.6 Stateful objects
- **Request:** status (NEW, IN_PROGRESS, COMPLETED, CANCELLED + legacy), currentDepartment, departmentHistory, timeline.
- **Room:** status (available, occupied, cleaning, maintenance, blocked, ready, dirty), currentGuestId. **Validation:** ALLOWED_ROOM_TRANSITIONS + runTransaction in updateRoomStatus.
- **RoomCard:** status (active, checked_out, expired), qrActive.
- **ScheduledTask:** status (active, processing, completed), nextRun.

### Single source of operational truth
- **Requests:** Dual writers (client moveRequest/updateDoc + callables). Callables enforce idempotency and allowed-from status (e.g. COMPLETED only from IN_PROGRESS/CONFIRMED; requestConfirmCompletion rejects CANCELLED and invalid statuses). stateTransitionService blocks COMPLETED from CANCELLED/NEW on client. **Risk:** Client could still call moveRequest(COMPLETED) for CONFIRMED without going through callable — acceptable if UI only uses completeRequest/confirmCompletion.
- **Rooms:** Client-only. updateRoomStatus uses **runTransaction + ALLOWED_ROOM_TRANSITIONS** (no invalid transitions). transferGuest uses runTransaction for room updates. **Mitigated:** Race reduced by transaction; transition matrix prevents e.g. available → occupied without going through allowed path.
- **RoomCards:** Client (roomCardService) + roomOperations (check-in/out) via callables where used.

**DESIGN RISK (remaining):** Request status has two writers; room status is single-writer with validation. Operational truth is split but guarded by server-side checks for completion/confirm.

---

## STEP 2 — FOLLOW EVERY STATE (current)

### Requests
| State | Who changes | Validation |
|-------|-------------|------------|
| NEW / PENDING_* | createRequest, moveRequest, requestTransferToDepartment, bulkConfirm fallback | moveRequest allows any → NEW |
| IN_PROGRESS / CONFIRMED | moveRequest, startRequest, requestComplete (callable) | requestComplete: only IN_PROGRESS/CONFIRMED → COMPLETED |
| COMPLETED | requestComplete, requestConfirmCompletion (callable), moveRequest, bulkComplete fallback | requestConfirmCompletion: rejects CANCELLED + only allowed statuses; requestComplete: idempotent; moveRequest: blocks COMPLETED from CANCELLED/NEW |
| CANCELLED | cancelRequest, cancelAllActiveRequestsByBranch | — |

### Rooms
| State | Who changes | Validation |
|-------|-------------|------------|
| available, occupied, cleaning, ready, dirty, maintenance, blocked | updateRoomStatus (client), transferGuest (transaction) | **ALLOWED_ROOM_TRANSITIONS** + **runTransaction** in updateRoomStatus. transferGuest: transaction for both room docs. |

### Maintenance tickets / Cleaning tasks
- Represented as **requests** (type cleaning/maintenance). Same state machine; department handoff via currentDepartment and requestTransferToDepartment.

### Assignments
- currentDepartment, assignedTo, departmentHistory. Updated by moveRequest and callables. No separate assignment entity; ownership implied by currentDepartment.

---

## STEP 3 — CLOSED LOOP VERIFICATION

| Action | Create | Assign | Acknowledge | Execute | Confirm | Close |
|--------|--------|--------|-------------|---------|---------|-------|
| Request (guest → reception → dept) | ✅ addDoc | ✅ currentDepartment / moveRequest | viewedBy / deliveredAt | startRequest / IN_PROGRESS | confirmCompletion / requestComplete (callable) | COMPLETED |
| Inspection (checkout) | ✅ addDoc tenant requests | housekeeping | — | — | confirmCompletion (callable) | COMPLETED |

- **Actions without confirmation:** moveRequest(..., COMPLETED, ...) can close from client if UI called it; UI is expected to use completeRequest/confirmCompletion (callable).
- **Confirmations without action:** requestConfirmCompletion only allows certain statuses; CANCELLED rejected.
- **Closure without execution:** requestComplete rejects non–IN_PROGRESS/CONFIRMED; moveRequest blocks COMPLETED from NEW.
- **Execution without ownership:** moveRequest does not check “current department”; any authenticated tenant user can transition. **Medium risk** (rely on UI role).

---

## STEP 4 — LOGICAL CONTRADICTIONS

- **Room clean AND dirty:** Prevented by ALLOWED_ROOM_TRANSITIONS (single status per doc).
- **Room occupied AND available:** Prevented by transaction + single status field.
- **Request closed AND unexecuted:** Mitigated by requestComplete allowing only IN_PROGRESS/CONFIRMED → COMPLETED; client moveRequest blocks COMPLETED from NEW.
- **Request CANCELLED then COMPLETED:** Prevented by requestConfirmCompletion (rejects CANCELLED) and moveRequest (throws for rawStatus === 'CANCELLED' when newStatus === 'COMPLETED').

No new chain found that reaches an impossible state after applied fixes.

---

## STEP 5 — TIME & CONCURRENCY

- **Two receptionists, same room:** Room update uses transaction; last writer wins but transition must be allowed. Two check-ins: processCheckIn (callable) uses transaction — safe.
- **Housekeeping finishes, manager overrides:** Both call updateRoomStatus; transaction serializes; allowed matrix may reject override if invalid (e.g. cleaning → blocked allowed).
- **Duplicate mobile submission:** createRequest has no idempotency key; double tap can create two requests. **Medium** — UI should disable button after first click.
- **Network reconnect, stale data:** Offline queue replays; requestComplete/requestConfirmCompletion reject bad status; syncOfflineCheckoutQueue idempotent by roomCardId.
- **Room status:** updateRoomStatus uses runTransaction → no TOCTOU.

---

## STEP 6 — ASYNC & RETRIES

- **ScheduledTaskRunner:** Claim in transaction; on addDoc/update failure reverts task to active. No duplicate request from same run; no permanent “processing.”
- **firebaseOptimizationService:** Retry cap; permission-denied not re-queued; no blind re-queue of full batch.
- **syncOfflineCheckoutQueue:** Idempotency check (existing inspection by roomCardId) before addDoc.
- **requestComplete / requestConfirmCompletion:** Idempotent for already COMPLETED.

---

## STEP 7 — DATABASE RELIABILITY

- **Transactional safety:** updateRoomStatus, transferGuest use runTransaction; request updates are single-doc or batch (one commit when hasLegacyUpdates).
- **Partial failures:** bulkConfirm: if commit fails, exception thrown (no retry in code).
- **Orphan records:** Scheduled task reverted to active on failure. Stale “processing” avoided.
- **Idempotency:** createRequest not idempotent; completion/confirm callables idempotent.

---

## STEP 8 — FAILURE SIMULATION

- **Server restart mid-operation:** Callable in flight may complete or fail; client retry idempotent for complete/confirm.
- **Power loss:** Uncommitted client writes lost; offline queue may replay (callables reject bad status).
- **Background worker crash:** ScheduledTaskRunner reverts task to active on failure.
- **Database latency:** Transaction in updateRoomStatus reduces stale overwrite window.

---

## STEP 9 — SECURITY & MISUSE

- **Repeated clicks:** completeRequest/confirmCompletion idempotent; createRequest can duplicate (UI should disable).
- **Invalid payloads:** Schemas + callable validation.
- **userBindings:** saveUserBinding tries createUserBinding callable first, then client setDoc fallback; callable validates uid === context.auth.uid.

---

# PART B — UI & WORKFLOW VERIFICATION (Code-Based Trace)

## Routes (all reachable)

| Path | Role | Purpose |
|------|------|---------|
| /login | Public | Login |
| /setup, /firebase-setup | Public/Guard | Setup wizards |
| /onboarding/* | Manager | First branch, room types |
| /super-admin, /owner-dashboard, /owner-panel, /owner/* | Owner | Owner flows |
| /demo, /demo-access, /about | Public | Demo, about |
| /guest | Public | Guest portal |
| /reception | Reception, Admin | Reception dashboard |
| /housekeeping | Housekeeping, Admin | Housekeeping dashboard |
| /bellman | Bellman, Admin | Bellman dashboard |
| /maintenance | Maintenance, Admin | Maintenance dashboard |
| /procurement | Procurement, Reception, Admin | Procurement dashboard |
| /coffeeshop | Coffee_shop, Reception, Admin | Coffee shop dashboard |
| /admin/* | Admin | Admin sub-routes (kpi, points, rooms, employees, tasks, settings, etc.) |
| /rewards | Admin | Rewards dashboard |
| / | Root redirect | Redirects to department path or /login |

**Navigation:** RootRedirect sends authenticated user to getDepartmentPath(department, role). Fallback route path="*" → RootRedirect. Every staff route is under ProtectedRoute; logout and header links provide way back. **No user stuck** if auth and department path are correct.

## Reception (Receptionist)

- **Create request:** QuickCreateModal onSubmit → handleCreateRequest → handleCreateRequestFromHook (useReceptionLogic) → createRequest (requestService) → addDoc tenants/.../requests. **Closed loop:** Request created in DB.
- **Confirm request:** RequestList/CompactRequestCard onQuickAction('confirm') → onRequestConfirm → handleConfirmRequest (useReceptionActions) → confirmRequest (requestService) + stateTransitionService.moveRequest. **Closed loop:** Status and department updated.
- **Complete request:** handleCompleteRequest → completeRequest (requestService) → requestComplete (callable). **Closed loop:** COMPLETED in DB; idempotent.
- **Confirm completion:** handleConfirmCompletion → confirmCompletion (requestService) → requestConfirmCompletion (callable). **Closed loop:** COMPLETED; rejects CANCELLED.
- **Transfer to department:** RoomTransferModal onConfirm → confirmTransfer → handleTransferToDepartment → requestTransferToDepartment (callable). **Closed loop:** currentDepartment and history updated.
- **Room status:** Reception can change room status via UI that calls updateRoomStatus (transaction + allowed transitions).
- **Buttons:** History, Shift notes, Procurement, Lost & Found, General instructions, WhatsApp, Support ticket, Logout — all open modals or navigate; no orphan.
- **Feedback:** onSuccess/onError from useReceptionActions trigger success/error (toast + haptic + sound). **Visible feedback.**

## Housekeeping

- **Start task:** Task card onStart → startRequest (requestService) or moveRequest → IN_PROGRESS. **Closed loop.**
- **Complete (occupied room):** onComplete → completeRequest (requestService) → requestComplete (callable). **Closed loop; no ghost completion.**
- **Complete (NEEDS_INSPECTION / post_inspection):** Direct updateDoc to NEEDS_INSPECTION or inspection modal; then updateRoomStatus(..., 'ready' | 'maintenance'). **Closed loop** (inspection result drives room status).
- **Room status:** updateRoomStatus(tenantId, branchId, roomNumber, 'ready' | 'maintenance') after inspection. **Validation:** transaction + allowed transitions.
- **Buttons:** History, Shift notes, Procurement, Laundry, General instructions — modals/navigation. **No orphan.**

## Maintenance

- **Complete request:** Uses requestService (completeRequest / callable). Room status set to 'cleaning' after complete via updateRoomStatus. **Closed loop.**

## Bellman

- **Complete request:** completeRequest (requestService) → callable. **Closed loop.**

## Manager / Admin

- **AdminDashboard:** Sub-routes (kpi, points, rooms, employees, tasks, settings, etc.). Each sub-page (RoomsManager, EmployeesManager, ScheduledTasksManager, SettingsManager, etc.) has its own actions; generally wired to services (roomService, employeeService, systemSettings, etc.). **No generic orphan**; individual screens would need per-button trace for 100% assurance.
- **Owner:** OwnerPanel, EnhancedOwnerDashboard, BillingDashboard, AnalyticsDashboard, SuperAdminMasterAccess — owner-only; data from tenant/owner services.

## Guest

- **GuestDashboard:** Guest requests; room card validation via roomCardService (tenant path). DND, requests, chat — wired to guestPortalService, requestService, smartChatService. **Flow:** Guest creates request → appears in reception; handoff is cross-department (request in tenants/.../requests with currentDepartment).

## Cross-department flow

- **Reception creates request → Housekeeping sees it:** Requests subscribed by branch/tenant; currentDepartment or status drives which tab (new / in_progress / completed). **Visible.**
- **Housekeeping completes → Reception sees result:** completeRequest (callable) sets COMPLETED and isActionRequiredByReception; reception list refreshes via real-time subscription. **Visible.**
- **Transfer to department:** requestTransferToDepartment (callable) updates currentDepartment; target department’s view filters by currentDepartment or status. **Handoff closed.**

## Orphan action detection (code trace)

- **Reception:** handleCreateRequest, confirmTransfer, handleConfirmRequest, handleCompleteRequest, handleConfirmCompletion, handleTransferToDepartment — all call requestService or callables. **No orphan.**
- **Housekeeping:** onStart, onComplete → startRequest/completeRequest or updateDoc for inspection flow; updateRoomStatus for room. **No orphan.**
- **RequestList/CompactRequestCard:** onQuickAction('confirm'), onView — passed from parent; parent wires to useReceptionActions. **No orphan.**
- **UniversalActionCard:** uses moveRequest (stateTransitionService); moveRequest writes to Firestore. **No orphan.**

## Missing feedback / visibility

- **Success/error:** useReceptionActions and Housekeeping use onSuccess/onError (toast). If a callable fails, error callback runs. **Feedback present.**
- **Real-time updates:** Requests and rooms use onSnapshot or similar; list updates without manual refresh. **State visibility.**

---

# PART C — RECURSIVE LOOP (Second pass from Step 2)

## Re-check state ownership

- **Request:** Still dual writer; callables enforce completion/confirm rules; client moveRequest blocks COMPLETED from CANCELLED/NEW. **No new issue.**
- **Room:** updateRoomStatus and transferGuest both use transaction; room status transitions validated. **No new issue.**

## New failure scenario search

- **Scenario:** Reception transfers request to housekeeping; housekeeping never opens app; request stays in NEW for that department. **Not a bug** — operational (staff must open app to see work).
- **Scenario:** Two tabs reception; both confirm same request. **Idempotent** for confirm (moveRequest or callable); no duplicate COMPLETED.
- **Scenario:** Offline queue has “complete” for request Id X; request X was cancelled after queue was written. **Replay:** requestComplete callable rejects non–IN_PROGRESS/CONFIRMED; so no overwrite of CANCELLED. **Safe.**

No new critical failure scenario identified in second loop.

---

# PART D — OUTPUT SUMMARY (Issues & Status)

## Critical — None remaining

(Previously: requestConfirmCompletion overwriting CANCELLED, bulkConfirm double commit, room status race — all fixed.)

## High — None remaining

(Previously: transferGuest wrong field branchId vs branch, scheduled task orphan processing, offline replay path — all fixed.)

## Medium

| Issue | Location | Trigger | Why | Hotel consequence | Minimal fix | Long-term |
|-------|----------|--------|-----|-------------------|-------------|-----------|
| createRequest not idempotent | requestService.createRequest | Double tap / duplicate submit | No idempotency key | Duplicate requests for same intent | Disable submit button after first click (UI) | Idempotency key (e.g. client-generated) and server dedup |
| moveRequest does not check “current department” | stateTransitionService.moveRequest | Any tenant user calls moveRequest with target dept | No server check that user belongs to current or target dept | Wrong department could transition | Rely on UI role; document | Callable for all transitions with server-side role check |

## Low

| Issue | Location | Trigger | Why | Hotel consequence | Minimal fix | Long-term |
|-------|----------|--------|-----|-------------------|-------------|-----------|
| bulkConfirm/bulkComplete: no retry on batch commit failure | requestService | Batch.commit() fails | No retry loop | Some requests not confirmed/completed | Log and show “partial failure” to user | Retry with backoff or per-request commit |

---

# PART E — UI VERIFICATION OUTPUT FORMAT (Summary)

- **Type:** None (no orphan button, broken workflow, or navigation dead end found in code trace).
- **Page/section:** Reception, Housekeeping, Maintenance, Bellman, Admin, Guest — traced.
- **User role:** Receptionist, Housekeeping, Maintenance, Procurement, Manager.
- **Exact steps:** Create request → Confirm → Assign to department → Complete → Confirm completion; Start task → Complete task; Update room status after inspection.
- **Observed behavior (code):** All actions call requestService or roomService or callables; real-time subscriptions update lists.
- **Expected behavior:** Request and room state persist and are visible to other roles. **Met.**
- **Operational impact:** System supports create → assign → execute → confirm → close; cross-department handoff visible; no orphan actions detected in traced code.

---

**Recursive exploration:** Second pass from Step 2 did not yield new failure scenarios. Room validation (transaction + matrix) and request guards (callable + moveRequest) are in place. UI flows traced to backend; no orphan buttons in Reception/Housekeeping/Maintenance/Bellman flows.

**Live browser check:** App runs (Vite); navigating to `/` redirects per auth (e.g. to `/owner-dashboard` or `/login`). Navigating to `/login` when Firebase is not configured redirects to `/firebase-setup` (FirebaseSetupGuard). Navigation and guards behave as designed. Full E2E (every button on every screen as each role) recommended for production go-live.

**Button trace (final):** Bellman — `handleCompleteRequest` → `completeRequest` (requestService). Maintenance — `confirmComplete` → `transferRequestToDepartment`, `updateDoc` (tenant path), `updateRoomStatus`. Procurement — `handleApprove` → `approveProcurement`; `handleCompletePurchase` → `completePurchase` + `deliverItems` (callables). Guest — `submitRequest` / `createRequestFromQRService` → requestService. Admin SettingsManager — `handleSave` → `saveLocationSettings` / `setDoc` (tenant branch settings). No orphan actions found; all wired to services/callables.

**Repository fix (tenantId):** `IRequestRepository.bulkConfirmRequests` and `bulkCompleteRequests` were missing `tenantId`; the Firebase implementation was calling the service with wrong argument order (userId as tenantId). Fixed: interface and `FirebaseRequestRepository` now accept and pass `tenantId` as second parameter so the service receives `(requestIds, tenantId, userId, userName)`.
