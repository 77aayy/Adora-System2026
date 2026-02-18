# مراجعة حدية لما نُفّذ من الخطة (حسب الرولز)

تاريخ المراجعة: بعد تنفيذ Phases 0–8 ونشر القواعد والـ Functions.

---

## معايير المراجعة (من الرولز)

- **Security First:** لا أسرار مكشوفة؛ قواعد آمنة؛ عزل tenant.
- **Zero Guessing / No `any`:** عدم التخمين؛ TypeScript صارم (تفادي `any` في الكود الجديد).
- **Separation of Concerns:** منطق في الخدمات/الدوال، واجهة في المكونات.
- **Rule: UPDATE > CREATE:** التعديل على الموجود وعدم إعادة بناء من الصفر.
- **الخطة:** تنفيذ Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 مع التبعيات.

---

## Phase 0: userBinding

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| إنشاء/تحديث userBinding بعد تسجيل الدخول | ✅ | مسار Owner ومسار non-owner مغطيان في AuthContext. |
| التحقق + إعادة محاولة عند غياب المستند | ✅ | وجود فحص `getDoc(bindingRef)` وإعادة استدعاء `saveUserBinding` مرة واحدة. |
| ترتيب التنفيذ قبل أي وصول لـ tenant | ✅ | استدعاء `saveUserBinding` بعد `setUser` وقبل أي استخدام لسياق الـ tenant. |
| **نقطة حرجة** | ⚠️ | استخدام `db` في AuthContext: مُستورد من firebase؛ إن كان `db` null قد يحدث خطأ. الكود الحالي لا يتحقق من `db` قبل `doc(db, ...)`. **توصية:** إضافة `if (!db) return;` أو التعامل مع عدم جاهزية Firebase قبل استدعاء `doc`/`getDoc`. |

---

## Phase 1: قواعد Firestore (عزل tenant)

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| تقييد `tenants/{tenantId}` و `tenants/{tenantId}/{document=**}` | ✅ | الشرط `getUserTenantId() == tenantId \|\| isOwner()` مطبّق. |
| Owner يصل لكل الـ tenants | ✅ | عبر `isOwner()` فقط. |
| **نقطة حرجة** | ⚠️ | `isOwner()` تعتمد على **Custom Claims** فقط (`request.auth.token.role == 'owner'`). إذا لم تُضبط الـ claims للمالك (مثلاً في Spark أو قبل تشغيل دالة ضبط الـ claims)، المالك **لن** يمر من القواعد ولن يصل لأي tenant. **توصية:** التأكد من ضبط custom claims للمالك بعد تسجيل الدخول، أو توثيق أن وضع "Blaze + claims" إلزامي لصلاحيات المالك في القواعد. |
| قاعدة rateLimits | ✅ | `allow read, write: if false` — الوصول من العميل معطّل؛ الاستخدام من الـ Functions فقط. |

---

## Phase 2 و 3: دوال الطلبات والعميل

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| requestConfirmCompletion / requestComplete / requestTransferToDepartment | ✅ | منفذة في `functions/src/requests/requestActions.ts` ومُصدَّرة. |
| التحقق من الهوية وربط المستخدم بالـ tenant | ✅ | `assertAuthAndTenant` + `assertUserCanAccessTenant(uid, tenantId)` باستخدام `userBindings`. |
| العميل يستدعي Callable بدل الكتابة المباشرة | ✅ | `confirmCompletion`, `completeRequest`, `transferRequestToDepartment` في requestService تستخدم `httpsCallable` فقط للكتابة الحرجة. |
| **نقطة حرجة** | ⚠️ | استخدام `context!` و `context!.auth!.uid` في requestActions. لو استُدعيت الدالة بدون سياق (غير متوقع من Firebase) سيحدث استثناء. **مقبول** لأن Firebase يزوّد السياق دائماً للـ callable. |
| إبقاء التوقيعات الخارجية | ✅ | توقيعات الدوال في requestService لم تتغير؛ لا كسر لـ useReceptionActions أو غيره. |
| كتابات أخرى (cancelRequest, assignRequest, …) | 📌 | لا تزال من العميل؛ الخطة لم تشترط نقلها. العزل مضمون عبر قواعد Firestore (نفس شرط tenant). |

---

## Phase 4 و 5: دوال المشتريات والعميل

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| procurementApprove / procurementClose | ✅ | منفذتان في `functions/src/procurement/procurementActions.ts` مع التحقق من tenant. |
| العميل يستدعي Callable للموافقة والإغلاق | ✅ | `approveProcurement` و `closeProcurement` يستدعيان الـ Callable فقط للكتابة. |
| **نقطة حرجة** | 📌 | `rejectProcurement` ما زال يكتب من العميل. الخطة طلبت فقط approve و close؛ العزل مضمون بالـ rules. إن رغبت في توحيد كامل، يمكن لاحقاً إضافة دالة `procurementReject` واستبدال الكتابة المباشرة. |

