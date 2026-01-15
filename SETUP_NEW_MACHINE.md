# 🖥️ كيفية فتح المشروع على جهاز جديد

## الخطوات السريعة (5 دقائق)

### 1️⃣ Clone المشروع من GitHub

```bash
# افتح Terminal أو PowerShell
cd Desktop
git clone https://github.com/77aayy/Adora-System2026.git
cd Adora-System2026
```

### 2️⃣ تثبيت المكتبات

```bash
npm install
```

### 3️⃣ إعداد Environment Variables (إن وجدت)

```bash
# انسخ ملف .env.example إلى .env (إن وجد)
copy env.example.txt .env
# أو في Linux/Mac:
# cp env.example.txt .env

# ثم افتح .env وعدل المتغيرات المطلوبة
```

### 4️⃣ تشغيل المشروع

```bash
npm run dev
```

---

## ✅ تحقق من نجاح التثبيت

- ✅ المشروع يفتح على `http://localhost:5173`
- ✅ لا توجد أخطاء في Terminal
- ✅ صفحة Login تفتح بشكل طبيعي

---

## 📝 ملاحظات مهمة

### إذا كان المشروع موجود مسبقاً

إذا كان المشروع موجود على اللابتوب الثاني، فقط:

```bash
cd "C:\Users\YOUR_USERNAME\Desktop\Ayman final Adora - Copy"
git pull origin main
npm install  # للتأكد من تحديث المكتبات
npm run dev
```

### المشاكل الشائعة

#### 1. خطأ في Node Version
```bash
# تحقق من نسخة Node (يجب 18 أو أحدث)
node --version

# إذا لم تكن 18+, حمل Node.js من nodejs.org
```

#### 2. خطأ في npm
```bash
# حدّث npm
npm install -g npm@latest
```

#### 3. مشاكل في Firebase
- تأكد من وجود `firebase.json`
- تأكد من إعدادات Firebase في المشروع

---

## 🔗 روابط مفيدة

- **GitHub Repository**: https://github.com/77aayy/Adora-System2026
- **Node.js Download**: https://nodejs.org/
- **Git Download**: https://git-scm.com/downloads

---

## ⚡ اختصار سريع (Copy & Paste)

```bash
cd Desktop && git clone https://github.com/77aayy/Adora-System2026.git && cd Adora-System2026 && npm install && npm run dev
```

---

**آخر تحديث**: يناير 2026