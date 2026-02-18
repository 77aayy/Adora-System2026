# مراجعة المشروع حسب القواعد وهيكل الـ SaaS

**تاريخ المراجعة:** 2025  
**نطاق:** مراجعة منطقية وهيكلية حسب `.cursorrules` وهوية المشروع (SaaS، صفحات متداخلة، كروت تنتقل بين الأقسام).  
**الأولوية:** الدقة أولاً — لا تنفيذ تغييرات دون موافقتك.

---

## 1. عزل البيانات (Tenant vs Root) — حرج

### القاعدة في `.cursorrules`
- **Tenant Data:** يجب أن تكون تحت `tenants/{tenantId}/collection`.
- **Platform Data:** فقط في الجذر: `managers`, `invoices`, `system_settings`.

### الواقع الحالي
- **مسارات صحيحة (مطابقة للقاعدة):**
  - `requestService`: `tenants/${tenantId}/requests` ✅
  - `roomService`: `tenants/${validatedTenantId}/rooms` ✅
  - `roomCardService`: `tenants/${validatedTenantId}/roomCards` ✅
  - `payoutService`, `workflowService`, `criticalDelayAlertService`, `pendingAlertService`, `overdueAlertService`, `autoTransferService`, `dashboardStatsService`, `statsService`, `qrServiceService`, `staffService`, `receptionCoreService`, `predictiveMaintenanceService`, `coffeeShopService`: استخدام مسارات تحت `tenants/` للطلبات أو الغرف أو الدفع.

- **مسارات غير متوافقة مع القاعدة (جذر بدون tenant):**
  | الملف | المجموعة | الملاحظة |
  |------|----------|----------|
  | `dataDoctorService.ts` | `rooms` | السطر 93: `collection(db, 'rooms')` — يجب `tenants/${tenantId}/rooms` لفحص/إصلاح غرف الـ tenant فقط. |
  | `receptionAdvancedService.ts` | `rooms`, `requests` | `smartRoomAssignment` ومسارات أخرى تستخدم `collection(db, 'rooms')` و`collection(db, 'requests')` بدون `tenantId` — لا عزل tenant. |
  | `receptionReportsService.ts` | `requests`, `roomCards` | كل التقارير تقرأ من `collection(db, 'requests')` و`collection(db, 'roomCards')` مع `branch` فقط — بدون `tenantId`. |
  | `roomTransferService.ts` | `roomCards`, `requests`, `roomTransfers`, `departmentNotifications`, `guestNotifications` | كل العمليات على جذر المجموعات مع فلتر `tenantId` داخل الاستعلام — حسب القاعدة يفترض أن تكون البيانات تحت `tenants/{tenantId}/...`. |
  | `exceptionDashboardService.ts` | `requests` | جذر `requests` بدون مسار tenant. |
  | `exceptionService.ts` | `requests` | نفس المشكلة. |
  | `unifiedHistoryService.ts` | `requests` | جذر `requests`. |
  | `reportsService.ts` | `requests` | جذر `requests`. |
  | `smartPredictionService.ts` | `requests` | جذر `requests`. |
  | `overflowService.ts` | `requests` | جذر `requests`. |
  | `badgeService.ts` | `requests` | جذر `requests`. |
  | `autoReportsService.ts` | `requests` | جذر `requests`. |
  | `analyticsService.ts` | في أماكن: `rooms`, `requests` | بعض الاستعلامات تستخدم `collection(safeDb, 'rooms')` و`collection(safeDb, 'requests')` (جذر) — غير متسق مع استخدامه في أماكن أخرى لـ `tenants/${tenantId}/rooms` و`tenants/${tenantId}/requests`. |
  | `smartAlertsService.ts` | `serviceRequests`, `maintenance`, `requests`, `laundryRecords` | كلها جذر — لا مسار tenant. |
  | `demoFactory.ts` | `requests`, `rooms` | جذر — قد يكون مقصوداً للديمو فقط، لكن يبقى غير متوافق مع قاعدة العزل. |
  | `backupService.ts` | `rooms`, `users`, `branches`, `systemSettings` | يستخدم جذر مجموعات — إن كان النسخ يدعم multi-tenant فيجب أن يعتمد مسارات tenants أو يوثق أن النسخ للمنصة فقط. |

