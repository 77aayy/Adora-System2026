/**
 * اختبار دخول المدير بكود 1111
 * يستدعي Cloud Function loginWithPin مباشرة
 */
const url = 'https://us-central1-adora-platform2026.cloudfunctions.net/loginWithPin';
const body = JSON.stringify({ data: { pin: '1111', branchId: '' } });

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

console.log('Status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));

if (data.result?.success) {
  console.log('\n✅ نجح الدخول — المدير:', data.result.user?.name, '| tenantId:', data.result.user?.tenantId);
} else if (data.result?.error) {
  console.log('\n❌ فشل الدخول:', data.result.error);
} else if (data.error) {
  console.log('\n❌ خطأ:', data.error.message || data.error);
}

process.exit(data.result?.success ? 0 : 1);
