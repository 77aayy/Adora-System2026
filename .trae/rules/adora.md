rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // =========================================================
    // 🛠️ 1. Helper Functions (عدة الشغل)
    // =========================================================
    
    // هل المستخدم مسجل دخول أصلاً؟
    function isAuthenticated() {
      return request.auth != null;
    }

    // هل المستخدم هو صاحب الـ Document ده؟
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // هل المستخدم معاه صلاحية "Admin"؟ (عن طريق Custom Claims)
    // دي أنضف طريقة عشان ما تدفعش فلوس قراءة زيادة في الداتا بيز
    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    // هل الداتا اللي جاية سليمة؟ (مثال: لازم يكون فيها created_at)
    function isValidNewDoc() {
      return request.resource.data.keys().hasAll(['createdAt', 'updatedAt']);
    }

    // ممنوع تعديل حقول معينة (زي تاريخ الإنشاء أو الـ ID)
    function isNotModifying(field) {
      return !(field in request.resource.data) || 
             resource.data[field] == request.resource.data[field];
    }

    // =========================================================
    // 📂 2. Collection Rules (توزيع الصلاحيات)
    // =========================================================

    // 👤 A. ملفات المستخدمين (Users Profiles)
    // القاعدة: أنا بس اللي أشوف وأعدل بروفيلي، الأدمن يشوف الكل.
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId); // يسمح بإنشاء بروفايله عند التسجيل
      allow update: if isOwner(userId) && isNotModifying('createdAt');
      allow delete: if false; // ممنوع الحذف إلا من الكونسول أو Admin SDK
    }

    // 📢 B. داتا عامة (Public Content)
    // زي: المنتجات، المقالات، الأخبار.
    // القاعدة: الكل يقرأ، الأدمن بس يكتب.
    match /products/{productId} {
      allow read: if true; // مفتوح للكل (حتى اللي مش مسجل)
      allow write: if isAdmin();
    }

    // 🏢 C. داتا خاصة بالشركات/المشاريع (Tenant/Project Data)
    // زي: الفواتير، الطلبات، المشاريع الخاصة.
    // القاعدة: لازم تكون عضو في المشروع عشان تقرأ.
    match /projects/{projectId} {
      // هنا بنفترض إن الـ document فيه array اسمها members فيها الـ UIDs
      allow read: if isAuthenticated() && (request.auth.uid in resource.data.members || isAdmin());
      allow create: if isAuthenticated() && isValidNewDoc();
      allow update: if isAuthenticated() && (request.auth.uid in resource.data.members) && isNotModifying('createdAt');
    }

    // 📝 D. سجلات (Logs/Audit)
    // القاعدة: اكتب وارمي، بس إياك تعدل أو تمسح.
    match /audit_logs/{logId} {
      allow create: if isAuthenticated(); // أي حد يسجل أكشن عمله
      allow read, update, delete: if false; // ممنوع حد يلعب في السجلات
    }

    // =========================================================
    // ⛔ 3. Default Safety Net (شبكة الأمان)
    // =========================================================
    
    // أي Collection إحنا نسينا نعرفه فوق.. يتقفل أوتوماتيك
    match /{document=**} {
      allow read, write: if false;
    }
  }
}