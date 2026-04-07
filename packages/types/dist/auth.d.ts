export type UserRole = 'INDIVIDUAL' | 'FAMILY_MEMBER' | 'VENDOR' | 'EVENT_COORDINATOR' | 'ADMIN' | 'SUPPORT';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DELETED';
export type OtpPurpose = 'LOGIN' | 'REGISTRATION' | 'KYC' | 'CONTACT_UNLOCK' | 'PASSWORD_RESET';
export interface JwtPayload {
    sub: string;
    role: UserRole;
    sessionId: string;
    type: 'access';
    iat: number;
    exp: number;
}
export interface AuthUser {
    id: string;
    role: UserRole;
    status: UserStatus;
    /** Always masked: +91XXXXXX3210 */
    phone: string;
}
export interface ApiSuccess<T> {
    success: true;
    data: T;
    error: null;
    meta: {
        timestamp: string;
    };
}
export interface ApiError {
    success: false;
    data: null;
    error: {
        code: string;
        message: string;
    };
    meta: {
        timestamp: string;
    };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export declare const AuthErrorCode: {
    readonly INVALID_PHONE: "INVALID_PHONE";
    readonly USER_EXISTS: "USER_EXISTS";
    readonly USER_NOT_FOUND: "USER_NOT_FOUND";
    readonly USER_SUSPENDED: "USER_SUSPENDED";
    readonly OTP_RATE_LIMITED: "OTP_RATE_LIMITED";
    readonly OTP_EXPIRED: "OTP_EXPIRED";
    readonly OTP_INVALID: "OTP_INVALID";
    readonly OTP_MAX_ATTEMPTS: "OTP_MAX_ATTEMPTS";
    readonly TOKEN_INVALID: "TOKEN_INVALID";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
};
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];
//# sourceMappingURL=auth.d.ts.map