---

## Phase 6: Zod

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| مخططات الطلبات (confirm, complete, transfer) | ✅ | في `src/schemas/requestSchemas.ts` مع حدود طول وحقول مطلوبة. |
| مخططات المشتريات (approve, close) | ✅ | في `src/schemas/procurementSchemas.ts`. |
| استدعاء safeParse قبل الاستدعاء للـ Callable | ✅ | في requestService و procurementService قبل استدعاء الدوال. |
| **التحقق في الـ Functions** | 📌 | الخطة: "التحقق من البيانات بنفس القيود (Zod أو تحقق يدوي)". المنفذ: تحقق يدوي (الحقول المطلوبة فقط). **توصية:** لاحقاً إضافة Zod داخل الـ functions أو توسيع التحقق اليدوي (أطوال، تنسيق) ليتوافق مع الـ client. |
| استخدام `any` في الكود المضاف | ✅ | لم يُضف `any` في requestService/procurementService للدوال المعدّلة؛ تم استخدام `unknown` و type assertion محدودة للأخطاء. |

---

## Phase 7: حد معدل تسجيل الدخول (PIN)

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| استدعاء حد المعدل في بداية loginWithPin | ✅ | `checkRateLimit(identifier, 'login')` قبل أي استعلام globalCodes/managers. |
| إرجاع خطأ عند تجاوز الحد دون استعلامات | ✅ | عند `!rateResult.allowed` يُرجع `success: false` ورسالة مناسبة. |
| **معرّف الحد (identifier)** | ✅ | IP عند توفره، وإلا `pin_${pin.substring(0,4)}`. لا يُرسل للعميل؛ يُستخدم داخلياً في Firestore. |
| **نقطة حرجة** | ⚠️ | `checkRateLimit` يزيد العدد في **كل** استدعاء (ناجح أو فاشل). الخطة ذكرت "عند فشل التحقق من PIN: استدعاء دالة تحديث حد المعدل". المنفذ الحالي يحسب كل المحاولات. **تأثير:** بعد 5 محاولات (حتى ناجحة) من نفس المعرّف يُحظر. إن رغبت في عد المحاولات الفاشلة فقط، يلزم تعديل المنطق (زيادة العدد فقط عند إرجاع خطأ "كود الدخول غير صحيح"). |
| **Fail open في rateLimiter** | ⚠️ | عند حدوث خطأ في `checkRateLimit` يتم إرجاع `{ allowed: true }`. من منظور أمان صارم، "fail closed" (منع الدخول عند فشل الفحص) قد يكون أفضل. **توصية:** توثيق القرار أو تغيير السلوك إلى منع الدخول عند فشل الفحص. |

---

## Phase 8: توثيق القراءة العامة

| البند | الحالة | ملاحظة حدية |
|-------|--------|-------------|
| تعليقات على قواعد `allow read: if true` | ✅ | في firestore.rules (system, systemSettings, health_check, emergency_alerts, demoLinks). |
| جدول المسارات والغرض | ✅ | في `docs/schemas/FIRESTORE_SCHEMA.md`. |

---

## أمان عام

| البند | الحالة |
|-------|--------|
| أسرار أو API keys في الكود المضاف | ✅ لا يوجد. |
| كتابة حرجة من العميل للطلبات (confirm/complete/transfer) | ✅ عبر Callable فقط. |
| كتابة حرجة من العميل للمشتريات (approve/close) | ✅ عبر Callable فقط. |
| عزل tenant في القواعد | ✅ مع تحذير اعتماد Owner على Custom Claims. |

---

## خلاصة حدية

- **ما تم تنفيذه:** متوافق مع الخطة ومع الرولز من حيث العزل، نقل الكتابة الحرجة إلى الـ Functions، والتحقق من المدخلات في العميل.
- **تحذيرات يجب مراعاتها:**
  1. **Owner في القواعد:** يعتمد على Custom Claims؛ بدونها صلاحيات المالك في Firestore لن تعمل.
  2. **Phase 0:** إضافة حماية من `db == null` في AuthContext عند التحقق من userBinding.
  3. **Phase 7:** عد كل المحاولات وليس الفاشلة فقط؛ وسلوك "fail open" في rateLimiter — يُفضّل توثيقه أو تعديله.
- **تحسينات مقترحة (اختيارية):** إضافة Zod أو تحقق أطول في الـ Functions؛ نقل `rejectProcurement` إلى Callable لاحقاً؛ جعل حد المعدل يعتمد على المحاولات الفاشلة فقط إن لزم.

لا تنفيذ Phase 1 قبل ضمان userBinding (Phase 0)، ولا استدعاء دوال الطلبات/المشتريات من العميل قبل نشر الـ Functions — **تم الالتزام بذلك.**
