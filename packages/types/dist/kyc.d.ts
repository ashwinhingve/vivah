export declare const KycErrorCode: {
    readonly PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND";
    readonly KYC_ALREADY_VERIFIED: "KYC_ALREADY_VERIFIED";
    readonly KYC_IN_REVIEW: "KYC_IN_REVIEW";
    readonly KYC_REJECTED: "KYC_REJECTED";
    readonly DUPLICATE_ACCOUNT_DETECTED: "DUPLICATE_ACCOUNT_DETECTED";
    readonly PHOTO_FRAUD_DETECTED: "PHOTO_FRAUD_DETECTED";
    readonly AADHAAR_VERIFICATION_FAILED: "AADHAAR_VERIFICATION_FAILED";
};
export type KycErrorCode = typeof KycErrorCode[keyof typeof KycErrorCode];
export interface PhotoAnalysis {
    isRealPerson: boolean;
    confidenceScore: number;
    hasSunglasses: boolean;
    multipleFaces: boolean;
    analyzedAt: string;
}
export interface AadhaarVerificationResult {
    verified: boolean;
    refId: string;
}
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
export interface KycStatusResponse {
    verificationStatus: KycVerificationStatus;
    aadhaarVerified: boolean;
    duplicateFlag: boolean;
    photoAnalysis: PhotoAnalysis | null;
    adminNote: string | null;
}
//# sourceMappingURL=kyc.d.ts.map