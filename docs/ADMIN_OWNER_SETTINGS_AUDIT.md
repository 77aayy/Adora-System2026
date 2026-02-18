# مراجعة إعدادات الأدمن/المالك وربطها بالأقسام وباقي المشروع

**الهدف:** التحقق من أن إعدادات الأدمن أو المالك مربوطة فعلياً بالأقسام وبالتسميع/الموافقة وباقي المشروع، وليست أزراراً يتيمة (بدون تأثير حقيقي).

---

## 1. إعدادات المالك (Owner / Super-Admin) — **مربوطة**

### 1.1 نظام الميزات (Feature Toggles)

| المصدر | المسار/التخزين | من يقرأها |
|--------|-----------------|-----------|
| **EnhancedOwnerDashboard** → تبويب الإعدادات (Settings) | `updateSystemSettings(updates)` → مستند **`system/settings`** (جذر) + localStorage `adora_system_settings` | **useFeatureGate** ← يستدعي **isFeatureEnabled** من **systemSettingsService** ← **getSystemSettings()** |

- عند تغيير الميزة (مثلاً إيقاف المشتريات أو النقاط): يتم استدعاء **handleToggleFeature** أو **handleSaveSettings** ثم **updateSystemSettings**، ويتم أيضاً إطلاق حدث **adora_feature_toggled** حتى تعيد المكونات التحقق عبر **useFeatureGate**.
- **النتيجة:** الميزات المعروضة في واجهة المالك (مثل pointsSystem, procurementSystem, laundryManagement, shiftNotes, scheduledTasks, whatsappIntegration, inventoryManagement, aiAssistant) **مربوطة** فعلياً: إيقافها يخفي الواجهات والمسارات المحمية (مثلاً ProcurementCart، PointsTracker، لوحة المشتريات، عناصر القائمة الجانبية في AdminSidebar).

### 1.2 القائمة الجانبية للأدمن (AdminSidebar)

- عناصر القائمة (المخزون، المشتريات، الغسيل، النقاط، المهام المجدولة، واتساب) تعتمد على **useFeatureGate** لنفس المفاتيح.
- **النتيجة:** إعدادات المالك تتحكم في ظهور هذه العناصر — **ليست أزراراً يتيمة**.

### 1.3 الأسعار والضريبة والخصم (الاشتراكات)

- **defaultSubscriptionPrice**, **defaultTaxRate**, **twoYearDiscountRate** تُحفظ عبر **handleSaveSettings** في نفس مستند system/settings وتُقرأ في شاشات إنشاء الاشتراك والفواتير (مثلاً في EnhancedOwnerDashboard عند إنشاء اشتراك).
- **النتيجة:** مربوطة بالحسابات والعروض المعروضة للمستخدم.

### 1.4 وضع الصيانة والرسائل العامة

- **maintenanceMode**, **maintenanceMessage** تُقرأ عبر **isMaintenanceMode()** ويمكن أن تُستخدم في واجهة الدخول أو التطبيق.
- **broadcastMessages** تُقرأ عبر **getActiveBroadcasts()** وتُعرض للمستأجرين حسب الدور/الترخيص.
- **النتيجة:** منطق النظام يستهلكها — ليست واجهة فقط.

---

## 2. إعدادات الأدمن (المدير) — ما هو مربوط وما هو ناقص

### 2.1 إعدادات النقاط (Points Configuration) — **مربوطة**

| المصدر | المسار | من يقرأها |
|--------|--------|-----------|
| **PointsConfiguration** (من AdminDashboard → الإعدادات) | **`tenants/${tenantId}/settings/pointsConfig`** | **pointsService.getPointsConfig(tenantId, branchId)** |

- **getPointsConfig** يُستدعى من: **requestService** (إنشاء طلب، إكمال طلب، مكافآت)، **shiftNotesService**، **CoffeeShopDashboard**، **UniversalActionCard**، **DailyOperationsInsight**.
- **النتيجة:** إعدادات النقاط للأقسام (بيلمان، نظافة، صيانة، قهوة، مشتريات، استقبال، التقييمات، المالية) **تسمع** في باقي المشروع وتُستخدم في حساب النقاط والمكافآت.

### 2.2 إعدادات النقل التلقائي (Auto-Transfer) — **مربوطة**

| المصدر | المسار | من يقرأها |
|--------|--------|-----------|
| **AutoTransferSettings** (من الإعدادات) | **autoTransferService.loadAutoTransferConfig(branchId, tenantId)** / **saveAutoTransferConfig** (مجموعة tenant-scoped في Firestore) | **requestService.createRequest** ← يستدعي **checkImmediateTransferForDisabledDepartment** |

- عند إنشاء طلب جديد يتم التحقق من قواعد النقل التلقائي ونقل الطلب فوراً إذا كان القسم الهدف معطّلاً وكانت هناك قاعدة مطابقة.
- **النتيجة:** إعدادات النقل التلقائي **مربوطة** بسلوك إنشاء الطلبات ونقلها بين الأقسام.

### 2.3 تسميع المشتريات (موافقة المدير) — **مربوطة**

| المصدر | المسار | من يقرأها |
|--------|--------|-----------|
| **ProcurementApprovalsPanel** (في لوحة الأدمن) | **subscribeToPendingApprovals(tenantId, branchId)** على **`tenants/${tenantId}/procurementRequests`** | نفس المجموعة يُحدّثها **approveProcurement** / **rejectProcurement** |

