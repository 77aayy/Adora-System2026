# مراجعة الدوائر المغلقة — طلبات، QR، استقبال، مشتريات، داشبورد

**النطاق:** دائرة الأقسام (توجيه الطلبات بين الأقسام)، دائرة QR (زبون → استقبال → قسم)، عربة المشتريات، التسميع/الموافقة في المشتريات، داشبورد المشتريات.  
**تاريخ:** مراجعة دقيقة 100% حسب الرولز (قراءة كاملة، نطاق متغيرات، عدم تخمين).

---

## 1. دائرة الأقسام وتوجيه الاستقبال

### 1.1 إنشاء الطلب من الاستقبال

- **المصدر:** `requestService.createRequest` و `useReceptionActions.handleCreateRequest`.
- **طلب من الاستقبال (Quick Create / إنشاء سريع):**
  - **handleCreateRequest** (في `useReceptionActions.ts`): يكتب مباشرة إلى `tenants/${tenantId}/requests` عبر `addDoc` مع:
    - `currentDepartment` = `getDepartment(data.type, data.emergencyTargetDepartment)` (من نوع الطلب أو emergencyTargetDepartment).
    - `originDepartment: 'reception'`.
    - لا يستدعي `requestService.createRequest`، لذلك **لا يُرسل إشعار push للمسؤول عن القسم** عبر `sendNotificationToDepartment` الموجود في requestService.
  - **النتيجة:** الطلب يظهر في القائمة (لأن الداشبوردات تستمع إلى `tenants/tenantId/requests`) لكن قسم الهدف قد لا يستقبل إشعاراً إلا إذا اعتمد على الـ real-time listener فقط.

- **طلب عبر requestService (مثلاً من واجهة تستخدم createRequest):**
  - `requestService.createRequest` يحدد `initialDepartment` من `input.type` (تنظيف/صيانة/بيلمان/مشتريات/قهوة...)، يكتب إلى `tenants/${tenantId}/requests`، ويرسل إشعاراً للقسم عبر `sendNotificationToDepartment`.
  - **الدائرة مغلقة:** إنشاء → مسار tenant → إشعار القسم.

### 1.2 نقل الطلب بين الأقسام

- **الدالة:** `requestService.transferRequestToDepartment(requestId, tenantId, fromDepartment, toDepartment, userId, userName, status?, notes?)`.
- **المسار:** محاولة استخدام **State Machine** (`stateTransitionService.moveRequest`)، عند الفشل **Fallback** بتحديث مباشر على `tenants/${validatedTenantId}/requests` (تحديث `currentDepartment`, `departmentHistory`, `deliveredAt`, إلخ).
- **تصحيح تم:** كان سجل التدقيق (Audit Log) يستخدم `request`, `oldDepartment`, `oldStatus` دون تعريفها عند نجاح State Machine. تم جلب الطلب مرة واحدة في بداية الدالة وتعريف `oldDepartment` و `oldStatus` لاستخدامهما في السجل في كلا المسارين.

### 1.3 التأكيد من الاستقبال (Confirm) وإغلاق الدائرة

- **useReceptionActions.handleConfirmRequest:**
  - طلب فحص (inspection من bellman_checkout): بعد التأكيد يُنشأ طلب تنظيف ويُحدَّث الطلب الأصلي إلى COMPLETED.
  - **طلب QR:** إذا `source === 'QR'` و `status === 'PENDING_RECEPTION'` يتم تحديد القسم الهدف ثم استدعاء `transferRequestToDepartment` (إلا إذا كان الهدف reception فيُحدَّث الـ history فقط).
  - **تصحيح تم:** كان يتم حساب القسم الهدف من نوع الطلب فقط (`getTargetDepartment(requestData.type)`) وتجاهل القسم المحفوظ في الطلب من إعدادات الـ QR. تم تغيير المنطق لاستخدام **أولاً** `requestData.currentDepartment` أو `requestData.emergencyTargetDepartment` إن وُجد، وإلا اشتقاق القسم من النوع. بهذا طلبات QR من نوع "other" مع targetDepartment من الإعدادات تُوجَّه إلى القسم الصحيح.

---

## 2. دائرة QR: زبون → استقبال → قسم

### 2.1 من طرف الزبون

- **المصدر:** `GuestDashboard` — عرض خدمات QR من `qrServiceService.subscribeToQRServices(branchId, tenantId, callback)`.
  - الاشتراك يقرأ من **مجموعة جذر** `qr_services` مع فلتر `branchId`, `tenantId`, `isActive`.
