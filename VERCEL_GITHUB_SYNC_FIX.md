# دليل إصلاح الربط بين Vercel و GitHub

## المشكلة:
Vercel لا يعمل deploy تلقائي عند Push على GitHub

---

## الحل (خطوة بخطوة):

### الطريقة 1: إعادة ربط Vercel بـ GitHub

1. **افتح Vercel Dashboard:**
   - https://vercel.com/adoras-projects-8ebc645b/adora-system2026/settings/git

2. **افحص Git Integration:**
   - ✅ **Repo مربوط:** `77aayy/Adora-System2026` ✅
   - ✅ **Auto-Deploy مفعّل تلقائياً** (ما فيش switch منفصل - لما تربط Git Repository، Auto-Deploy يشتغل تلقائياً)
   - ✅ **Branch:** `main` (Production)
   
   **⚠️ ملاحظة مهمة:**
   - Vercel **ما فيش فيه** إعداد اسمه "Automatic deployments from Git"
   - لما تربط Git Repository، Auto-Deploy بيشتغل **تلقائياً** من غير ما تحتاج تفعّل حاجة!

3. **إذا لم يكن مربوط:**
   - اضغط "Disconnect" (إذا موجود)
   - ثم اضغط "Connect Git Repository"
   - اختر `77aayy/Adora-System2026`

---

### الطريقة 2: Manual Deploy (حل مؤقت)

```bash
# في المشروع المحلي
npm install -g vercel
vercel --prod
```

**أو:**
- اذهب لـ Vercel Dashboard → Deployments
- اضغط "Redeploy" على آخر deployment
- اختار "Use existing Build Cache: No"

---

### الطريقة 3: التحقق من GitHub Webhooks

1. **افتح GitHub:**
   - https://github.com/77aayy/Adora-System2026/settings/hooks

2. **ابحث عن Vercel Webhook:**
   - يجب أن ترى webhook بعنوان: `https://api.vercel.com/v1/integrations/deploy/...`

3. **إذا لم يكن موجود:**
   - ارجع لـ Vercel
   - Settings → Git → اضغط "Reconnect"

---

## التحقق من Auto-Deploy (هل شغال ولا لأ؟):

### ✅ علامات Auto-Deploy يعمل:
1. **في Vercel Deployments:**
   - تشوف deployments **Source: "GitHub"** (مش "CLI")
   - كل push على `main` يعمل deployment جديد خلال 10-30 ثانية

2. **في GitHub:**
   - تشوف webhook من Vercel في: `Settings → Webhooks`
   - العنوان بيكون: `https://api.vercel.com/v1/integrations/deploy/...`

### ❌ علامات Auto-Deploy **معطّل**:
- كل deployments الـ Source بتاعها "CLI" (يعني manual فقط)
- ما فيش webhook من Vercel في GitHub

---

## 🔧 الحل - إعادة تفعيل Auto-Deploy:

### الخطوة 1: إعادة ربط Git Repository

1. **افتح:** https://vercel.com/adoras-projects-8ebc645b/adora-system2026/settings/git
2. **اضغط:** "Disconnect" (في قسم "Connected Git Repository")
3. **اضغط:** "Connect Git Repository"
4. **اختر:** `77aayy/Adora-System2026`
5. **اختر Branch:** `main`

### الخطوة 2: التحقق

```bash
# عمل commit تجريبي
git commit --allow-empty -m "test: Check Vercel auto-deploy"
git push origin main
```

**راقب Vercel Deployments:**
- يجب أن يبدأ build جديد **خلال 10-30 ثانية**
- الـ Source يجب أن يكون **"GitHub"** (مش "CLI")

---

## 📊 الحالة الحالية:

- ✅ **Git Repository مربوط:** `77aayy/Adora-System2026`
- ⚠️ **Auto-Deploy:** محتاج تحقق (شوف Deployments لو في deployments من GitHub)
- ✅ **Manual Deploy:** يعمل ✅ (`vercel --prod`)

---

## الفرق بين Firebase و Vercel:

| Feature | Firebase | Vercel |
|---------|----------|--------|
| Deploy | `firebase deploy --only hosting` | Auto-deploy من GitHub |
| Domain | adora-platform2026.web.app | adora-hotels.com (Custom) |
| Trigger | Manual (command) | Auto (على كل Push) |

---


## 🔧 إذا فشل كل شيء:

**استخدم Firebase فقط:**
1. احذف Domain من Vercel
2. اربط `adora-hotels.com` بـ Firebase
3. كل deploy سيكون manual: `firebase deploy`

**أو استخدم Vercel فقط:**
1. ألغي Firebase Hosting
2. استخدم Vercel لكل شيء
3. Deploy تلقائي من GitHub