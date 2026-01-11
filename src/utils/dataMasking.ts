/**
 * Data Masking Utilities - Guest Privacy Protection
 * Adora Hotel Management System
 * 
 * FEATURES:
 * - Phone number masking
 * - Identity document masking (National ID/Passport)
 * - Email masking
 * - Credit card masking
 * - Name partial masking
 */

// ============================================================
// PHONE NUMBER MASKING
// ============================================================

/**
 * Mask phone number (show first 3 and last 2 digits only)
 * @example +966501234567 → +966******67
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '******';
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.length < 5) return '******';
  
  // Saudi format: +966XXXXXXXXX (12-13 chars)
  if (cleaned.startsWith('+966')) {
    return `+966******${cleaned.slice(-2)}`;
  }
  
  // International format: +XXXXXXXXXXX
  if (cleaned.startsWith('+')) {
    const countryCode = cleaned.slice(0, 4);
    const lastTwo = cleaned.slice(-2);
    return `${countryCode}******${lastTwo}`;
  }
  
  // Local format: 05XXXXXXXX (10 digits)
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}******${cleaned.slice(-2)}`;
  }
  
  // Generic format
  return `${cleaned.slice(0, 3)}******${cleaned.slice(-2)}`;
}

/**
 * Check if phone is masked
 */
export function isPhoneMasked(phone: string): boolean {
  return phone.includes('*');
}

// ============================================================
// IDENTITY DOCUMENT MASKING
// ============================================================

/**
 * Mask identity document (show first 2 and last 2 chars only)
 * @example 1234567890 → 12******90
 * @example P12345678 → P1******78
 */
export function maskIdentity(identity: string | null | undefined): string {
  if (!identity) return '********';
  
  const cleaned = identity.trim();
  
  if (cleaned.length < 4) return '****';
  
  if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 2)}**${cleaned.slice(-2)}`;
  }
  
  return `${cleaned.slice(0, 2)}******${cleaned.slice(-2)}`;
}

/**
 * Check if identity is masked
 */
export function isIdentityMasked(identity: string): boolean {
  return identity.includes('*');
}

// ============================================================
// EMAIL MASKING
// ============================================================

/**
 * Mask email address (show first char and domain only)
 * @example john.doe@example.com → j*******@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '******@***.**';
  
  const [username, domain] = email.split('@');
  
  if (username.length <= 1) {
    return `*@${domain}`;
  }
  
  return `${username[0]}*******@${domain}`;
}

// ============================================================
// CREDIT CARD MASKING
// ============================================================

/**
 * Mask credit card number (show last 4 digits only)
 * @example 1234567812345678 → **** **** **** 5678
 */
export function maskCreditCard(cardNumber: string | null | undefined): string {
  if (!cardNumber) return '**** **** **** ****';
  
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (cleaned.length < 4) return '**** **** **** ****';
  
  const lastFour = cleaned.slice(-4);
  return `**** **** **** ${lastFour}`;
}

// ============================================================
// NAME MASKING (Partial)
// ============================================================

/**
 * Partially mask name (show first name only)
 * @example Ahmed Mohammed Ali → Ahmed M. A.
 */
export function maskName(fullName: string | null | undefined, level: 'partial' | 'full' = 'partial'): string {
  if (!fullName) return '***';
  
  const parts = fullName.trim().split(/\s+/);
  
  if (level === 'full') {
    return parts.map((part, i) => i === 0 ? part : '*'.repeat(part.length)).join(' ');
  }
  
  // Partial: Show first name + initials
  if (parts.length === 1) return parts[0];
  
  return `${parts[0]} ${parts.slice(1).map(p => p[0] + '.').join(' ')}`;
}

// ============================================================
// DATA SANITIZATION FOR DISPLAY
// ============================================================

/**
 * Sanitize guest data for public display (logs, exports, etc.)
 */
export interface GuestData {
  guestName?: string;
  guestPhone?: string;
  guestIdentity?: string;
  guestEmail?: string;
}

export interface MaskedGuestData {
  guestName: string;
  guestPhone: string;
  guestIdentity: string;
  guestEmail: string;
}

export function maskGuestData(data: GuestData): MaskedGuestData {
  return {
    guestName: maskName(data.guestName, 'partial'),
    guestPhone: maskPhone(data.guestPhone),
    guestIdentity: maskIdentity(data.guestIdentity),
    guestEmail: maskEmail(data.guestEmail),
  };
}

// ============================================================
// UNMASKING (For authorized users only)
// ============================================================

/**
 * Check if user has permission to view full data
 * Based on role and department
 */
export function canViewFullData(userRole: string, userDepartment: string): boolean {
  // Only admin, owner, and reception can view full guest data
  const authorizedRoles = ['admin', 'owner', 'manager'];
  const authorizedDepartments = ['reception', 'admin'];
  
  return (
    authorizedRoles.includes(userRole) ||
    authorizedDepartments.includes(userDepartment)
  );
}

/**
 * Conditionally mask data based on user permissions
 */
export function conditionallyMaskGuestData(
  data: GuestData,
  userRole: string,
  userDepartment: string
): GuestData | MaskedGuestData {
  if (canViewFullData(userRole, userDepartment)) {
    return data as GuestData;
  }
  
  return maskGuestData(data);
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate if data should be masked before storing
 * (For audit logs, exports, etc.)
 */
export function shouldMaskForStorage(context: 'audit' | 'export' | 'display'): boolean {
  // Always mask for exports and public displays
  if (context === 'export' || context === 'display') {
    return true;
  }
  
  // Don't mask audit logs (internal security requirement)
  if (context === 'audit') {
    return false;
  }
  
  return true;
}