- عند إرسال الطلب: `createRequestFromQRService(serviceId, roomNumber, guestName, ..., branchId, tenantId)` في `qrServiceService.ts`.
  - الطلب يُكتب في **`tenants/${tenantId}/requests`** مع:
    - `status: 'PENDING_RECEPTION'`.
    - `originDepartment: 'reception'`.
    - `currentDepartment: service.targetDepartment || 'reception'` (من إعداد الـ QR).
    - `source: 'QR'`, وربما `emergencyTargetDepartment` إن كان النوع `other`.

### 2.2 في الاستقبال

- الاستقبال يعرض الطلبات من نفس المجموعة `tenants/${tenantId}/requests` (مثلاً فلتر حسب الفرع/الحالة).
- عند النقر "تأكيد" على طلب QR: `handleConfirmRequest` يحدد القسم الهدف (بعد التصحيح من الطلب نفسه إن وُجد) ثم ينقل الطلب إلى ذلك القسم عبر `transferRequestToDepartment`.
- **الدائرة:** زبون يرسل من QR → طلب في tenants مع currentDepartment من إعداد الـ QR → استقبال يؤكد → نقل إلى القسم المختص. الدائرة مغلقة بعد التصحيح أعلاه.

---

## 3. عربة المشتريات (Procurement Cart)

### 3.1 مصدران للعربة

- **ProcurementCart.tsx (مكوّن كبير):** يستخدم مفتاح تخزين **`adora_cart_${department}`** (عربة لكل قسم)، ويحمّل الطلبات السابقة من **`tenants/${currentTenantId}/procurementRequests`**.
- **procurementCartService.ts:** مفتاح تخزين **`adora_cart`** (بدون department)، و`submitCart` يستدعي **procurementService.createProcurementRequest** الذي يكتب إلى **`tenants/${tenantId}/procurementRequests`**.
- **receptionAdvancedFeatures.ts:** مفتاح **`procurement_cart`** ووظائف `getProcurementCart` / `clearProcurementCart` — مصدر ثالث قديم.
- **التوصية:** توحيد مصدر العربة ومفتاح التخزين (مثلاً اعتماد `adora_cart_${department}` أو خدمة واحدة فقط) حتى لا تتشتت البيانات.

### 3.2 إرسال العربة (التسميع / إرسال للموافقة)

- **ProcurementCartWizard:** يكتب مباشرة إلى **`tenants/${effectiveTenantId}/procurementRequests`** عبر `addDoc` مع `status: orderStatus` (إما `APPROVED` عند autoApproved أو `PENDING_APPROVAL`). لا يستدعي `procurementService.createProcurementRequest` ولا `procurementCartService.submitCart`.
- **procurementCartService.submitCart:** يستدعي `procurementService.createProcurementRequest` مع `bypassApproval` حسب المصدر (dashboard/manager)، ويكتب إلى نفس المجموعة `tenants/${tenantId}/procurementRequests`.
- **الخلاصة:** طلبات المشتريات (سواء من الويزارد أو من الخدمة) تُخزَّن في **`tenants/${tenantId}/procurementRequests`**؛ الدائرة من حيث المسار صحيحة. الفرق فقط في من يُنشئ السجل (الويزارد مباشرة vs الخدمة مع إشعارات/سجلات).

---

## 4. التسميع / الموافقة في المشتريات

### 4.1 موافقة المدير (تسميع الطلب)

- **الدالة:** `procurementService.approveProcurement(requestId, managerId, managerName, tenantId)`.
  - **تصحيح تم:** كانت تستخدم `getDoc(requestRef)` دون استيراد `getDoc`، وتتعامل مع النتيجة كـ QuerySnapshot (`.empty`, `.docs[0].data()`). تم إضافة **`getDoc`** إلى الـ imports وتصحيح المنطق إلى **`!requestSnap.exists()`** و **`requestSnap.data()`** لأن `getDoc` يعيد `DocumentSnapshot`.
  - المسار: **`tenants/${tenantId}/procurementRequests`** — صحيح.

### 4.2 رفض المدير

- **rejectProcurement** كانت تستخدم `getDoc` بشكل صحيح (exists/data) لكن **`getDoc` غير مستورد**؛ تم حل ذلك بإضافته في الـ imports مع `approveProcurement`.

