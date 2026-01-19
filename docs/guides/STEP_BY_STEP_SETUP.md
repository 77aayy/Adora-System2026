# 📋 خطوات تفصيلية: فتح المشروع على لابتوب جديد

## ✅ الخطوة 1: فتح Cursor

1. افتح برنامج **Cursor** على اللابتوب الجديد
2. سجل الدخول بحسابك (إذا طُلب منك)

---

## ✅ الخطوة 2: Clone المشروع من GitHub

### الطريقة الأولى: من Terminal في Cursor

1. في Cursor، اضغط على:
   - **Terminal** من القائمة العلوية، أو
   - **Ctrl + `** (Ctrl + Backtick) لفتح Terminal

2. اكتب الأوامر التالية واحدة تلو الأخرى:

```bash
cd Desktop
```

```bash
git clone https://github.com/77aayy/Adora-System2026.git
```

```bash
cd Adora-System2026
```

### الطريقة الثانية: من واجهة Cursor

1. في Cursor، اضغط على:
   - **File** → **Open Folder** (أو **Ctrl + K, Ctrl + O**)

2. اختر مكان لحفظ المشروع (مثلاً Desktop)

3. ثم افتح Terminal واكتب:
```bash
git clone https://github.com/77aayy/Adora-System2026.git
```

---

## ✅ الخطوة 3: فتح المشروع في Cursor

1. في Cursor، اضغط:
   - **File** → **Open Folder** (أو **Ctrl + K, Ctrl + O**)

2. اذهب إلى:
   ```
   Desktop\Adora-System2026
   ```

3. اضغط **Select Folder**

---

## ✅ الخطوة 4: فتح Terminal في Cursor

1. في Cursor، اضغط:
   - **Terminal** من القائمة العلوية، أو
   - **Ctrl + `** (Ctrl + Backtick)

---

## ✅ الخطوة 5: تثبيت المكتبات

في Terminal، اكتب:

```bash
npm install
```

**انتظر حتى ينتهي** (قد يستغرق دقائق قليلة)

---

## ✅ الخطوة 6: تشغيل المشروع

في نفس Terminal، اكتب:

```bash
npm run dev
```

---

## ✅ الخطوة 7: فتح المتصفح

بعد أن يظهر في Terminal:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

1. افتح المتصفح (Chrome/Firefox/Edge)
2. اذهب إلى: `http://localhost:5173`
3. يجب أن تفتح صفحة Login

---

## ⚠️ ملاحظات مهمة

### إذا ظهر خطأ "git: command not found"

يعني Git غير مثبت. حمّل من:
https://git-scm.com/downloads

### إذا ظهر خطأ "npm: command not found"

يعني Node.js غير مثبت. حمّل من:
https://nodejs.org/ (اختر LTS version)

### إذا ظهر خطأ في npm install

جرب:
```bash
npm install --legacy-peer-deps
```

---

## ✅ تحقق من النجاح

- ✅ Terminal يعرض: `VITE ready`
- ✅ المتصفح يفتح على `http://localhost:5173`
- ✅ صفحة Login تظهر بشكل طبيعي
- ✅ لا توجد أخطاء حمراء في Terminal

---

**آخر تحديث**: يناير 2026