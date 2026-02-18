# 🔥 دليل ربط `adora-hotels.com` بـ Firebase Hosting

## 📋 الخطوات الكاملة:

---

## الخطوة 1: حذف الدومين من Vercel

### 1.1: افتح Vercel Domains Settings
- https://vercel.com/adoras-projects-8ebc645b/adora-system2026/settings/domains

### 1.2: حذف `adora-hotels.com`
1. ابحث عن `adora-hotels.com` في القائمة
2. اضغط على الثلاث نقاط (⋯) بجانب الدومين
3. اضغط **"Remove"** أو **"Delete"**
4. أكد الحذف

**⚠️ ملاحظة:** ممكن يحتاج 5-10 دقائق عشان الـ DNS records تُزال.

---

## الخطوة 2: إضافة الدومين إلى Firebase

### 2.1: افتح Firebase Hosting Console
- https://console.firebase.google.com/project/adora-platform2026/hosting/sites/adora-platform2026

### 2.2: أضف Custom Domain
1. اضغط **"Add custom domain"** (أو "Add another domain")
2. اكتب: `adora-hotels.com`
3. اضغط **"Continue"**

### 2.3: اختار Type of domain setup
- **الأفضل:** اختر **"Use a domain name provider"** (لو الدومين في GoDaddy, Namecheap, إلخ)
- أو **"Use Firebase Hosting"** (لو الدومين في Firebase)

---

## الخطوة 3: إضافة DNS Records

Firebase هيعطيك DNS records محتاج تضيفها في الـ Domain Registrar:

### مثال على الـ Records:

#### A Records (للـ root domain):
```
Type: A
Name: @
Value: 151.101.1.195
TTL: 3600
```

#### A Record (بديل):
```
Type: A
Name: @
Value: 151.101.65.195
TTL: 3600
```

#### CNAME (للـ www):
```
Type: CNAME
Name: www
Value: adora-platform2026.web.app
TTL: 3600
```

### 3.1: اذهب لـ Domain Registrar
- GoDaddy: https://www.godaddy.com → My Products → DNS
- Namecheap: https://www.namecheap.com → Domain List → Manage → Advanced DNS
- أو أي provider آخر

### 3.2: أضف الـ Records
1. احذف أي A records أو CNAME موجودة لـ `adora-hotels.com`
2. أضف الـ A records اللي Firebase أعطاها لك
3. احفظ التغييرات

### 3.3: الانتظار
- ⏳ **DNS Propagation:** 5 دقائق - 48 ساعة (عادة 10-30 دقيقة)
- ✅ Firebase هيبعتلك email لما الدومين يتفعّل

---

## الخطوة 4: Deploy على Firebase

### 4.1: Build المشروع
```bash
npm run build
```

### 4.2: Deploy على Firebase
```bash
firebase deploy --only hosting
```

### 4.3: التحقق
- افتح: `https://adora-hotels.com`
- تأكد إن الموقع شغال ✅

---

## ⚙️ الإعدادات المتقدمة (اختياري):

### Redirect www إلى root:
في `firebase.json`:
```json
{
  "hosting": {
    "redirects": [
      {
        "source": "/www/:path*",
        "destination": "/:path*",
        "type": 301
      }
    ]
  }
}
```

### SSL Certificate:
- Firebase **هيضيف SSL تلقائياً** بعد تفعيل الدومين
- الانتظار: 10 دقائق - 24 ساعة (عادة 1-2 ساعة)

---

## ✅ التحقق النهائي:

### ✅ Checklist:
- [ ] الدومين محذوف من Vercel
- [ ] الدومين مضاف على Firebase
- [ ] DNS Records مضافين في الـ Registrar
- [ ] Firebase Hosting متفعّل للدومين (Status: Connected)
- [ ] Deploy تم بنجاح: `firebase deploy --only hosting`
- [ ] الموقع شغال: `https://adora-hotels.com`

---

## 🔧 Troubleshooting:

### ❌ المشكلة: "Domain verification failed"
**الحل:**
- تأكد أن DNS records صح
- انتظر 30-60 دقيقة للـ propagation
- افحص DNS: https://dnschecker.org/

### ❌ المشكلة: "SSL certificate pending"
**الحل:**
- الانتظار 1-24 ساعة
- Firebase هيضيف SSL تلقائياً
- لو مر أكثر من 24 ساعة: اضغط "Retry certificate"

### ❌ المشكلة: "Site not found"
**الحل:**
- تأكد إنك عملت deploy: `firebase deploy --only hosting`
- افحص الـ site ID في `firebase.json`

---

## 📝 Workflow المستقبلي:

**كل ما تعمل تعديلات:**
```bash
# 1. عدل الكود
# 2. Build
npm run build

# 3. Deploy على Firebase
firebase deploy --only hosting

# 4. الموقع يحدث خلال 1-2 دقيقة! 🚀
```

**مش محتاج GitHub push للـ deployment!** (لكن محتاجه للحفظ في repo)

---

## 🎯 الفرق بين Firebase و Vercel:

| الميزة | Firebase | Vercel |
|--------|----------|--------|
| **Auto-Deploy من GitHub** | ❌ Manual فقط | ✅ تلقائي |
| **Deploy Command** | `firebase deploy` | `git push` (auto) أو `vercel --prod` |
| **Build Time** | ~30-60 ثانية | ~10-30 ثانية |
| **Control** | ✅ كامل | ⚠️ محدود |
| **Firebase Integration** | ✅ متكامل | ❌ منفصل |

---

## 💡 نصيحة:

**لو عايز تستخدم Firebase + GitHub auto-deploy:**
- استخدم **GitHub Actions** لعمل deploy تلقائي على Firebase عند كل push!

**أمثلة:**
- `.github/workflows/deploy.yml`

---

## 📞 للمساعدة:

- Firebase Docs: https://firebase.google.com/docs/hosting/custom-domain
- Firebase Console: https://console.firebase.google.com/project/adora-platform2026/hosting
