# 🌐 DNS Records الصحيحة لـ Vercel - `adora-hotels.com`

## 📋 البيانات المطلوبة (بالظبط):

### ✅ **الطريقة 1: A Records (للـ Root Domain)**

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600 (أو Automatic)
```

### ✅ **الطريقة 2: CNAME (الأسهل والأفضل)**

```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600 (أو Automatic)
```

---

## 🎯 **أيهما أفضل؟**

### **CNAME أسهل:**
- ✅ سجل واحد فقط
- ✅ Vercel يدير كل شيء تلقائياً
- ✅ لو Vercel غير IPs، ما تحتاج تعدل حاجة

### **A Records:**
- ⚠️ سجل واحد لكن ممكن Vercel يغير الـ IPs
- ⚠️ محتاج تحديث يدوي لو تغير

---

## 📝 **كيفية الإضافة في Domain Registrar:**

### **مثال: GoDaddy**

1. اذهب: https://www.godaddy.com → My Products → DNS
2. ابحث عن `adora-hotels.com`
3. احذف أي A records قديمة للـ `@`
4. أضف:

**CNAME (موصى به):**
```
Type: CNAME
Name: @
Host: @
Points to: cname.vercel-dns.com
TTL: 1 Hour
```

**أو A Record:**
```
Type: A
Name: @
Host: @
Points to: 76.76.21.21
TTL: 1 Hour
```

---

## ⚠️ **ملاحظات مهمة:**

1. **بعض مقدمي DNS ما يدعموش CNAME على Root (@):**
   - لو كده: استخدم A Records
   - أو استخدم www subdomain: `www.adora-hotels.com` → CNAME

2. **لو عندك www subdomain:**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

3. **TTL:**
   - استخدم 3600 (1 ساعة) أو Automatic
   - أقل TTL = تحديث أسرع لكن استعلامات أكثر

---

## ✅ **بعد إضافة الـ DNS Records:**

1. **انتظر 5-60 دقيقة** للـ DNS propagation
2. **اذهب لـ Vercel:**
   - https://vercel.com/adoras-projects-8ebc645b/adora-system2026/settings/domains
   - اضغط "Add Domain"
   - اكتب: `adora-hotels.com`
   - اضغط "Add"

3. **Vercel هيتحقق تلقائياً:**
   - Status: "Valid Configuration" = ✅ جاهز!
   - Status: "Pending" = ⏳ انتظر 5-60 دقيقة

---

## 🔍 **التحقق من DNS:**

بعد إضافة الـ Records، تحقق:

```bash
# Windows
nslookup adora-hotels.com

# Linux/Mac
dig adora-hotels.com
```

**المفروض يطلع:**
- A Record → `76.76.21.21`
- أو CNAME → `cname.vercel-dns.com`

---

## 📊 **ملخص سريع:**

```
✅ CNAME (الأفضل):
   Name: @
   Value: cname.vercel-dns.com

✅ A Record (إذا CNAME مش مدعوم):
   Name: @
   Value: 76.76.21.21
```

---

## 🎯 **بعد الإعداد:**

1. **Deploy على Vercel:**
   ```bash
   git push origin main  # Auto-deploy
   # أو
   vercel --prod  # Manual deploy
   ```

2. **افتح الموقع:**
   - https://adora-hotels.com

3. **تحقق من SSL:**
   - Vercel بيضيف SSL تلقائياً
   - الانتظار: 5-30 دقيقة
