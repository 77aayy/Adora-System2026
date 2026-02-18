# FULL OPERATIONAL DAY SIMULATION — REALITY STRESS MODE
## ADORA System: Can it survive a real hotel day?

**Date:** 2025-02-15  
**Mode:** Reality stress (delays, out-of-order, human error, offline, shift change, double actions, manager override).  
**Goal:** Determine if the system remains logically correct and can answer end-of-day reconciliation.

---

# DAY 1 — TIMELINE (Hour-by-Hour)

## GLOBAL ASSUMPTIONS
- Staff are busy → actions delayed, sometimes forgotten.
- Actions happen out of order (e.g. complete before start acknowledged).
- Humans forget steps (e.g. don’t confirm completion).
- Wrong buttons pressed (e.g. wrong room, wrong ticket).
- Shift changes during active tasks.
- Internet disconnects; mobile devices reconnect later.

---

## 06:00–09:00 — MORNING (Checkout Rush)

| Time | Event | Actor | Action | Code path |
|------|--------|--------|--------|-----------|
| 06:15 | Guest 101 checks out at desk | Reception | processCheckOut / checkOutGuest (callable or client) | roomCardService, roomService |
| 06:16 | Room 101 not set to cleaning | Reception | Forgot to update room status | — |
| 06:20 | Housekeeping opens app, sees 101 still "occupied" | HK | Assumes guest still there, skips 101 | subscribeToRequests(branch), room list from subscribeToRooms |
| 06:25 | Second receptionist sets 101 → cleaning | Reception | updateRoomStatus(tenantId, branchId, '101', 'cleaning') | roomService.updateRoomStatus → runTransaction + ALLOWED_ROOM_TRANSITIONS |
| 06:30 | HK staff A starts cleaning 101 | HK | startRequest → moveRequest(IN_PROGRESS, housekeeping), assignedTo A | requestService.startRequest, stateTransitionService.moveRequest |
| 06:35 | Guest 102 checkout requested; receptionist taps "complete" twice (double tap) | Reception | Two completeRequest() calls | completeRequest → requestComplete (callable). Callable: idempotent (COMPLETED → return success). **OK.** |
| 06:40 | Request for 103 cleaning created twice (nervous tap) | Reception | Two createRequest() within 1s | QuickCreateModal: isSubmitting disables button. If two submissions: two docs in tenants/{tenantId}/requests. **Possible duplicate request.** |
| 06:45 | Room 102 set to "ready" before HK marked inspection done | Reception | updateRoomStatus(102, 'ready') | ALLOWED_ROOM_TRANSITIONS: cleaning → ['available','ready',...]. **Allowed.** Room can be ready before request COMPLETED. **Reality mismatch risk.** |
| 06:50 | HK completes 101, forgets to press "Confirm completion" | HK | completeRequest() only (no reception confirm) | requestComplete callable: IN_PROGRESS → COMPLETED, isActionRequiredByReception: true. Task visible to reception for confirm. **OK.** |
| 07:00 | Shift change: HK A logs out, HK B logs in. 101 still in "completed" but not confirmed by reception | — | B sees all branch requests; 101 in "action required by reception" | subscribeToRequests by branch, no filter by assignedTo. **Task does not disappear.** Reception sees it. **OK.** |

**State at 09:00 (validation)**  
- Rooms: 101 cleaning→? (HK completed but room status may still be "cleaning" if nobody set it to "ready"). 102 "ready". 103 two cleaning requests if duplicate created.  
- Completed tasks: 101 completed (reception may not have confirmed). 102 request completed (idempotent).  
- Open tasks: 103 duplicate if any; reception queue has "confirm completion" for 101.  
- **Potential failure:** Room 101 status not auto-updated when HK completes. Room 102 set "ready" before inspection recorded → **rooms not fully accurate**.  
- **Code:** Maintenance/Housekeeping complete flow updates room via updateRoomStatus in same flow; Reception "confirm completion" does not necessarily update room. So room can stay "cleaning" until someone sets "ready". **Operational gap.**

---

## 09:00–12:00 — MIDDAY (Cleaning Peak)

