# إصلاح صلاحيات Service Account للـ Cloud Functions

## المشكلة:
```
Error: Missing permissions required for functions deploy. 
You must have permission iam.serviceAccounts.ActAs on service account 
adora-platform2026@appspot.gserviceaccount.com.
```

## الحل:
يجب إضافة دور **"Service Account User"** للـ Service Account المستخدم في GitHub Actions.

## الخطوات:

### الطريقة الأولى: من Google Cloud Console (الأسهل)

1. افتح: https://console.cloud.google.com/iam-admin/iam?project=adora-platform2026

2. ابحث عن: `firebase-adminsdk-fbsvc@adora-platform2026.iam.gserviceaccount.com`

3. اضغط على أيقونة القلم (Edit)

4. اضغط **"+ ADD ANOTHER ROLE"**

5. اختر: **`Service Account User`**

6. اضغط **"SAVE"**

### الطريقة الثانية: من Command Line

```bash
# استخدام gcloud CLI
gcloud projects add-iam-policy-binding adora-platform2026 \
    --member="serviceAccount:firebase-adminsdk-fbsvc@adora-platform2026.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
```

---

## بعد إضافة الصلاحية:
- انتظر 1-2 دقيقة
- الـ workflow سيعمل تلقائياً في المرة القادمة
- أو يمكنك re-run الـ workflow من GitHub Actions

---

## ملاحظة:
هذا الدور ضروري لأن Cloud Functions تحتاج استخدام App Engine default service account عند الـ deploy.
