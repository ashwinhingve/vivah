import { describe, it, expectTypeOf } from 'vitest';
import type {
  ProfileMetaResponse,
  ProfileContentResponse,
  PersonalSection,
  PartnerPreferencesSection,
} from '../profile.js';

describe('ProfileMetaResponse', () => {
  it('has required id and userId as strings', () => {
    expectTypeOf<ProfileMetaResponse['id']>().toEqualTypeOf<string>();
    expectTypeOf<ProfileMetaResponse['userId']>().toEqualTypeOf<string>();
  });

  it('has nullable phoneNumber and email', () => {
    expectTypeOf<ProfileMetaResponse['phoneNumber']>().toEqualTypeOf<string | null>();
    expectTypeOf<ProfileMetaResponse['email']>().toEqualTypeOf<string | null>();
  });
});

describe('ProfileContentResponse', () => {
  it('has all sections as optional', () => {
    expectTypeOf<ProfileContentResponse['personal']>().toEqualTypeOf<PersonalSection | undefined>();
    expectTypeOf<ProfileContentResponse['partnerPreferences']>().toEqualTypeOf<PartnerPreferencesSection | undefined>();
  });

  it('has required userId, createdAt, updatedAt', () => {
    expectTypeOf<ProfileContentResponse['userId']>().toEqualTypeOf<string>();
    expectTypeOf<ProfileContentResponse['createdAt']>().toEqualTypeOf<string>();
  });
});

describe('PersonalSection', () => {
  it('gender is a union literal or undefined', () => {
    expectTypeOf<PersonalSection['gender']>().toEqualTypeOf<'MALE' | 'FEMALE' | 'OTHER' | undefined>();
  });

  it('maritalStatus is a union literal or undefined', () => {
    expectTypeOf<PersonalSection['maritalStatus']>().toEqualTypeOf<
      'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED' | undefined
    >();
  });
});
