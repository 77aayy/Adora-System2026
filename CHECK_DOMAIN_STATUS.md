# 🔍 فحص حالة الدومين adora-hotels.com

## الحالة الحالية:
- ✅ الدومين موجود ويحل إلى IP: 199.36.158.100
- ❌ **غير مضاف في Firebase Hosting**
- ❌ لذلك الموقع لا يعمل على هذا الدومين

## الخطوات المطلوبة:

### 1. إضافة الدومين في Firebase Console:

1. افتح: https://console.firebase.google.com/project/adora-platform2026/hosting
2. اضغط على **"Add custom domain"** أو **"إضافة دومين مخصص"**
3. أدخل: `adora-hotels.com`
4. اضغط **Continue**

### 2. Firebase سيعطيك سجلات DNS - أضفها في مزود الدومين:

**مثال على السجلات المطلوبة:**
```
Type: A
Name: @
Value: (IP addresses من Firebase - عادة 2 IPs)
```

أو:
```
Type: CNAME
Name: @
Value: adora-platform2026.web.app
```

### 3. انتظر التحقق:
- DNS Propagation: 5 دقائق - 48 ساعة
- SSL Certificate: تلقائي من Firebase (Let's Encrypt)

### 4. بعد الإضافة:
```bash
# تأكد من أن الموقع منشور
firebase deploy --only hosting
```

## ملاحظة مهمة:
الدومين الحالي (199.36.158.100) **ليس Firebase**. بعد إضافة الدومين في Firebase، سيتم تغيير IP تلقائياً.

## البديل المؤقت:
يمكنك استخدام: https://adora-platform2026.web.app حتى يتم إعداد الدومين المخصص
