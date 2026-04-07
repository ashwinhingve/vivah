"use strict";
// ── User & Role Types ─────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthErrorCode = void 0;
// ── Error Codes ───────────────────────────────────────────────────────────────
exports.AuthErrorCode = {
    INVALID_PHONE: 'INVALID_PHONE',
    USER_EXISTS: 'USER_EXISTS',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_SUSPENDED: 'USER_SUSPENDED',
    OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
    OTP_EXPIRED: 'OTP_EXPIRED',
    OTP_INVALID: 'OTP_INVALID',
    OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
};
//# sourceMappingURL=auth.js.map