### 4.3 استلام الصنف (تأكيد الاستلام)

- **procurementService.confirmReceipt(tenantId, requestId, ...)** يحدّث المستند في **`tenants/${tenantId}/procurementRequests`** ويستخدم معامل `tenantId` بشكل صحيح.
- **procurementCartService.loadPendingReceiving(branchId)** و **confirmReceiving** يقرآن/يكتبان إلى **جذر** `procurement_requests`. إذا كان كل إنشاء الطلبات يتم في `tenants/.../procurementRequests` فإن هذه الدوال **لا ترى** الطلبات الجديدة. التوصية: إما إهمالها أو تعديلها لاستخدام مسار tenant مع تمرير `tenantId`.

### 4.4 إغلاق الطلب (closeProcurement)

- **تصحيح تم:** الدالة كانت تستخدم `tenantId` في المسار دون أن تكون معاملًا. تم تعديل التوقيع إلى **`closeProcurement(requestId, tenantId)`** وفرض التحقق من وجود `tenantId`.

---

## 5. داشبورد المشتريات والبيانات المعروضة

- **ProcurementDashboard** يعتمد على:
  - **subscribeToPendingApprovals**, **subscribeToApprovedRequests**, **subscribeToDepartmentRequests**, **subscribeToDeliveredRequests** من `procurementService` — كلها على **`tenants/${tenantId}/procurementRequests`** مع فلترة branch/department/status.
- الإجراءات: **approveProcurement**, **rejectProcurement**, **startPurchasing**, **completePurchase**, **deliverItems**, **confirmReceipt** — كلها تستخدم مسار tenant بعد التصحيحات.
- **الدائرة:** الطلبات تُنشأ في tenant → المدير يرى PENDING_APPROVAL ويوافق/يرفض → قسم المشتريات يرى APPROVED ويشتري ويسلّم → القسم يؤكد الاستلام. الدائرة مغلقة على مستوى البيانات والمسارات.

---

## 6. ملخص التصحيحات التي تمت

| الملف | المشكلة | التصحيح |
|-------|---------|---------|
| **requestService.ts** | في `transferRequestToDepartment` سجل التدقيق يستخدم `request`, `oldDepartment`, `oldStatus` دون تعريف عند نجاح State Machine | جلب الطلب مرة واحدة في بداية الدالة وتعريف `oldDepartment`, `oldStatus` واستخدامهما في السجل في كلا المسارين |
| **procurementService.ts** | `approveProcurement` يستخدم `getDoc` غير المستورد ويعامل النتيجة كـ QuerySnapshot | إضافة `getDoc` إلى الـ imports واستخدام `!requestSnap.exists()` و `requestSnap.data()` |
| **procurementService.ts** | `closeProcurement` يستخدم `tenantId` غير المعرّف في المسار | جعل `tenantId` معاملًا ثانيًا في التوقيع والتحقق منه |
| **useReceptionActions.ts** | عند تأكيد طلب QR يتم اشتقاق القسم من النوع فقط وتجاهل القسم المحفوظ في الطلب | استخدام `requestData.currentDepartment` أو `requestData.emergencyTargetDepartment` أولاً، ثم اشتقاق القسم من النوع |

---

## 7. توصيات إضافية (لم تُنفَّذ)

- **إنشاء طلب من الاستقبال (handleCreateRequest):** مراعاة استدعاء إشعار القسم (مثلاً عبر `requestService.createRequest` أو استدعاء `sendNotificationToDepartment` بعد الـ addDoc) حتى يظهر للقسم إشعار فوري.
- **عربة المشتريات:** توحيد مصدر العربة ومفاتيح التخزين (`adora_cart`, `adora_cart_${department}`, `procurement_cart`) واختيار مسار واحد (مثلاً ProcurementCartWizard إما يستدعي procurementService.createProcurementRequest أو نحدد أن الويزارد للمشاهد السريعة فقط).
- **procurementCartService.loadPendingReceiving / confirmReceiving:** إن كانت ما زالت مستخدمة في واجهة ما، تعديلهما لاستخدام **`tenants/${tenantId}/procurementRequests`** وتمرير `tenantId`؛ وإلا اعتبارهما قديمين وتوثيق ذلك أو إزالتهما.

تمت المراجعة والتصحيحات وفق الرولز (قراءة الدوال والسياق، التحقق من نطاق المتغيرات، عدم التخمين).
