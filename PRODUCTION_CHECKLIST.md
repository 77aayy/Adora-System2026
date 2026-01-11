# 🚀 Adora Production Checklist

## Pre-Deployment Checklist

### 1. Firebase Configuration
- [ ] Verify all `.env` variables are set correctly
- [ ] Test connection using Setup Wizard
- [ ] Upload Firestore Security Rules
- [ ] Deploy Firestore Indexes

### 2. Security
- [ ] Remove any console logs with sensitive data
- [ ] Verify API keys are NOT in source code
- [ ] Enable Firebase App Check
- [ ] Configure CORS properly

### 3. Performance
- [ ] Run `npm run build` and check bundle sizes
- [ ] Verify image compression is working (< 300KB)
- [ ] Test on slow 3G connection
- [ ] Check Lighthouse score (target: 90+)

### 4. Mobile Testing
- [ ] Test menu button on iPhone Safari
- [ ] Test menu button on Android Chrome
- [ ] Verify touch interactions are smooth
- [ ] Test offline mode

### 5. Data Integrity
- [ ] Run Data Doctor health check
- [ ] Verify tenant seeding works
- [ ] Test manager creation flow
- [ ] Test employee login flow

---

## Firebase Security Rules Template

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Global codes (PIN verification)
    match /globalCodes/{code} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['owner', 'manager'];
    }
    
    // Tenant-specific data
    match /tenants/{tenantId}/{document=**} {
      allow read: if request.auth != null && 
                    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId ||
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner');
      allow write: if request.auth != null && 
                     (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId ||
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner');
    }
    
    // Health check (for connection testing)
    match /health_check/{doc} {
      allow read: if true;
      allow write: if false;
    }
    
    // Master access logs
    match /master_access_logs/{logId} {
      allow read: if request.auth != null && 
                    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner';
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner';
    }
  }
}
```

---

## Firestore Indexes

Create these indexes in Firebase Console > Firestore > Indexes:

```json
{
  "indexes": [
    {
      "collectionGroup": "rooms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "floor", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "department", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "employees",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "department", "order": "ASCENDING" },
        { "fieldPath": "isOnline", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## Build Commands

```bash
# Development
npm run dev

# Production Build
npm run build

# Preview Production Build
npm run preview

# Type Check
npx tsc --noEmit

# Lint Check
npm run lint
```

---

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Firebase Hosting
```bash
# Install Firebase CLI
npm i -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Deploy
firebase deploy --only hosting
```

---

## Monitoring

1. **Firebase Console**: Monitor Firestore usage, Authentication, Storage
2. **Vercel Analytics**: Monitor performance and errors (if using Vercel)
3. **Data Doctor**: Weekly health reports in Owner Dashboard

---

## Emergency Contacts

- **System Issues**: Use Master Access to fix tenant configs
- **Database Issues**: Run Data Doctor health check
- **Security Issues**: Clear tenant config and force re-authentication

---

© 2024 Adora Hotel Management System | Crafted by Ayman Abu Warda