### توصيات
1. **توحيد مصدر الطلبات والغرف والكروت:**  
   كل الخدمات التي تستهلك أو تُحدث طلبات/غرف/كروت غرفة يجب أن تستخدم **نفس المصدر**: إما كله `tenants/{tenantId}/requests|rooms|roomCards` أو كله جذر مع حقل `tenantId` وضمان أن القواعد والكود لا يسمحان بقراءة tenant آخر. حاليًا الخلط بين النموذجين يسبب خطر تسريب أو خلط بيانات بين tenants.
2. **تعديل مسار dataDoctor:**  
   `healRoomsForBranch` يجب أن يعمل على `tenants/${tenantId}/rooms` وليس `collection(db, 'rooms')`.
3. **تعديل roomTransferService:**  
   استخدام `tenants/${tenantId}/roomCards` و`tenants/${tenantId}/requests` (ومجموعات النقل والإشعارات إن كانت خاصة بالـ tenant) بدل الجذر.
4. **receptionReportsService و receptionAdvancedService:**  
   إدخال `tenantId` في التوقيعات والاستعلامات واستخدام مسارات tenant-scoped للتقارير والتعيين الذكي.

---

## 2. قواعد Firestore والأمان

### قواعد القراءة الحالية
- `tenants/{tenantId}/{document=**}`: `allow read: if request.auth != null` — **أي مستخدم مصادق يمكنه قراءة أي tenant**. العزل يعتمد على الكود وليس على القواعد.
- مجموعات الجذر مثل `requests`, `rooms`, `roomCards`: نفس الصورة — قراءة لأي مصادق.

### مخاطر
- إذا ظهر ثغرة في طبقة التطبيق (مثلاً نسيان فلتر `tenantId`) يصبح من الممكن قراءة بيانات tenant آخر.
- **توصية طويلة الأمد:** في القواعد، ربط القراءة بـ `get(/databases/$(database)/documents/userBindings/$(request.auth.uid)).data.tenantId == tenantId` لفرض العزل على مستوى Firestore (مع مراعاة أداء وعدد القراءات).

### أسرار و API Keys
- **Firebase:** القراءة من `import.meta.env.VITE_FIREBASE_API_KEY` وعدم السماح بـ `YOUR_API_KEY` — سليم.
- **Gemini:** `(import.meta as any).env.VITE_GEMINI_API_KEY` — يفضّل استبدال `as any` بنوع مناسب لـ `ImportMeta.env` إن وُجد، وتجنب تمرير المفتاح في كود يمكن تسريبه.
- **ImgBB وخدمات أخرى:** المفاتيح تأتي من إعدادات المستأجر أو بيئة — لا توجد أسرار مكتوبة صراحة في الكود من المراجعة الحالية.

---

## 3. الأنماط والهيكل (Types & Separation)

### استخدام `any`
- أكثر من **200 ملف** تحتوي على `: any` أو `as any` — مخالف للقاعدة "NO `any` type" في `.cursorrules`.
- الأثر: تقليل فائدة TypeScript في اكتشاف الأخطاء وتوثيق العقد.  
- **توصية:** تقليل `any` تدريجياً بدءاً بالملفات الحرجة (مثلاً `requestService`, `roomService`, `AuthContext`, `TenantContext`) واستبدالها بواجهات من `src/types`.

### فصل الاهتمامات
- القاعدة: مكونات → UI فقط؛ خدمات → Firebase/API؛ hooks → منطق الأعمال.
- من العيّنة: غالبية استدعاءات Firestore من الخدمات وليس من المكونات مباشرة، لكن بعض المكونات قد تستدعي خدمات معقدة — مراجعة مخصصة لكل feature ستساعد في ضمان عدم وضع منطق قاعدة بيانات ثقيل داخل المكونات.

---

## 4. تدفق الطلبات والكروت بين الأقسام (SaaS وأدوار)

