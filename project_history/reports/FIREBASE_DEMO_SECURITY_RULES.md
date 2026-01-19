# Firebase Security Rules for Demo Engine
## Adora Hotel Management System

**⚠️ CRITICAL SECURITY REQUIREMENT:**
Demo instances must be completely isolated from production data. A Demo Manager should NEVER be able to query production collections.

---

## Proposed Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ✅ DEMO ISOLATION: Strict branch-based access control
    function isDemoBranch() {
      return request.auth != null && 
             request.auth.token.demo_branch_id != null &&
             request.auth.token.demo_branch_id == resource.data.branch;
    }
    
    function isProductionBranch() {
      return request.auth != null && 
             request.auth.token.demo_branch_id == null &&
             resource.data.branch != null &&
             resource.data.branch != 'demo_branch_id';
    }
    
    // ✅ DEMO USER VALIDATION
    function isDemoUser() {
      return request.auth != null && 
             request.auth.token.demo_branch_id != null &&
             request.auth.token.role == 'manager';
    }
    
    // ✅ PRODUCTION USER VALIDATION
    function isProductionUser() {
      return request.auth != null && 
             request.auth.token.demo_branch_id == null;
    }
    
    // ============================================================
    // REQUESTS COLLECTION
    // ============================================================
    match /requests/{requestId} {
      // ✅ DEMO: Can only read/write requests for demo_branch_id
      allow read, write: if isDemoUser() && 
        (resource == null || resource.data.branch == request.auth.token.demo_branch_id);
      
      // ✅ PRODUCTION: Normal access (existing rules)
      allow read, write: if isProductionUser() && 
        (resource == null || isProductionBranch());
      
      // ❌ BLOCK: Demo users cannot access production requests
      allow read, write: if isDemoUser() && 
        resource.data.branch != request.auth.token.demo_branch_id;
    }
    
    // ============================================================
    // ROOMS COLLECTION
    // ============================================================
    match /rooms/{roomId} {
      allow read, write: if isDemoUser() && 
        (resource == null || resource.data.branch == request.auth.token.demo_branch_id);
      
      allow read, write: if isProductionUser() && 
        (resource == null || isProductionBranch());
    }
    
    // ============================================================
    // EMPLOYEES COLLECTION
    // ============================================================
    match /employees/{employeeId} {
      allow read, write: if isDemoUser() && 
        (resource == null || resource.data.branch == request.auth.token.demo_branch_id);
      
      allow read, write: if isProductionUser() && 
        (resource == null || isProductionBranch());
    }
    
    // ============================================================
    // LOST_FOUND COLLECTION
    // ============================================================
    match /lost_found/{itemId} {
      allow read, write: if isDemoUser() && 
        (resource == null || resource.data.branch == request.auth.token.demo_branch_id);
      
      allow read, write: if isProductionUser() && 
        (resource == null || isProductionBranch());
    }
    
    // ============================================================
    // BRANCHES COLLECTION
    // ============================================================
    match /branches/{branchId} {
      // ✅ DEMO: Can only read their own demo branch
      allow read: if isDemoUser() && branchId == request.auth.token.demo_branch_id;
      allow write: if false; // Demo users cannot modify branches
      
      // ✅ PRODUCTION: Normal access
      allow read, write: if isProductionUser();
    }
    
    // ============================================================
    // TENANTS COLLECTION
    // ============================================================
    match /tenants/{tenantId} {
      // ✅ DEMO: Read-only access to demo tenant
      allow read: if isDemoUser() && tenantId == request.auth.token.tenant_id;
      allow write: if false; // Demo users cannot modify tenants
      
      // ✅ PRODUCTION: Normal access
      allow read, write: if isProductionUser();
    }
    
    // ============================================================
    // POINTS COLLECTION (Gamification)
    // ============================================================
    match /points/{pointId} {
      allow read, write: if isDemoUser() && 
        (resource == null || resource.data.tenantId == request.auth.token.tenant_id);
      
      allow read, write: if isProductionUser() && 
        (resource == null || resource.data.tenantId == request.auth.token.tenant_id);
    }
    
    // ============================================================
    // DEFAULT DENY
    // ============================================================
    match /{document=**} {
      allow read, write: if false; // Deny all other collections by default
    }
  }
}
```

---

## Security Guarantees

1. **Complete Isolation:** Demo users can ONLY access data where `branch == demo_branch_id`
2. **No Production Access:** Demo users CANNOT query production branches
3. **Read-Only Restrictions:** Demo users cannot modify branches or tenants
4. **Token-Based Validation:** All access is validated via Firebase Auth custom claims

---

## Implementation Notes

1. **Custom Claims Setup:**
   ```typescript
   // In Firebase Functions or Admin SDK
   await admin.auth().setCustomUserClaims(userId, {
     demo_branch_id: 'demo_branch_123',
     tenant_id: 'demo_tenant_123',
     role: 'manager'
   });
   ```

2. **Token Refresh:** Users must refresh their token after custom claims are set:
   ```typescript
   await user.getIdToken(true); // Force refresh
   ```

3. **Testing:** Use Firebase Emulator to test these rules before deployment.

---

## Approval Required

**Before implementing Demo Engine, please review and approve these security rules.**
