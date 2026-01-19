# 🌐 إعداد الدومين المخصص (Custom Domain) لـ Firebase Hosting

## المشكلة الحالية
الدومين `adora-hotels.com` غير مضاف في Firebase Hosting، لذلك الموقع لا يعمل على هذا الدومين.

## الحل: إضافة الدومين المخصص

### الخطوة 1: إضافة الدومين في Firebase Console

1. افتح [Firebase Console](https://console.firebase.google.com)
2. اختر مشروعك
3. اذهب إلى **Hosting** من القائمة الجانبية
4. اضغط على **Add custom domain** أو **إضافة دومين مخصص**
5. أدخل `adora-hotels.com`
6. اضغط **Continue**

### الخطوة 2: إضافة سجلات DNS

Firebase سيعطيك سجلات DNS التي تحتاج إضافتها في مزود الدومين:

#### مثال على السجلات المطلوبة:

**للدومين الرئيسي (adora-hotels.com):**
```
Type: A
Name: @
Value: (IP address من Firebase)
```

**للدومين الفرعي (www.adora-hotels.com):**
```
Type: CNAME
Name: www
Value: adora-hotels.com
```

أو قد يعطيك Firebase سجلات مثل:
```
Type: A
Name: @
Value: 151.101.1.195
Value: 151.101.65.195
```

### الخطوة 3: انتظار التحقق من SSL

بعد إضافة السجلات:
- Firebase سيتحقق تلقائياً من الدومين
- سيتم إصدار شهادة SSL تلقائياً (قد يستغرق بضع دقائق إلى ساعات)
- ستظهر حالة "Connected" عندما يكون كل شيء جاهزاً

### الخطوة 4: التحقق من النشر

بعد اكتمال الإعداد:
```bash
# تأكد من أن المشروع منشور
npm run build
firebase deploy --only hosting
```

## التحقق من الحالة الحالية

لتتحقق من حالة الدومين:
```bash
firebase hosting:sites:list
```

أو من Firebase Console:
- اذهب إلى **Hosting** → **Custom domains**
- ستجد قائمة بجميع الدومينات المضافة وحالتها

## ملاحظات مهمة

1. **DNS Propagation**: قد يستغرق انتشار DNS من 5 دقائق إلى 48 ساعة
2. **SSL Certificate**: Firebase يصدر شهادة SSL تلقائياً (Let's Encrypt)
3. **Multiple Domains**: يمكنك إضافة عدة دومينات لنفس المشروع
4. **Subdomains**: يمكنك إضافة دومينات فرعية مثل `www.adora-hotels.com`

## استكشاف الأخطاء

### إذا كان الدومين لا يعمل:

1. **تحقق من DNS:**
   ```bash
   # Windows
   nslookup adora-hotels.com
   
   # Linux/Mac
   dig adora-hotels.com
   ```

2. **تحقق من حالة SSL:**
   - اذهب إلى Firebase Console → Hosting → Custom domains
   - تحقق من حالة الشهادة

3. **تحقق من النشر:**
   ```bash
   firebase hosting:channel:list
   ```

4. **تحقق من السجلات:**
   - تأكد من أن سجلات DNS صحيحة في مزود الدومين
   - تأكد من أن TTL مناسب (300 ثانية أو أقل)

## إضافة الدومين برمجياً (اختياري)

يمكنك أيضاً إضافة الدومين من خلال Firebase CLI:

```bash
# إضافة دومين مخصص
firebase hosting:sites:create adora-hotels

# ربط الدومين بالمشروع
firebase hosting:channel:deploy production --only hosting
```

## الدعم

إذا استمرت المشكلة:
1. تحقق من [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting/custom-domain)
2. تحقق من حالة Firebase Status: https://status.firebase.google.com
3. راجع سجلات Firebase: `firebase hosting:channel:list`