- المدير يوافق أو يرفض من اللوحة؛ **approveProcurement** و **rejectProcurement** يحدّثان المستند في **tenants/${tenantId}/procurementRequests** ويرسلان إشعارات/سجلات.
- **النتيجة:** أزرار الموافقة/الرفض **ليست يتيمة** — التسميع يحدث فعلياً ويُرى في داشبورد المشتريات وفي سير العمل.

### 2.4 إعدادات الفرع (Branch Settings) في SettingsManager — **جزئياً مربوطة**

- **laundry_prices** / **laundry_config**: **laundryInventoryService** يقرأ ويكتب من/إلى **tenants/${tenantId}/branches/${branchId}/settings/laundry_prices** و **laundry_config** — **مربوطة**.
- **location** / **qr**: **locationService** يقرأ/يكتب **tenants/.../branches/.../settings/location** و **qr** — **مربوطة**.
- **system**, **workingHours**, **reception**, **services**, **contact**, **products**: المسارات موجودة في SettingsManager؛ بعض الخدمات (مثل **branchService** الذي يذكر workingHours، و**receptionAdvancedFeatures** الذي يقرأ **points** من مسار الفرع) قد تستهلك جزءاً منها. مراجعة كل مستهلك لكل مفتاح لم تُنفَّذ بالكامل — يُوصى بالتحقق من أي إعداد جديد أن هناك خدمة أو مكوّن يقرأه.

### 2.5 تعطيل الأقسام (Department Disabled) — **منطق بدون واجهة مدير**

- **autoTransferService.checkImmediateTransferForDisabledDepartment** يحدد ما إذا كان القسم الهدف "معطّلاً" عبر **tenantCustomizationService.isFeatureEnabledForTenant(tenantId, featureName)**.
- **isFeatureEnabledForTenant** يقرأ **tenants/${tenantId}/settings/branding** ويطبّق **enabledFeatures** / **disabledFeatures** (مثلاً `housekeeping`, `maintenance`, `bellman`, `coffeeshop`, `procurement`).
- **لا توجد واجهة أدمن/مدير** تستدعي **saveTenantBranding** أو تكتب إلى **tenants/.../settings/branding** بقيم **disabledFeatures** أو **enabledFeatures** للأقسام.
- **النتيجة:** منطق "القسم معطّل → نقل تلقائي" **مربوط** بخدمات النقل والطلبات، لكن **لا يوجد زر أو شاشة في الأدمن/المالك لتعطيل قسم معيّن**؛ التعديل يكون يدوياً على Firestore (مستند branding) أو عبر كود. من ناحية الواجهة يمكن اعتبار هذا **إعداد يتيم**: المنطق موجود لكن واجهة الإعداد غير مكتملة.

---

## 3. ملخص الحالة

| البند | الحالة | ملاحظة |
|-------|--------|--------|
| ميزات المالك (Feature Toggles) | ✅ مربوطة | useFeatureGate يقرأ من getSystemSettings؛ القائمة والمسارات والمكونات تستجيب |
| إعدادات النقاط (Points) | ✅ مربوطة | pointsConfig يُقرأ في requestService وغيره ويُستخدم في التسميع والمكافآت |
| النقل التلقائي (Auto-Transfer) | ✅ مربوطة | قواعد النقل تُحمّل وتُطبّق عند إنشاء الطلب |
| تسميع المشتريات (موافقة المدير) | ✅ مربوطة | لوحة الموافقات تشترك في نفس المجموعة وتستدعي approve/reject |
| إعدادات الفرع (غسيل، موقع، QR) | ✅ مربوطة | الخدمات تقرأ/تكتب نفس المسارات التي يعدّلها SettingsManager |
| تعطيل الأقسام (Branding) | ⚠️ منطق بدون واجهة | isFeatureEnabledForTenant يقرأ من branding؛ لا واجهة أدمن لتعيين disabledFeatures/enabledFeatures |

---

## 4. توصيات

1. **تعطيل الأقسام:** إضافة شاشة أو قسم في إعدادات الأدمن/الفرع (أو في Tenant/Branding إن وُجدت) لتمكين/تعطيل الأقسام (نظافة، صيانة، بيلمان، قهوة، مشتريات) وحفظها في **tenants/${tenantId}/settings/branding** (enabledFeatures/disabledFeatures) حتى تصبح الإعدادات **مربوطة** من الواجهة حتى سلوك النقل التلقائي.
2. **إعدادات الفرع الأخرى:** عند إضافة حقول جديدة في SettingsManager (مثل workingHours، reception، services)، التأكد من وجود مستهلك واضح (خدمة أو مكوّن) يقرأ نفس المسار حتى لا تبقى إعدادات يتيمة.
3. **الاحتفاظ بالسلوك الحالي:** بقية الإعدادات المراجعة (ميزات المالك، النقاط، النقل التلقائي، تسميع المشتريات، غسيل/موقع/QR) **ليست أزراراً يتيمة** وهي مربوطة بالأقسام أو بالتسميع أو بباقي المشروع حسب ما تم تتبعه أعلاه.

تمت المراجعة وفق تتبع المسارات والاستدعاءات في الكود دون افتراض.
