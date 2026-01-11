/**
 * Billing & Payment Types
 * Adora Hotel Management System
 * 
 * Foundation for future payment integration
 */

// ============================================================
// PAYMENT TYPES
// ============================================================

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'pending' | 'credit';
export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'cancelled' | 'refunded';
export type Currency = 'SAR' | 'USD' | 'EUR';

// ============================================================
// BILLING INTERFACES
// ============================================================

export interface BillingLineItem {
  id: string;
  description: string;
  category: 'room' | 'minibar' | 'service' | 'laundry' | 'other';
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxRate: number; // e.g., 0.15 for 15% VAT
  taxAmount: number;
  total: number;
  date: Date;
}

export interface RoomCharge {
  numberOfNights: number;
  pricePerNight: number;
  checkInDate: Date;
  checkOutDate: Date;
  roomNumber: string;
  roomType?: string;
  subtotal: number;
}

export interface MinibarCharge {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
}

export interface ServiceCharge {
  serviceType: 'laundry' | 'coffee' | 'bellman' | 'other';
  description: string;
  amount: number;
  date: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  roomCardId: string;
  roomNumber: string;
  guestName: string;
  guestIdentity?: string;
  
  // Date range
  checkInDate: Date;
  checkOutDate: Date;
  invoiceDate: Date;
  
  // Line items
  roomCharges: RoomCharge;
  minibarCharges?: MinibarCharge;
  serviceCharges: ServiceCharge[];
  additionalCharges: BillingLineItem[];
  
  // Totals
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discountAmount?: number;
  discountReason?: string;
  totalAmount: number;
  
  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  remainingBalance: number;
  
  // Transaction details
  transactionId?: string;
  paymentDate?: Date;
  paymentReference?: string;
  
  // Metadata
  currency: Currency;
  branch: string;
  createdBy: string;
  createdAt: Date;
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  transactionId?: string;
  reference?: string;
  receivedBy: string;
  notes?: string;
}

// ============================================================
// CHECKOUT WITH BILLING
// ============================================================

export interface CheckoutBilling {
  // Room charges (calculated from room card)
  roomPrice: number;
  numberOfNights: number;
  roomTotal: number;
  
  // Additional charges
  minibarTotal: number;
  servicesTotal: number;
  additionalCharges: number;
  
  // Calculations
  subtotal: number;
  taxRate: number; // 0.15 for Saudi VAT
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  
  // Payment info
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  changeAmount?: number; // For cash payments
  
  // Transaction
  transactionId?: string;
  paymentReference?: string;
  receiptNumber?: string;
}

// ============================================================
// PRICING CONFIG
// ============================================================

export interface RoomPricing {
  roomType: string;
  basePrice: number;
  weekendPrice?: number;
  seasonalPricing?: Array<{
    startDate: Date;
    endDate: Date;
    price: number;
    season: string;
  }>;
}

export interface TaxConfiguration {
  name: string;
  rate: number;
  applicableTo: Array<'room' | 'minibar' | 'service' | 'all'>;
  enabled: boolean;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate tax amount
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

/**
 * Calculate total with tax
 */
export function calculateTotal(subtotal: number, taxRate: number, discount: number = 0): number {
  const afterDiscount = subtotal - discount;
  const taxAmount = calculateTax(afterDiscount, taxRate);
  return Math.round((afterDiscount + taxAmount) * 100) / 100;
}

/**
 * Calculate number of nights
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays); // Minimum 1 night
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: Currency = 'SAR'): string {
  const symbols: Record<Currency, string> = {
    SAR: 'ر.س',
    USD: '$',
    EUR: '€',
  };
  
  return `${amount.toFixed(2)} ${symbols[currency]}`;
}

/**
 * Generate invoice number
 */
export function generateInvoiceNumber(branch: string, sequence: number): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const seq = sequence.toString().padStart(5, '0');
  
  return `INV-${branch}-${year}${month}-${seq}`;
}
