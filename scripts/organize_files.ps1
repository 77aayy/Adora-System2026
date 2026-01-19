# Script to organize markdown files into project_history

# Move I18N files
Get-ChildItem -Filter "I18N_*.md" -File | Move-Item -Destination "project_history\i18n\" -Force -ErrorAction SilentlyContinue

# Move PHASE files
Get-ChildItem -Filter "PHASE_*.md" -File | Move-Item -Destination "project_history\phases\" -Force -ErrorAction SilentlyContinue

# Move ADMIN files
Get-ChildItem -Filter "ADMIN_*.md" -File | Move-Item -Destination "project_history\admin_updates\" -Force -ErrorAction SilentlyContinue

# Move report files
$reportPatterns = @("FINAL_*.md", "COMPLETE_*.md", "COMPREHENSIVE_*.md", "AUDIT_REPORT.md", "CODE_AUDIT_REPORT.md", "EXECUTIVE_SUMMARY.md", "HUMAN_REVIEW_REPORT.md", "CURRENT_STATUS_REPORT.md", "FINAL_STATUS_REPORT.md", "FINAL_CLEANUP_REPORT.md", "OWNER_CONCERNS_REPORT.md", "VIOLATIONS_REPORT.md", "CRITICAL_GAP_ANALYSIS_SHOCK_REPORT.md", "DETAILED_REVIEW_BY_SECTION.md", "DATA_FLOW_CIRCLES_SCAN_REPORT.md", "*_SUMMARY*.md", "*_ANALYSIS*.md", "PROPOSALS_*.md", "SECURITY_*.md", "SUPABASE_*.md", "NOTIFICATION_*.md", "POINTS_*.md", "BILLING_*.md", "FIXES_*.md", "BUILD_*.md", "CLEANUP_*.md", "CLEAN_*.md", "CURSOR_*.md", "FIREBASE_VS_*.md", "FIREBASE_FIXES_*.md", "AI_*.md", "CHECK_*.md", "DESIGNER_*.md", "RACE_*.md", "SPRINT_*.md", "SESSION_*.md", "REVIEW_*.md", "QUICK_RESUME.md", "PROJECT_COMPLETE.md", "PENDING_*.md", "TODO_*.md", "DEFERRED_*.md", "IMPROVEMENTS_*.md", "TEST_*.md", "DEPLOY_RULES_*.md", "RULES_DEPLOYED_*.md", "FIX_*.md", "MANAGER_LOGIN_*.md", "APP_STARTUP_*.md", "LOGIN_FLOW_*.md", "CRITICAL_RULES_*.md", "FIRESTORE_RULES_*.md", "ANONYMOUS_AUTH_*.md", "GLOBALCODES_*.md", "SAAS_ISOLATION_*.md", "START_HERE.md", "SYNC_WORKFLOW.md")

foreach ($pattern in $reportPatterns) {
    Get-ChildItem -Filter $pattern -File -ErrorAction SilentlyContinue | Move-Item -Destination "project_history\reports\" -Force -ErrorAction SilentlyContinue
}

Write-Host "Files organized successfully!"