| Time | Event | Actor | Action | Code path |
|------|--------|--------|--------|-----------|
| 09:10 | HK B starts 103 (first request); duplicate 103 request still in list | HK | startRequest on request A | currentDepartment → housekeeping. Duplicate request B remains NEW. **Two cards for same room.** |
| 09:15 | Manager marks request X as COMPLETED from dashboard (override) while HK had it IN_PROGRESS | Manager | moveRequest(tenantId, X, 'COMPLETED', reception, ...) | stateTransitionService.moveRequest: COMPLETED allowed only if not from NEW/CANCELLED. currentStatus was IN_PROGRESS → allowed. **Override succeeds.** |
| 09:16 | HK worker still has request X on screen; taps "Complete" | HK | completeRequest(X) → requestComplete callable | Callable: currentStatus already COMPLETED → return success (idempotent). **No duplicate state.** Worker sees update on next snapshot. **OK.** |
| 09:20 | Two housekeepers mark same room 201 "cleaning" at same time | HK1, HK2 | updateRoomStatus(201, 'cleaning') twice | runTransaction each: read current (e.g. dirty), allowed dirty→cleaning, write. Second transaction reads (possibly "cleaning" already), allowed cleaning→cleaning? No — allowed is cleaning→['available','ready',...]. So second update would be same status. **No corruption.** |
| 09:25 | Device (HK tablet) goes offline | — | Requests and room list cached | onSnapshot stops; local state stale. |
| 09:30 | HK completes 201 on offline device; action queued | HK | completeRequest() → fails or queued? | completeRequest uses callable. If offline, callable fails. Client may not queue "complete" in offlineSyncService (queue is for addDoc/updateDoc/smartSave). **Complete not replayed.** |
| 09:35 | Reception sets room 202 to "maintenance" by mistake (meant 203) | Reception | updateRoomStatus(202, 'maintenance') | Allowed if 202 was occupied/dirty/cleaning. **Wrong room status.** |
| 09:40 | Maintenance closes ticket for 203 (correct room) | Maint | confirmComplete → transfer to housekeeping, updateDoc COMPLETED, updateRoomStatus(203, 'cleaning') | maintenance flow: room 203 → cleaning. **OK.** Room 202 still wrong (maintenance). |
| 10:00 | Tablet reconnects (offline was 30+ min) | — | syncOfflineQueue() runs | offlineSyncService: replays create/update/delete. If any "update" request was queued with old status, it would updateDoc(..., data). **Stale overwrite risk.** |
| 10:05 | HK inspects 201 (was "completed" offline but never synced); marks ready | HK | Inspection flow: update request, updateRoomStatus(201, 'ready') | Request might still be IN_PROGRESS on server if complete never reached. So we have: server IN_PROGRESS, local belief COMPLETED. **Desync.** |

**State at 12:00**  
- Rooms: 101 possibly still "cleaning" if not updated. 102 ready. 201 ready (HK set). 202 wrong (maintenance). 203 cleaning.  
- Tasks: Request X COMPLETED (manager override). 201 possibly IN_PROGRESS on server if offline complete failed. Duplicate 103 requests.  
- **Failures:** Room 202 wrong. 201 request state desync if offline complete not replayed. Duplicate 103.

---

## 12:00–15:00 — AFTERNOON (Maintenance)

| Time | Event | Actor | Action | Code path |
|------|--------|--------|--------|-----------|
| 12:10 | Maintenance worker M1 starts ticket for 301 A/C | Maint | startRequest / updateDoc IN_PROGRESS, assignedTo M1 | stateTransitionService or updateDoc. |
| 12:30 | M1 goes on break; M2 picks same ticket and "completes" it | M2 | requestComplete callable | Allowed: IN_PROGRESS → COMPLETED. **No check that M2 "owns" task.** assignedTo still M1. **Operationally OK, audit shows M2 completed.** |
| 12:35 | Reception changes room 302 twice in 10 sec (occupied → cleaning → available) | Reception | updateRoomStatus(302, 'cleaning'); then updateRoomStatus(302, 'available') | cleaning → available not in ALLOWED_ROOM_TRANSITIONS. cleaning → ['available','ready',...]. **available is allowed.** So both succeed. Room 302 available. **OK.** |
| 12:40 | Request created for 303 cleaning; staff acknowledges (starts) but never executes | HK | startRequest → IN_PROGRESS | Task stays IN_PROGRESS, assignedTo set. **Open task visible.** Another worker can complete or it stays open. **OK.** |
| 12:45 | Staff executes 304 cleaning but never confirms completion | HK | completeRequest → requestComplete → COMPLETED | isActionRequiredByReception: true. Reception must confirm. If reception never confirms, request is still COMPLETED. **No "reopen".** **OK.** |
| 13:00 | Task reassigned mid-work: Reception assigns 305 to Maintenance; Maintenance had already started it | — | transferRequestToDepartment(305, maintenance, ...) | requestTransferToDepartment callable or client moveRequest. currentDepartment → maintenance. **OK.** |

