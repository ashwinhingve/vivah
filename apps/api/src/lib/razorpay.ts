// SWAP FLAG: Set USE_MOCK_SERVICES=false once Razorpay merchant account approved
// Real implementation: replace mock blocks with actual Razorpay SDK calls
import { env } from './env.js'

const USE_MOCK = env.USE_MOCK_SERVICES

export interface RazorpayOrder {
  id:       string
  amount:   number
  currency: string
  status:   string
}

export interface RazorpayRefund {
  id:     string
  amount: number
  status: string
}

export async function createOrder(
  amount: number,
  currency = 'INR',
  _receipt: string,
): Promise<RazorpayOrder> {
  if (USE_MOCK) {
    return { id: `mock_order_${Date.now()}`, amount, currency, status: 'created' }
  }
  throw new Error('Razorpay not configured')
}

export async function verifyWebhookSignature(
  _body: string,
  _signature: string,
): Promise<boolean> {
  if (USE_MOCK) return true
  throw new Error('Razorpay not configured')
}

export async function createRefund(
  _paymentId: string,
  amount: number,
): Promise<RazorpayRefund> {
  if (USE_MOCK) {
    return { id: `mock_refund_${Date.now()}`, amount, status: 'processed' }
  }
  throw new Error('Razorpay not configured')
}

export async function transferToVendor(
  _vendorAccountId: string,
  _amount: number,
): Promise<{ id: string }> {
  if (USE_MOCK) return { id: `mock_transfer_${Date.now()}` }
  throw new Error('Razorpay not configured')
}
