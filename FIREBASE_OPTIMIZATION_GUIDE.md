# 🔥 دليل تحسين استهلاك Firebase - Adora

## 📊 حدود Free Tier (Spark Plan)

| الخدمة | الحد المجاني | هدفنا (20%) |
|--------|-------------|-------------|
| Firestore Reads | 50,000/يوم | 10,000/يوم |
| Firestore Writes | 20,000/يوم | 4,000/يوم |
| Firestore Deletes | 20,000/يوم | 4,000/يوم |
| Storage | 5 GB | 1 GB |
| Bandwidth | 1 GB/يوم | 200 MB/يوم |

---

## 🎯 استراتيجيات التوفير

### 1️⃣ التخزين المؤقت الذكي (Smart Caching)

```typescript
import { useOptimizedDoc } from '@/hooks/useOptimizedFirestore';

// ❌ قبل - كل mount بيقرأ من Firebase
const { data } = useDoc('settings/general');

// ✅ بعد - يقرأ من الكاش أولاً
const { data } = useOptimizedDoc('settings/general', {
    ttl: 24 * 60 * 60 * 1000 // 24 ساعة
});
```

**أوقات الكاش المقترحة:**

| نوع البيانات | TTL | السبب |
|-------------|-----|-------|
| الإعدادات | 24 ساعة | نادراً تتغير |
| الأقسام/الحالات | 24 ساعة | نادراً تتغير |
| الموظفين | 1 ساعة | تغييرات قليلة |
| نقاط الموظف | 12 ساعة | تتغير مع كل مهمة |
| الغرف | 5 دقائق | تتغير باستمرار |
| الطلبات | 30 ثانية | محتاج بيانات فريش |

---

### 2️⃣ تجميع الكتابات (Batch Writes)

```typescript
import { queueWrite, flushWrites } from '@/services/firebaseOptimizationService';

// ❌ قبل - 10 writes منفصلة
await updateDoc(ref1, data1);
await updateDoc(ref2, data2);
// ... 10 عمليات = 10 writes

// ✅ بعد - كلهم في batch واحد
queueWrite('path/doc1', data1, 'update');
queueWrite('path/doc2', data2, 'update');
// ... السيستم يجمعهم ويبعتهم مرة واحدة = 1 write operation
```

**كيف يعمل:**
1. الكتابات تتجمع لمدة 2 ثانية
2. بعد 2 ثانية أو وصول 500 عملية، يتم إرسالهم كـ batch
3. قبل إغلاق الصفحة، `flushWrites()` يُرسل أي عمليات معلقة

---

### 3️⃣ المستمعين الأذكياء (Smart Listeners)

```typescript
// ❌ قبل - listener جديد كل mount
useEffect(() => {
    const unsub = onSnapshot(query(...), (snap) => {...});
    return () => unsub();
}, []);

// ✅ بعد - listener واحد مع deduplication
const { data } = useOptimizedRealtime('requests-listener', 
    `tenants/${tenantId}/requests`,
    {
        constraints: [where('status', '==', 'pending')],
        debounceMs: 100 // يجمع التحديثات
    }
);
```

**فوائد:**
- لو المكون re-mount، يستخدم نفس الـ listener
- Debouncing يقلل عدد الـ callbacks
- Deduplication يمنع إرسال نفس البيانات مرتين

---

### 4️⃣ هيكلة البيانات الذكية (Data Structure)

#### أ) Denormalization (نسخ البيانات)

```javascript
// ❌ قبل - 3 queries
const room = await getDoc('rooms/101');
const guest = await getDoc(`guests/${room.guestId}`);
const requests = await getDocs(query(requestsRef, where('roomId', '==', '101')));

// ✅ بعد - query واحد
// في document الغرفة:
{
    roomNumber: '101',
    guestName: 'أحمد محمد',      // منسوخ من guest
    guestPhone: '05xxxxxxxx',    // منسوخ من guest
    activeRequestsCount: 2,       // counter بدل query
    lastCleaningTime: Timestamp   // معلومة مهمة منسوخة
}
```

#### ب) Aggregation (التجميع)

```javascript
// ❌ قبل - 100 document لنقاط 100 موظف
employees/emp1/points/2024-01-01
employees/emp1/points/2024-01-02
// ... 100 موظف × 30 يوم = 3000 document

// ✅ بعد - document واحد مجمّع
daily_stats/2024-01-01 {
    employees: {
        emp1: { points: 45, tasks: 12 },
        emp2: { points: 32, tasks: 8 },
        // ...
    },
    totals: { points: 1250, tasks: 340 }
}
```