**State at 15:00**  
- Rooms: 302 available. 202 still wrong (maintenance). 301, 303, 304, 305 in various states.  
- Open tasks: 303 IN_PROGRESS if not completed. 304 COMPLETED, reception pending.  
- **Failure:** Room 202 incorrect (human error); no automatic correction.

---

## 15:00–18:00 — EVENING (Check-in Rush)

| Time | Event | Actor | Action | Code path |
|------|--------|--------|--------|-----------|
| 15:10 | Guest checks in 401; receptionist changes room twice (401 → 402) | Reception | processCheckIn / transferGuest? Or two check-ins? | roomService.transferGuest: transaction on both rooms. If first check-in 401 then "move" to 402, depends on flow. **Risk:** 401 left occupied if transfer logic fails. |
| 15:20 | Duplicate mobile submission: Bellman taps "Complete" twice on same request | Bellman | handleCompleteRequest → completeRequest() x2 | completeRequest → requestComplete callable. Idempotent. **OK.** |
| 15:25 | Request created twice for 402 (amenity) due to slow network + retry | Guest/Reception | Two createRequest() | No idempotency key. Two documents. **Duplicate request.** |
| 15:30 | Offline mobile sync: device was offline 30 min; syncs old "room 403 cleaning" update | Device | executeOperation(update, requests, docId, { status: 'cleaning', ... }) | offlineSyncService.executeOperation: updateDoc with ...data. **Overwrites server state.** If server had COMPLETED, stale "cleaning" overwrites. **CRITICAL: Stale data can overwrite correct data.** |
| 15:35 | Reception confirms completion for request that was already CANCELLED | Reception | requestConfirmCompletion callable | Callable: currentStatus === 'CANCELLED' → throw failed-precondition. **Rejected.** **OK.** |
| 16:00 | Manager override: sets request Y to CANCELLED while HK has it IN_PROGRESS | Manager | cancelRequest or updateDoc status CANCELLED | Client-side. Allowed. HK sees update on snapshot. **Task invalid.** Worker may have already completed in the field. **Operational confusion.** |

**State at 18:00**  
- Rooms: 401/402 depend on transfer. 403 possibly corrupted if offline overwrite.  
- Tasks: Y CANCELLED. Duplicate 402 requests. Possible 403 request reverted to old status by offline.

---

## 18:00–22:00 — NIGHT (Limited Staff)

| Time | Event | Actor | Action | Code path |
|------|--------|--------|--------|-----------|
| 18:10 | One receptionist handles check-in and checkout; wrong button (checkout 501 instead of 502) | Reception | checkOutGuest(501) or similar | If 501 was occupied, room becomes available. 502 still "occupied". **Wrong room checkout.** |
| 18:20 | HK closes wrong ticket (completes 601 instead of 602) | HK | completeRequest(601) | requestComplete: 601 goes COMPLETED. 602 stays open. **Wrong task closed.** |
| 18:30 | Shift change: Night receptionist logs in; day reception had 5 "confirm completion" pending | Night | Sees same subscribeToRequests; all 5 visible | Tasks don’t disappear. **OK.** |
| 19:00 | Room 701 set to "blocked" then back to "available" without cleaning | Reception | updateRoomStatus(701, 'blocked'); then updateRoomStatus(701, 'available') | blocked → available allowed. **Room sellable without cleaning record.** **Reality gap.** |
| 20:00 | End-of-day report run | Manager | Which rooms clean? Which sellable? Open tasks? | Depends on queries: rooms by status, requests by status/department. If room 701 available but never cleaned, report shows "available" and "sellable". **No automatic link room status ↔ cleaning task.** |

**State at 22:00**  
- Rooms: 501 available (wrong checkout). 502 still occupied. 601 completed (wrong). 602 open. 701 available (blocked→available, no cleaning).  
- Tasks: 602 open. 601 completed (wrong room). Several "confirm completion" pending.

---

# STATE VALIDATION AFTER EACH PERIOD

- **09:00:** Rooms not fully accurate (101 cleaning vs completed task; 102 ready without inspection). Open tasks visible. Departments synced for requests; room status can lag.  
- **12:00:** Room 202 wrong. Request 201 possible desync. Duplicate 103.  
- **15:00:** Same 202 error. 302 OK.  
- **18:00:** 401/402/403 depend on transfer and offline. 501/502 wrong.  
- **22:00:** Multiple room/task mismatches.

