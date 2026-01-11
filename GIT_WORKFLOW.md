# 🔀 دليل Git Workflow - سير عمل Git

> **للمبرمج المتوسط:** اتبع هذه القواعد لتجنب المشاكل

---

## 📋 القواعد الأساسية

### 1️⃣ هيكل الفروع (Branches)

```
main (production)
  │
  ├── develop (development)
  │     │
  │     ├── feature/xxx
  │     ├── fix/xxx
  │     └── hotfix/xxx
  │
  └── release/v1.x.x
```

| الفرع | الغرض | من يستخدمه |
|-------|-------|------------|
| `main` | الإنتاج | لا أحد مباشرة |
| `develop` | التطوير | الجميع (عبر PR) |
| `feature/*` | ميزة جديدة | المطور |
| `fix/*` | إصلاح خطأ | المطور |
| `hotfix/*` | إصلاح طارئ | كبير المطورين |

---

### 2️⃣ تسمية الفروع

```bash
# ✅ صحيح
feature/guest-dashboard-redesign
feature/add-room-transfer
fix/login-validation-error
fix/arabic-text-alignment
hotfix/security-patch-auth

# ❌ خطأ
new-feature
my-branch
test123
Ahmed-work
```

---

### 3️⃣ رسائل Commit

**الصيغة:**
```
<type>(<scope>): <subject>

<body>
```

**الأنواع:**
| Type | الوصف |
|------|-------|
| `feat` | ميزة جديدة |
| `fix` | إصلاح خطأ |
| `docs` | توثيق فقط |
| `style` | تنسيق (لا يؤثر على الكود) |
| `refactor` | إعادة هيكلة |
| `test` | إضافة اختبارات |
| `chore` | مهام صيانة |

**أمثلة:**
```bash
# ✅ صحيح
git commit -m "feat(guest): add numeric keypad for verification"
git commit -m "fix(auth): prevent non-numeric input in PIN field"
git commit -m "docs(readme): update installation steps"
git commit -m "refactor(rooms): extract shared components"

# ❌ خطأ
git commit -m "update"
git commit -m "fix bug"
git commit -m "changes"
git commit -m "WIP"
```

---

## 🚀 سير العمل اليومي

### بدء ميزة جديدة

```bash
# 1. تأكد أنك على develop
git checkout develop
git pull origin develop

# 2. أنشئ فرع جديد
git checkout -b feature/my-new-feature

# 3. اعمل التعديلات...

# 4. أضف وسجل
git add .
git commit -m "feat(scope): description"

# 5. ارفع الفرع
git push origin feature/my-new-feature

# 6. افتح Pull Request على GitHub/GitLab
```

### إصلاح خطأ

```bash
# 1. من develop
git checkout develop
git pull origin develop

# 2. أنشئ فرع الإصلاح
git checkout -b fix/bug-description

# 3. أصلح الخطأ...

# 4. سجل وارفع
git add .
git commit -m "fix(scope): description"
git push origin fix/bug-description

# 5. افتح Pull Request
```

### Hotfix طارئ (للإنتاج)

```bash
# ⚠️ فقط للأخطاء الحرجة في الإنتاج!

# 1. من main
git checkout main
git pull origin main

# 2. أنشئ فرع الإصلاح
git checkout -b hotfix/critical-bug

# 3. أصلح...

# 4. ارفع
git push origin hotfix/critical-bug

# 5. افتح PR إلى main و develop
```

---

## 📝 قواعد Pull Request

### العنوان
```
[TYPE] Brief description

مثال:
[FEAT] Add guest verification keypad
[FIX] Correct Arabic RTL input direction
[DOCS] Update API documentation
```

### الوصف
```markdown
## ما الذي تغير؟
- إضافة لوحة أرقام للتحقق من النزيل
- دعم RTL للإدخال بالعربية

## لماذا؟
لتحسين تجربة المستخدم للنزلاء العرب

## كيف تختبر؟
1. افتح صفحة النزيل
2. اختر "التحقق بالهوية"
3. أدخل 4 أرقام

## Screenshots
[إرفاق صور لو في تغييرات بصرية]

## Checklist
- [ ] اختبرت محلياً
- [ ] `npm run build` نجح
- [ ] لا أخطاء في Console
```

---

## ⚠️ ممنوعات

### ❌ لا تفعل أبداً:

```bash
# لا تدفع مباشرة لـ main
git push origin main  # ❌ ممنوع!

# لا تستخدم force push على فروع مشتركة
git push --force origin develop  # ❌ خطير!

# لا تضف secrets للكود
const apiKey = "AIzaSy..."  # ❌ كارثة!

# لا تسجل node_modules
git add node_modules/  # ❌ غير ضروري

# لا تسجل ملفات البناء
git add dist/  # ❌ تُبنى تلقائياً
```

---

## 🔧 أوامر مفيدة

### فحص الحالة
```bash
git status              # الملفات المعدلة
git log --oneline -10   # آخر 10 commits
git branch -a           # كل الفروع
```

### التراجع عن تغييرات
```bash
# تراجع عن ملف واحد (قبل add)
git checkout -- path/to/file

# تراجع عن كل التغييرات (قبل add)
git checkout -- .

# تراجع عن add
git reset HEAD path/to/file

# تراجع عن آخر commit (مع الاحتفاظ بالتغييرات)
git reset --soft HEAD~1
```

### حل Conflicts
```bash
# 1. اسحب آخر التغييرات
git pull origin develop

# 2. لو في conflicts، افتح الملفات وأصلحها

# 3. بعد الإصلاح
git add .
git commit -m "merge: resolve conflicts"
```

### تنظيف
```bash
# حذف فرع محلي
git branch -d feature/old-branch

# حذف فرع بعيد
git push origin --delete feature/old-branch

# تنظيف الفروع المحذوفة
git fetch --prune
```

---

## 📋 Checklist قبل كل PR

```
□ npm run build نجح
□ npm run lint بدون أخطاء
□ اختبرت يدوياً
□ لا secrets في الكود
□ رسالة Commit واضحة
□ وصف PR مكتمل
□ Screenshots (لو في UI)
```

---

## 🎯 ملخص سريع

```bash
# الروتين اليومي:
git checkout develop && git pull
git checkout -b feature/my-feature
# ... اعمل ...
git add . && git commit -m "feat(x): description"
git push origin feature/my-feature
# افتح PR
```

---

> **نصيحة:** لو مش متأكد، اسأل قبل ما تدفع!

