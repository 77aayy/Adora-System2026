/**
 * 🧪 Auth Repository Tests
 * ========================
 * اختبارات وحدة المصادقة
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IAuthRepository } from '../../src/repositories/interfaces/IAuthRepository';
import { LoginResult } from '../../src/types/auth';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎭 Mock Auth Repository
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class MockAuthRepository implements IAuthRepository {
  private validCodes = new Map([
    ['765255', { employeeId: 'owner-1', tenantId: 'test-tenant', role: 'owner' }],
    ['011234', { employeeId: 'emp-1', tenantId: 'test-tenant', role: 'employee' }],
  ]);

  async loginWithGlobalCode(code: string): Promise<LoginResult> {
    const data = this.validCodes.get(code);
    
    if (!data) {
      return {
        success: false,
        error: 'رمز الدخول غير صحيح'
      };
    }

    return {
      success: true,
      employee: {
        id: data.employeeId,
        name: 'Test User',
        code: code,
        department: 'admin',
        role: data.role as any,
        status: 'active',
        branches: ['branch-1'],
        tenantId: data.tenantId,
      },
      tenantId: data.tenantId
    };
  }

  async loadSession(): Promise<LoginResult> {
    const session = localStorage.getItem('adora_session');
    if (!session) {
      return { success: false, error: 'No session' };
    }
    
    const { code } = JSON.parse(session);
    return this.loginWithGlobalCode(code);
  }

  logout(): void {
    localStorage.removeItem('adora_session');
    localStorage.removeItem('adora_employee_id');
    localStorage.removeItem('adora_tenant_id');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧪 Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AuthRepository', () => {
  let authRepo: IAuthRepository;

  beforeEach(() => {
    authRepo = new MockAuthRepository();
  });

  describe('loginWithGlobalCode', () => {
    it('✅ يجب أن ينجح مع كود صحيح', async () => {
      const result = await authRepo.loginWithGlobalCode('765255');
      
      expect(result.success).toBe(true);
      expect(result.employee).toBeDefined();
      expect(result.tenantId).toBe('test-tenant');
    });

    it('❌ يجب أن يفشل مع كود خاطئ', async () => {
      const result = await authRepo.loginWithGlobalCode('000000');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('غير صحيح');
    });

    it('✅ يجب أن يعيد بيانات الموظف الصحيحة', async () => {
      const result = await authRepo.loginWithGlobalCode('011234');
      
      expect(result.success).toBe(true);
      expect(result.employee?.role).toBe('employee');
      expect(result.employee?.branches).toContain('branch-1');
    });
  });

  describe('logout', () => {
    it('✅ يجب أن يمسح بيانات الجلسة', () => {
      // Setup
      localStorage.setItem('adora_session', JSON.stringify({ code: '765255' }));
      localStorage.setItem('adora_employee_id', 'owner-1');
      
      // Act
      authRepo.logout();
      
      // Assert
      expect(localStorage.getItem('adora_session')).toBeNull();
      expect(localStorage.getItem('adora_employee_id')).toBeNull();
    });
  });

  describe('loadSession', () => {
    it('❌ يجب أن يفشل بدون جلسة محفوظة', async () => {
      const result = await authRepo.loadSession();
      
      expect(result.success).toBe(false);
    });

    it('✅ يجب أن يستعيد الجلسة المحفوظة', async () => {
      // Setup
      localStorage.setItem('adora_session', JSON.stringify({ code: '765255' }));
      
      // Act
      const result = await authRepo.loadSession();
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.employee).toBeDefined();
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔒 Security Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Auth Security', () => {
  let authRepo: IAuthRepository;

  beforeEach(() => {
    authRepo = new MockAuthRepository();
  });

  it('🔒 يجب أن يرفض الأكواد الفارغة', async () => {
    const result = await authRepo.loginWithGlobalCode('');
    expect(result.success).toBe(false);
  });

  it('🔒 يجب أن يرفض الأكواد القصيرة', async () => {
    const result = await authRepo.loginWithGlobalCode('123');
    expect(result.success).toBe(false);
  });

  it('🔒 يجب أن يرفض الأكواد مع أحرف', async () => {
    const result = await authRepo.loginWithGlobalCode('abc123');
    expect(result.success).toBe(false);
  });
});