**If system state differs from real-world reality → report FAILURE.**  
**FAILURES IDENTIFIED:** See Section "Failure Scenarios and Corrections" below.

---

# SHIFT CHANGE TEST

- **Scenario:** Employee A (HK) starts task T, then shift ends; B logs in.  
- **Who owns the task?** assignedTo still A. currentDepartment housekeeping.  
- **Does it disappear?** No. subscribeToRequests is by branch (and optional status), not by assignedTo. All HK see T.  
- **Can B continue?** Yes. B can complete; requestComplete doesn’t check assignedTo.  
- **Stuck forever?** Only if nobody completes. So **PASS** (task remains visible and continuable).

---

# OFFLINE & RECONNECT TEST (30 min offline)

- **Scenario:** Device offline 30 min; user completed request R on device; reconnect.  
- **Does outdated data overwrite correct data?** Yes. offlineSyncService.executeOperation for "update" does updateDoc(docRef, { ...data, updatedAt, _syncedAt }). So whatever was in `data` (e.g. status: 'IN_PROGRESS') overwrites server. If server had COMPLETED, **stale can overwrite**.  
- **Can it reopen closed tasks?** Yes. If queued operation has status: 'IN_PROGRESS', after sync the document gets IN_PROGRESS again.  
- **Can it corrupt room status?** If room updates were queued with tenantId and collection 'rooms', same overwrite risk.  
- **Files:** `src/services/offlineSyncService.ts` executeOperation (update branch).  
- **Required correction:** Before applying an offline update, read current doc (or use transaction). If server version is "more advanced" (e.g. COMPLETED vs IN_PROGRESS), skip or merge safely (e.g. don’t downgrade status). Option: last-write-wins by timestamp only if client timestamp > server updatedAt.

---

# DOUBLE ACTION TEST

- **Two cleanings same room:** Two updateRoomStatus(room, 'cleaning'). Both use runTransaction; second may read "cleaning" and try cleaning→cleaning (not in allowed list as a transition). Allowed transitions from 'cleaning' are to available, ready, maintenance, blocked. So second write would be same status — no duplicate record; room doc single. **OK.**  
- **Two closures same request:** Both call requestComplete. Callable idempotent (COMPLETED → return success). **OK.**  
- **Two assignments same request:** Both updateDoc assignedTo. Last write wins. **No duplication; possible confusion who is assigned.**  
- **Conclusion:** Double action on same room/request does not duplicate or corrupt records; idempotency and transaction help. **PASS** (with last-assignment overwrite acceptable).

---

# MANAGER OVERRIDE TEST

- **Manager sets request to COMPLETED while worker has it IN_PROGRESS.**  
  moveRequest(COMPLETED, reception) is allowed (currentStatus IN_PROGRESS). Worker sees update via onSnapshot. **OK.**  
- **Manager sets request to CANCELLED while IN_PROGRESS.**  
  Client cancelRequest / updateDoc. Allowed. Worker sees CANCELLED. Task no longer "open" for execution. **OK.**  
- **Workers see update?** Yes (real-time subscription).  
- **Tasks remain valid?** Yes (state is consistent).  
- **Ghost assignments?** assignedTo might point to old employee; no "ghost" in terms of disappearing tasks. **PASS.**

---

# END OF DAY RECONCILIATION

**Questions:**  
1. Which rooms are clean?  
2. Which rooms are sellable?  
3. Which tasks remain open?  
4. Which tasks were truly completed?

**System capability:**  
- Rooms: Query tenants/{tenantId}/rooms by status. "ready" and "available" are sellable. No automatic link to "a cleaning task was completed for this room."  
- Tasks: Query tenants/{tenantId}/requests by status (e.g. COMPLETED, IN_PROGRESS). Open = not COMPLETED/CANCELLED.  
- **Gap:** System cannot confidently say "room 701 was cleaned" because room can be set available/ready without a completed cleaning request. So **partial failure** for "truly completed" vs "room sellable."  
- **If system cannot confidently determine these → CRITICAL OPERATIONAL FAILURE.**  
- **Verdict:** System can list rooms by status and tasks by status. It cannot enforce 1:1 room-status ↔ completed-task. So **reconciliation is best-effort**, not guaranteed correct.

---

# FAILURE SCENARIOS AND CORRECTIONS

