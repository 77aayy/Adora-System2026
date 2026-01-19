# 🔗 Cloud Functions URLs - Adora Platform

## ✅ Functions المُنشأة بنجاح

**المشروع:** adora-platform2026  
**المنطقة:** us-central1  
**التاريخ:** 2026-01-19

---

## 🚀 Room Operations Functions

### **1. `processCheckIn` (الموصى بها)**
```
https://us-central1-adora-platform2026.cloudfunctions.net/processCheckIn
```
**الوظيفة:** دالة موحدة للتسكين (3 خطوات في transaction واحدة)
- ✅ التحقق من هوية الموظف
- ✅ التحقق من حالة الغرفة
- ✅ تنفيذ التسكين

### **2. `checkRoomAvailability`**
```
https://us-central1-adora-platform2026.cloudfunctions.net/checkRoomAvailability
```
**الوظيفة:** التحقق من توفر الغرفة (دالة منفصلة)

### **3. `checkInGuest` (Legacy)**
```
https://us-central1-adora-platform2026.cloudfunctions.net/checkInGuest
```
**الوظيفة:** تسكين نزيل (Legacy - استخدم `processCheckIn` بدلاً منها)

### **4. `checkOutGuest`**
```
https://us-central1-adora-platform2026.cloudfunctions.net/checkOutGuest
```
**الوظيفة:** تسجيل خروج نزيل

---

## 📊 جميع Functions

### **Authentication:**
- `loginWithPin`: https://us-central1-adora-platform2026.cloudfunctions.net/loginWithPin
- `secureLogin`: https://us-central1-adora-platform2026.cloudfunctions.net/secureLogin

### **Security:**
- `secureApiCall`: https://us-central1-adora-platform2026.cloudfunctions.net/secureApiCall
- `resetUserRateLimit`: https://us-central1-adora-platform2026.cloudfunctions.net/resetUserRateLimit

### **User Management:**
- `setUserCustomClaims`: https://us-central1-adora-platform2026.cloudfunctions.net/setUserCustomClaims
- `getUserCustomClaims`: https://us-central1-adora-platform2026.cloudfunctions.net/getUserCustomClaims
- `revokeUserClaims`: https://us-central1-adora-platform2026.cloudfunctions.net/revokeUserClaims

### **System Settings:**
- `getSystemSettings`: https://us-central1-adora-platform2026.cloudfunctions.net/getSystemSettings
- `setSystemSettings`: https://us-central1-adora-platform2026.cloudfunctions.net/setSystemSettings

### **Admin:**
- `createManager`: https://us-central1-adora-platform2026.cloudfunctions.net/createManager
- `deployTenantFirebase`: https://us-central1-adora-platform2026.cloudfunctions.net/deployTenantFirebase
- `testTenantConnection`: https://us-central1-adora-platform2026.cloudfunctions.net/testTenantConnection

### **Demo:**
- `checkExpiredDemoAccounts`: https://us-central1-adora-platform2026.cloudfunctions.net/checkExpiredDemoAccounts
- `checkDemoAccountExpiry`: https://us-central1-adora-platform2026.cloudfunctions.net/checkDemoAccountExpiry

---

## 🔗 Project Console

```
https://console.firebase.google.com/project/adora-platform2026/overview
```

### **Functions Dashboard:**
```
https://console.firebase.google.com/project/adora-platform2026/functions
```

### **Functions Logs:**
```
https://console.firebase.google.com/project/adora-platform2026/functions/logs
```

---

## 📝 ملاحظات

1. **جميع Functions:** callable (https.onCall)
2. **المنطقة:** us-central1
3. **Memory:** 256MB (128MB لـ testTenantConnection)
4. **Runtime:** Node.js 20

---

**تاريخ الإنشاء:** 2026-01-19  
**الحالة:** ✅ جاهز للاستخدام