### ما تم التحقق منه
- **requestService** يفرض `validateTenantId` / `validateTenantAccess` ويستخدم `tenants/${tenantId}/requests` — الطلبات مرتبطة بـ tenant.
- **roomCardService** يستخدم `tenants/${validatedTenantId}/roomCards` — كروت الغرف معزولة.
- **نقل الطلبات بين الأقسام:** يحدث عبر تحديث الحالة/القسم في نفس المستند أو عبر خدمات تستخدم نفس مسار الـ tenant — لا يوجد في المراجعة انتقال "كروت" بين tenants، بل بين أقسام نفس الـ tenant.

### تنبيه
- **roomTransferService** يكتب اليوم إلى مجموعات جذر (`roomCards`, `requests`, إلخ). إذا كانت البيانات الفعلية تعيش تحت `tenants/{tenantId}/...` فإن هذه الكتابات إما أن تكون على مجموعات مختلفة (مثلاً legacy) أو أن النقل لا يحدث على المصدر الصحيح — يجب توحيد المسارات كما في البند 1.

---

## 5. نقاط إضافية سريعة

- **تسريب الذاكرة:** وجود عدد كبير من استخدامات `onSnapshot` و`setInterval`/`setTimeout` — يفضّل مراجعة كل `useEffect` الذي يسجل اشتراكاً أو مؤقتاً ويُرجع دالة تنظيف `return () => { unsubscribe(); clearInterval(...); }`.
- **trialRequestService:** في مسار إعادة المحاولة بعد permission-denied يُستخدم `safeDb` دون تعريفه في نفس النطاق (السطر 172 تقريباً) — يجب استدعاء `getSafeFirestore()` أو استخدام `db` بشكل متسق وتصحيح المرجع.
- **Firestore Rules:** وجود قواعد لـ `match /requests/`, `match /rooms/`, `match /roomCards/` على الجذر بينما جزء كبير من التطبيق يقرأ/يكتب تحت `tenants/` — إما تحديث القواعد لتعكس المسارات الفعلية أو توثيق أن الجذر لاستخدامات محددة (مثلاً ديمو أو ترحيل).

---

## 6. ملخص التوصيات حسب الأولوية

| الأولوية | البند | الإجراء المقترح |
|----------|--------|------------------|
| عالية | عزل البيانات | توحيد مصدر الطلبات/الغرف/كروت الغرفة على مسارات `tenants/{tenantId}/...` وتعديل كل خدمة تقرأ/تكتب من جذر المجموعات. |
| عالية | dataDoctorService | تغيير `healRoomsForBranch` لاستخدام `tenants/${tenantId}/rooms` بدل `collection(db, 'rooms')`. |
| عالية | roomTransferService | استخدام مسارات tenant للـ roomCards والطلبات وجميع المجموعات المرتبطة بنقل الغرفة. |
| متوسطة | receptionReportsService / receptionAdvancedService | إضافة `tenantId` واستخدام مسارات tenant للتقارير والتعيين الذكي. |
| متوسطة | trialRequestService | إصلاح استخدام `safeDb` (تعريف أو استبدال بـ `db`/`getSafeFirestore()`). |
| متوسطة | قواعد Firestore | تعزيز العزل في القواعد حسب tenantId عند الإمكان؛ توثيق الفرق بين مجموعات الجذر ومسارات tenants. |
| منخفضة | تقليل `any` | استبدال تدريجي في الملفات الحرجة. |
| منخفضة | Gemini env | إزالة `as any` لـ `import.meta.env` إن أمكن. |

---

**الخلاصة:** المشروع يعمل بنموذجين للبيانات (مسارات تحت `tenants/` ومجموعات جذر مع أو بدون `tenantId`). لأجل SaaS كبير وصفحات متداخلة وكروت تنتقل بين الأقسام، الأهم هو **توحيد مصدر البيانات وعزل الـ tenant في المسارات والاستعلامات والقواعد**، ثم إصلاح الخدمات المذكورة أعلاه. يمكن تنفيذ التعديلات على مراحل حسب أولوياتك (مثلاً dataDoctor و roomTransfer أولاً، ثم التقارير والـ reports).