## F1. Stale offline data overwrites server (reopen closed tasks, corrupt room status)

- **Event timeline:** Device offline → user completes request (or updates room) → action queued; server later has COMPLETED (or correct room). Reconnect → sync replays update → server overwritten.  
- **System state:** Request back to IN_PROGRESS or room to old status.  
- **Why allowed:** executeOperation does updateDoc with operation.data; no read-before-write or version check.  
- **Files:** `src/services/offlineSyncService.ts` (executeOperation, smartSave).  
- **Real hotel consequence:** Closed tasks reappear; rooms show wrong status; double work or wrong sellable rooms.  
- **Required correction:** Version-aware sync: read current doc before apply; if server.updatedAt > operation.timestamp or server status is "terminal" (COMPLETED, CANCELLED), skip update or merge without downgrading. Option: store serverUpdatedAt in queue and compare on sync.

---

## F2. Duplicate requests (create twice, two cleanings same room)

- **Event timeline:** Double tap or retry creates second request; or two staff create for same room.  
- **System state:** Two documents in tenants/{tenantId}/requests for same room/type/time window.  
- **Why allowed:** createRequest has no idempotency key; QuickCreateModal only disables button (race or second device can still create).  
- **Files:** `src/services/requestService.ts` createRequest; `src/components/reception/QuickCreateModal.tsx`.  
- **Real hotel consequence:** Duplicate work, confusion, wrong metrics.  
- **Required correction:** Idempotency key (e.g. client-generated requestId or hash(tenantId, branchId, roomNumber, type, timestampWindow)) and server-side dedup (check existing request with same key before addDoc).

---

## F3. Room status not auto-updated when task completed

- **Event timeline:** HK (or Maintenance) completes task; room status not updated to "ready" or "cleaning" in same flow in all code paths.  
- **System state:** Room still "cleaning" or "occupied" while task is COMPLETED.  
- **Why allowed:** Some flows call updateRoomStatus after complete; Reception "confirm completion" may not update room.  
- **Files:** Housekeeping/Maintenance complete flows; Reception confirm completion flow.  
- **Real hotel consequence:** Rooms not sellable when they are; housekeeping thinks room still in progress.  
- **Required correction:** Ensure every completion path (including reception confirm completion) updates room status when applicable (e.g. cleaning task completed → room "ready" or "available").

---

## F4. Wrong room / wrong ticket (human error)

- **Event timeline:** Reception sets 202 maintenance (meant 203); checkout 501 instead of 502; HK completes 601 instead of 602.  
- **System state:** 202 wrong status; 501 available / 502 occupied; 601 completed / 602 open.  
- **Why allowed:** No server-side check that "this room number matches this request" for status updates; no confirmation step for critical actions.  
- **Files:** All UI that call updateRoomStatus or completeRequest without re-confirming room/request id.  
- **Real hotel consequence:** Wrong room blocked, wrong room sold, wrong task closed.  
- **Required correction:** UI: confirm room number / request id for critical actions (checkout, complete, set maintenance). Optional: server-side validate request.roomNumber matches room doc when updating room status for that request.

---

## F5. Room set sellable without cleaning record

- **Event timeline:** Reception sets room 701 blocked → available without any cleaning task.  
- **System state:** Room "available", no COMPLETED cleaning request for 701.  
- **Why allowed:** ALLOWED_ROOM_TRANSITIONS allow blocked→available; no link between room status and request completion.  
- **Files:** `src/services/roomService.ts` ALLOWED_ROOM_TRANSITIONS; business logic (no enforcement room ↔ task).  
- **Real hotel consequence:** Unsanitary room sold.  
- **Required correction:** Policy: either (a) allow available only from "ready" and "ready" only after a completed cleaning request for that room, or (b) keep current flexibility but add reporting/alerts when room is available with no recent completed cleaning request.

---

# DAY 2 — DIFFERENT OPERATIONAL DAY (New Problems)

## Focus: Late sync, bulk errors, and reconciliation

