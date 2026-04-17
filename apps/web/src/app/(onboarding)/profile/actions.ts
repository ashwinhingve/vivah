'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('better-auth.session_token')?.value;
}

async function apiPut(path: string, body: unknown, token: string | undefined) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

export async function updatePersonal(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const fullName = formData.get('fullName');
  if (fullName) payload.fullName = fullName;
  const dob = formData.get('dob');
  if (dob) payload.dob = new Date(dob as string).toISOString();
  const gender = formData.get('gender');
  if (gender) payload.gender = gender;
  const heightFt = formData.get('heightFt');
  const heightIn = formData.get('heightIn');
  if (heightFt) payload.heightCm = Math.round(Number(heightFt) * 30.48 + Number(heightIn ?? 0) * 2.54);
  const religion = formData.get('religion');
  if (religion) payload.religion = religion;
  const motherTongue = formData.get('motherTongue');
  if (motherTongue) payload.motherTongue = motherTongue;
  const currentCity = formData.get('currentCity');
  if (currentCity) payload.currentCity = currentCity;
  const aboutMe = formData.get('aboutMe');
  if (aboutMe) payload.aboutMe = aboutMe;
  const maritalStatus = formData.get('maritalStatus');
  if (maritalStatus) payload.maritalStatus = maritalStatus;

  try {
    const res = await apiPut('/api/v1/profiles/me/content/personal', payload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save personal details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/profile/family');
}

export async function updateFamily(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const fatherName = formData.get('fatherName');
  if (fatherName) payload.fatherName = fatherName;
  const fatherOccupation = formData.get('fatherOccupation');
  if (fatherOccupation) payload.fatherOccupation = fatherOccupation;
  const motherName = formData.get('motherName');
  if (motherName) payload.motherName = motherName;
  const motherOccupation = formData.get('motherOccupation');
  if (motherOccupation) payload.motherOccupation = motherOccupation;
  const familyType = formData.get('familyType');
  if (familyType) payload.familyType = familyType;
  const familyValues = formData.get('familyValues');
  if (familyValues) payload.familyValues = familyValues;
  const familyStatus = formData.get('familyStatus');
  if (familyStatus) payload.familyStatus = familyStatus;
  const nativePlace = formData.get('nativePlace');
  if (nativePlace) payload.nativePlace = nativePlace;
  const familyAbout = formData.get('familyAbout');
  if (familyAbout) payload.familyAbout = familyAbout;

  try {
    const res = await apiPut('/api/v1/profiles/me/content/family', payload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save family details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/profile/career');
}

export async function updateCareer(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();

  const eduPayload: Record<string, unknown> = {};
  const degree = formData.get('degree');
  if (degree) eduPayload.degree = degree;
  const college = formData.get('college');
  if (college) eduPayload.college = college;
  const fieldOfStudy = formData.get('fieldOfStudy');
  if (fieldOfStudy) eduPayload.fieldOfStudy = fieldOfStudy;
  const year = formData.get('year');
  if (year) eduPayload.year = Number(year);

  try {
    const res = await apiPut('/api/v1/profiles/me/content/education', eduPayload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save education details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  const profPayload: Record<string, unknown> = {};
  const occupation = formData.get('occupation');
  if (occupation) profPayload.occupation = occupation;
  const employerType = formData.get('employerType');
  if (employerType) profPayload.employerType = employerType;
  const employer = formData.get('employer');
  if (employer) profPayload.employer = employer;
  const designation = formData.get('designation');
  if (designation) profPayload.designation = designation;
  const incomeRange = formData.get('incomeRange');
  if (incomeRange) profPayload.incomeRange = incomeRange;
  const workLocation = formData.get('workLocation');
  if (workLocation) profPayload.workLocation = workLocation;

  try {
    const res = await apiPut('/api/v1/profiles/me/content/profession', profPayload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save career details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/profile/lifestyle');
}

export async function updateLifestyle(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const diet = formData.get('diet');
  if (diet) payload.diet = diet;
  const smoking = formData.get('smoking');
  if (smoking) payload.smoking = smoking;
  const drinking = formData.get('drinking');
  if (drinking) payload.drinking = drinking;
  const hobbies = formData.getAll('hobbies');
  if (hobbies.length > 0) payload.hobbies = hobbies;
  const hyperNicheTags = formData.getAll('hyperNicheTags');
  if (hyperNicheTags.length > 0) payload.hyperNicheTags = hyperNicheTags;
  const languagesSpoken = formData.getAll('languagesSpoken');
  if (languagesSpoken.length > 0) payload.languagesSpoken = languagesSpoken;
  const fitnessLevel = formData.get('fitnessLevel');
  if (fitnessLevel) payload.fitnessLevel = fitnessLevel;

  try {
    const res = await apiPut('/api/v1/profiles/me/content/lifestyle', payload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save lifestyle details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/profile/horoscope');
}

export async function updateHoroscope(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const rashi = formData.get('rashi');
  if (rashi) payload.rashi = rashi;
  const nakshatra = formData.get('nakshatra');
  if (nakshatra) payload.nakshatra = nakshatra;
  const manglik = formData.get('manglik');
  if (manglik) payload.manglik = manglik;
  const dob = formData.get('dob');
  if (dob) payload.dob = new Date(dob as string).toISOString();
  const tob = formData.get('tob');
  if (tob) payload.tob = tob;
  const pob = formData.get('pob');
  if (pob) payload.pob = pob;

  try {
    const res = await apiPut('/api/v1/profiles/me/horoscope', payload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save horoscope details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/profile/community');
}

export async function updateCommunity(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const community = formData.get('community');
  if (community) payload.community = community;
  const subCommunity = formData.get('subCommunity');
  if (subCommunity) payload.subCommunity = subCommunity;
  const motherTongue = formData.get('motherTongue');
  if (motherTongue) payload.motherTongue = motherTongue;
  const preferredLang = formData.get('preferredLang');
  if (preferredLang) payload.preferredLang = preferredLang;
  const lgbtqProfile = formData.get('lgbtqProfile');
  payload.lgbtqProfile = lgbtqProfile === 'on';

  try {
    const res = await apiPut('/api/v1/profiles/me/community', payload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save community details. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/profile/preferences');
}

export async function initiateKyc(): Promise<{ authUrl?: string; error?: string }> {
  const token = await getAuthToken();
  const callbackUri = `${API_URL}/api/v1/kyc/callback`;
  try {
    const res = await fetch(`${API_URL}/api/v1/kyc/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
      },
      body: JSON.stringify({ redirectUri: callbackUri }),
    });
    const json = (await res.json()) as { success: boolean; data?: { authUrl: string }; error?: { message: string } };
    if (json.success && json.data?.authUrl) return { authUrl: json.data.authUrl };
    return { error: json.error?.message ?? 'Verification could not be started' };
  } catch {
    return { error: 'Network error. Please try again.' };
  }
}

export async function updatePreferences(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const ageMin = formData.get('ageMin');
  const ageMax = formData.get('ageMax');
  if (ageMin && ageMax) payload.ageRange = { min: Number(ageMin), max: Number(ageMax) };

  const heightMin = formData.get('heightMin');
  const heightMax = formData.get('heightMax');
  if (heightMin && heightMax) payload.heightRange = { min: Number(heightMin), max: Number(heightMax) };

  const manglik = formData.get('manglik');
  if (manglik) payload.manglik = manglik;
  const openToInterfaith = formData.get('openToInterfaith');
  payload.openToInterfaith = openToInterfaith === 'on';
  const openToInterCaste = formData.get('openToInterCaste');
  payload.openToInterCaste = openToInterCaste === 'on';

  const diet = formData.getAll('diet');
  if (diet.length > 0) payload.diet = diet;
  const maritalStatus = formData.getAll('maritalStatus');
  if (maritalStatus.length > 0) payload.maritalStatus = maritalStatus;
  const religion = formData.getAll('religion');
  if (religion.length > 0) payload.religion = religion;

  const partnerDescription = formData.get('partnerDescription');
  if (partnerDescription) payload.partnerDescription = partnerDescription;

  try {
    const res = await apiPut('/api/v1/profiles/me/preferences', payload, token);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { error: json.error?.message ?? 'Could not save preferences. Please try again.' };
    }
  } catch {
    return { error: 'Network error. Please check your connection and try again.' };
  }

  revalidatePath('/profile');
  redirect('/dashboard');
}
