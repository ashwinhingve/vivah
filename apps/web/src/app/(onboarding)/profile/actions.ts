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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

export async function updatePersonal(formData: FormData) {
  const token = await getAuthToken();
  const payload: Record<string, unknown> = {};

  const fullName = formData.get('fullName');
  if (fullName) payload.fullName = fullName;
  const dob = formData.get('dob');
  if (dob) payload.dob = dob;
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

  await apiPut('/api/v1/profiles/me/content/personal', payload, token);
  revalidatePath('/profile');
  redirect('/profile/family');
}

export async function updateFamily(formData: FormData) {
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

  await apiPut('/api/v1/profiles/me/content/family', payload, token);
  revalidatePath('/profile');
  redirect('/profile/career');
}

export async function updateCareer(formData: FormData) {
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

  await apiPut('/api/v1/profiles/me/content/education', eduPayload, token);

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

  await apiPut('/api/v1/profiles/me/content/profession', profPayload, token);
  revalidatePath('/profile');
  redirect('/profile/lifestyle');
}

export async function updateLifestyle(formData: FormData) {
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

  await apiPut('/api/v1/profiles/me/content/lifestyle', payload, token);
  revalidatePath('/profile');
  redirect('/profile/horoscope');
}

export async function updateHoroscope(formData: FormData) {
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

  await apiPut('/api/v1/profiles/me/horoscope', payload, token);
  revalidatePath('/profile');
  redirect('/profile/community');
}

export async function updateCommunity(formData: FormData) {
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

  await apiPut('/api/v1/profiles/me/community', payload, token);
  revalidatePath('/profile');
  redirect('/profile/preferences');
}

export async function updatePreferences(formData: FormData) {
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

  await apiPut('/api/v1/profiles/me/preferences', payload, token);
  revalidatePath('/profile');
  redirect('/dashboard');
}