---

### 5️⃣ أرشفة البيانات القديمة

```typescript
import { archiveOldData } from '@/services/firebaseOptimizationService';

// أرشفة الطلبات الأقدم من 30 يوم
await archiveOldData(tenantId, 'requests', 30);

// البيانات تتنقل من:
// tenants/{id}/requests/{reqId}
// إلى:
// tenants/{id}/archive/requests_{reqId}
```

**فوائد:**
- تقليل حجم الـ queries (أقل documents للفحص)
- تنظيم أفضل
- ممكن نقلها لـ Cloud Storage (أرخص)

---

### 6️⃣ تحسين الصور (Image Optimization)

```typescript
// ❌ قبل
// صورة 5MB ترفع كما هي

// ✅ بعد
import { compressImage, uploadToFirebaseStorage } from '@/services/imageUploadService';

const compressed = await compressImage(base64, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.7,
    format: 'webp'  // أصغر 30% من JPEG
});
// النتيجة: 300KB بدل 5MB
```

---

### 7️⃣ تقليل Real-time Listeners

```typescript
// ❌ قبل - listener لكل غرفة
rooms.forEach(room => {
    onSnapshot(doc(db, `rooms/${room.id}`), ...);
}); // 50 غرفة = 50 listener

// ✅ بعد - listener واحد للكل
onSnapshot(
    query(roomsRef, where('floor', '==', selectedFloor)),
    (snapshot) => {
        // كل الغرف في callback واحد
    }
);
```

---

## 📈 مراقبة الاستهلاك

```typescript
import { useFirebaseUsage } from '@/hooks/useOptimizedFirestore';

function UsageMonitor() {
    const { today, percentages, status } = useFirebaseUsage();
    
    return (
        <div>
            <p>Reads: {today.reads} ({percentages.reads}%)</p>
            <p>Writes: {today.writes} ({percentages.writes}%)</p>
            <p>Status: {status}</p>
        </div>
    );
}
```

---

## 🛠️ أدوات التحسين المتاحة

| الأداة | الوظيفة |
|--------|---------|
| `smartGetDoc()` | قراءة مع كاش |
| `smartQuery()` | Query مع كاش |
| `queueWrite()` | كتابة مع batching |
| `smartListen()` | Listener مع deduplication |
| `useOptimizedDoc()` | Hook للقراءة |
| `useOptimizedQuery()` | Hook للـ Query |
| `useOptimizedRealtime()` | Hook للـ Real-time |
| `useOptimizedMutation()` | Hook للكتابة |
| `getUsageReport()` | تقرير الاستهلاك |

---

## ✅ قائمة المراجعة (Checklist)

### قبل كل Query:
- [ ] هل أحتاج بيانات real-time؟ (لو لا، استخدم cache)
- [ ] هل فيه limit() مناسب؟
- [ ] هل الـ where clauses محددة كفاية؟
- [ ] هل ممكن أجمع queries متعددة في واحدة؟

### قبل كل Write:
- [ ] هل ممكن أجمعها مع writes تانية؟
- [ ] هل استخدمت `merge: true` بدل overwrite كامل؟
- [ ] هل حدّثت الكاش المحلي؟

### قبل إضافة Listener:
- [ ] هل فيه listener موجود ممكن أستخدمه؟
- [ ] هل حددت scope ضيق (where clauses)؟
- [ ] هل عملت cleanup في useEffect return؟

---

## 💡 نصائح إضافية

1. **استخدم Firestore Indexes** - يقلل وقت الـ query
2. **فعّل Offline Persistence** - يقلل reads عند إعادة التحميل
3. **استخدم Security Rules للتصفية** - أفضل من التصفية client-side
4. **راقب الـ Console** - Firebase Console يعرض الاستهلاك الفعلي
5. **اختبر في Production Mode** - الاستهلاك مختلف عن Development

---

## 🎯 الهدف النهائي

| المقياس | قبل | بعد | التوفير |
|---------|-----|-----|---------|
| Reads/يوم | ~40,000 | ~8,000 | 80% |
| Writes/يوم | ~15,000 | ~3,000 | 80% |
| Storage | 4 GB | 800 MB | 80% |
| Bandwidth | 800 MB | 150 MB | 81% |

**النتيجة:** البقاء في Free Tier حتى مع 10 فنادق! 🎉