| Time | Event | Result |
|------|--------|--------|
| 07:00 | 20 checkouts in 10 min; reception uses "bulk complete" on 20 requests | bulkCompleteRequests: some moveRequest fail → legacy batch.update; batch.commit() once. If one request was CANCELLED, moveRequest throws, that one goes to legacy. If batch.commit() fails, entire bulk fails (no per-request success count). **Partial failure possible; user sees generic error.** |
| 07:15 | One request in bulk was already COMPLETED | moveRequest(COMPLETED, reception): stateTransitionService blocks COMPLETED from NEW, allows from IN_PROGRESS. So already COMPLETED → currentStatus COMPLETED → newStatus COMPLETED → allowed. Idempotent. **OK.** |
| 08:00 | Offline queue has 5 updates; 3 are request status updates (old). Sync runs | executeOperation for each. 3 overwrite server COMPLETED with IN_PROGRESS. **Same as F1.** |
| 08:30 | Shift change: 3 tasks assigned to previous shift; new shift completes them without "reassign" | completeRequest works; assignedTo still old employee. **OK.** Audit trail shows who completed. |
| 12:00 | Manager runs "which tasks remain open?" | Query status != COMPLETED and != CANCELLED. **Accurate.** |
| 12:05 | Manager runs "which rooms are sellable?" | Query room status in ['available','ready']. **Accurate for status;** not for "was cleaned" (F5). |
| 14:00 | Scheduled task creates a request while tenant has quota limit | ScheduledTaskRunner creates request in tenants/{tenantId}/requests. No quota check in code path. **Possible over-creation.** |
| 20:00 | EOD: "which tasks were truly completed?" | List COMPLETED requests. **Accurate.** "Which rooms are clean?" — only by status (ready/available), not by task. **Same as Day 1.** |

**New failure from Day 2:**  
- **F6. Bulk partial failure:** On bulk confirm/complete, if some items fail, user gets one error message; no successCount/failedCount. **Correction:** Return { successCount, failedCount, failedIds } and show in UI "تم تأكيد X من Y" or "فشل Z عناصر".

---

# REPEAT UNTIL NO NEW OPERATIONAL FAILURE

- **F1–F6** cover: offline overwrite, duplicate requests, room not auto-updated, wrong room/ticket, room sellable without cleaning, bulk feedback.  
- Further runs could add: concurrent room transfer (two receptions transfer same guest), scheduled task failure revert (already implemented), and permission-denied on sync (already handled in firebaseOptimizationService).  
- **No additional distinct failure mode** identified without introducing new code paths.  
- **Conclusion:** Simulation stops here. Remaining risks are documented; corrections required as above.

---

# SUMMARY TABLE

| ID | Failure | Root cause | Fix |
|----|---------|------------|-----|
| F1 | Stale offline overwrites server | No version/read-before-write in sync | Version-aware or conditional apply in offlineSyncService |
| F2 | Duplicate requests | No idempotency key on create | Server/client idempotency key + dedup |
| F3 | Room status not updated on complete | Not all paths call updateRoomStatus | Ensure all completion paths update room |
| F4 | Wrong room/ticket (human) | No confirmation or server check | UI confirm + optional server validation |
| F5 | Room sellable without cleaning | No room↔task link | Policy or enforcement (ready only after task) / alerts |
| F6 | Bulk partial failure opaque | Single throw, no counts | Return successCount/failedCount; show in UI |

**System can survive a day** if: (1) offline sync is fixed (F1), (2) duplicate creation is reduced (F2), (3) room status is kept in sync with completion (F3), (4) critical actions are confirmed (F4), (5) policy or alerts for room sellable without cleaning (F5), (6) bulk feedback (F6). Without these, **operational collapse risk** remains (wrong rooms, duplicate work, stale data overwriting good state).

---

# CODE REFERENCES (for corrections)

| Item | File | Notes |
|------|------|--------|
| Offline update replay | `src/services/offlineSyncService.ts` ~211–246 `executeOperation` | Add read-before-write; skip or merge if server newer/terminal |
| Create request | `src/services/requestService.ts` createRequest; `QuickCreateModal.tsx` handleSubmit | Add idempotency key; server dedup |
| Room status on complete | Housekeeping/Maintenance complete flows; Reception confirm | Ensure updateRoomStatus after completion where applicable |
| Room transitions | `src/services/roomService.ts` ~87–95 ALLOWED_ROOM_TRANSITIONS, ~609–628 updateRoomStatus | F5: policy or extra validation |
| Bulk result | `src/services/requestService.ts` bulkConfirmRequests, bulkCompleteRequests | Return { successCount, failedCount } and surface in UI |
| Callables idempotency | `functions/src/requests/requestActions.ts` requestComplete, requestConfirmCompletion | Already reject CANCELLED; COMPLETED→success |
| State machine block | `src/services/stateTransitionService.ts` ~161–169 | COMPLETED from CANCELLED/NEW blocked |
