/**
 * Deployment Script - Multi-Tenant Migration
 * Run this ONCE to migrate existing data to multi-tenant structure
 */

import { migrateToMultiTenant, verifyMigration } from '../utils/migration';

async function deploy() {
    console.log('🚀 Starting Multi-Tenant Migration...\n');

    try {
        // Step 1: Run migration
        console.log('Step 1: Migrating data...');
        const result = await migrateToMultiTenant(
            'الفندق الرئيسي', // Default hotel name
            '9999'             // Manager code
        );

        if (!result.success) {
            console.error('❌ Migration failed:', result.errors);
            return;
        }

        console.log('\n✅ Migration successful!');
        console.log(`   Tenant ID: ${result.tenantId}`);
        console.log(`   Employees migrated: ${result.employeesMigrated}`);
        console.log(`   Rooms migrated: ${result.roomsMigrated}`);
        console.log(`   Requests migrated: ${result.requestsMigrated}`);

        // Step 2: Verify migration
        console.log('\nStep 2: Verifying migration...');
        const verified = await verifyMigration(result.tenantId!);

        if (!verified) {
            console.error('❌ Verification failed');
            return;
        }

        console.log('\n✅ Verification successful!');

        // Step 3: Deploy Firestore rules
        console.log('\nStep 3: Deploy Firestore rules');
        console.log('Run: firebase deploy --only firestore:rules');

        console.log('\n🎉 Deployment complete!');
        console.log('\nNext steps:');
        console.log('1. Deploy Firestore rules: firebase deploy --only firestore:rules');
        console.log('2. Test login with code 9999 (manager)');
        console.log('3. Access Super Admin at /super-admin');
        console.log('4. Create additional hotels from Super Admin panel');

    } catch (error) {
        console.error('\n❌ Deployment error:', error);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    deploy();
}

export { deploy };
