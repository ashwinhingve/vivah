# Demo Data Plan — Sunday May 18, 2026

3 deliberately-rich profiles for demo recording.
Goal: AI features show meaningful, differentiated outputs.

---

## Profile A — Highly Compatible Pair

**User 1 (demo-as-self):**
- Phone: +919999999999 (OTP 135246)
- Name: Aarav Sharma
- Age: 28 (DOB 1998-03-15)
- Gender: Male
- Location: Bhopal, MP
- Education: B.Tech Computer Science, IIT Indore, 2020
- Occupation: Senior Software Engineer at Tata Consultancy Services
- Income: ₹18 lakh per annum
- Bio: "Software engineer based in Bhopal, originally from Indore. 
   Family-oriented but career-focused. Enjoy weekend treks, cooking 
   Marathi food, and reading historical fiction. Looking for a 
   thoughtful partner who values both tradition and modern ambitions."
- Religion: Hindu
- Caste: Brahmin
- Community: Marathi
- Mother tongue: Marathi
- Family type: Joint family
- Family values: Traditional with modern outlook
- Father: Government engineer, retired
- Mother: Homemaker
- Siblings: 1 sister (married)
- Manglik: No
- Lifestyle: Vegetarian, occasional drinker, non-smoker
- Hobbies: Trekking, cooking, reading, photography
- Partner Prefs: Age 24-28, Hindu Brahmin/Maratha, BE/MBA/MSc, 
  family-oriented, vegetarian

**User 2 (demo-as-match):**
- Phone: +918120684036 (OTP 135246)
- Name: Priya Joshi
- Age: 26 (DOB 1999-08-22)
- Gender: Female
- Location: Pune, MH
- Education: M.Tech IIT Bombay 2022 + B.E. VJTI Mumbai 2020
- Occupation: Product Manager at Persistent Systems
- Income: ₹16 lakh per annum
- Bio: "Pune-based product manager with engineering background. 
   Family-rooted in Maharashtrian traditions — Ganesh Chaturthi at 
   Lalbaugcha Raja every year. Love classical music, badminton, and 
   weekend hikes in Western Ghats. Looking for a partner who balances 
   ambition with family values."
- Religion: Hindu
- Caste: Brahmin
- Community: Marathi  
- Mother tongue: Marathi
- Family type: Joint family
- Family values: Traditional with modern outlook
- Father: Banker (private sector)
- Mother: Teacher
- Siblings: 1 brother (engineer)
- Manglik: No
- Lifestyle: Vegetarian, occasional drinker, non-smoker
- Hobbies: Classical music (Hindustani vocal), badminton, hiking
- Partner Prefs: Age 26-32, Hindu Brahmin/Maratha, B.Tech/M.Tech/MBA, 
  family-oriented, vegetarian

**Expected AI output for this pair:**
- DPI Score: LOW risk (~85-95 compatibility)
- DPI Label: "Strong Foundation" or similar high-confidence label
- FII Family Compat: "Family-Oriented" both, HIGH compatibility
- Behavior-based match: should show as 90%+ in feed

---

## Profile C — Moderate Match (some discussion areas)

**User 3 (optional, only if time):**
- Phone: +919876543210 (OTP 135246)
- Name: Anjali Mehta
- Age: 24 (DOB 2001-11-10)
- Gender: Female
- Location: Mumbai, MH
- Education: MBA NMIMS 2024 + B.Com Mumbai University 2022
- Occupation: Investment Analyst at HDFC Bank
- Income: ₹14 lakh per annum
- Bio: "Mumbai girl, business school grad working in investment 
   banking. Strong career focus — looking to make Partner by 32. 
   Modern outlook but respect for traditions. Enjoy fine dining, 
   travel (15 countries so far), and weekend retreats."
- Religion: Hindu
- Caste: Gujarati Brahmin
- Community: Gujarati
- Mother tongue: Gujarati
- Family type: Nuclear family
- Family values: Modern
- Father: Diamond merchant
- Mother: Homemaker
- Siblings: None (only child)
- Manglik: No
- Lifestyle: Eggetarian, social drinker, non-smoker
- Hobbies: Travel, fine dining, yoga, equity research
- Partner Prefs: Age 26-32, Hindu (any caste), professional 
  (preferring CA/MBA/banker), modern outlook

**Expected AI output vs User 1 (Aarav):**
- DPI Score: MEDIUM (~50-65)
- DPI Label: "Some Areas to Discuss"
- Reasons: different lifestyle (eggetarian vs veg, social drinker), 
  different community (Marathi vs Gujarati), career-vs-family balance
- FII Family Compat: "Independent-Leaning" (Anjali) vs "Family-First" 
  (Aarav) → MEDIUM compatibility

---

## How to seed this data

**Path A — Manual via browser (60-90 min Friday morning):**
1. Sign up as +919999999999 → fill ALL profile sections per data above
2. Upload 3 photos for User 1 (use Unsplash royalty-free Indian male)
3. Sign up as +918120684036 → fill User 2 data
4. Upload photos for User 2 (Unsplash royalty-free Indian female)
5. Have User 1 send interest to User 2 → User 2 accept → chat created

**Path B — Seed script (~30 min agent prompt Friday morning):**
- Single agent task that POSTs to api endpoints with above data
- Idempotent (can re-run safely)
- Use prod admin credentials or test-account-grant

Path A is more reliable for first demo because we control what shows.
Path B is faster but might fail on subtle endpoint requirements.

**Recommendation: Path A.** 60 min of clicking is worth knowing the 
demo runs through cleanly.

---

## Pre-demo checklist Saturday morning

- [ ] User 1 profile = 100% complete
- [ ] User 2 profile = 100% complete  
- [ ] User 3 profile = 100% complete (optional)
- [ ] Photos visible (no broken image icons)
- [ ] DPI scores generated for each pair
- [ ] FII compatibility computed
- [ ] Interest sent + accepted between User 1 and User 2
- [ ] Chat has at least 2 messages exchanged
- [ ] Wedding created on User 1 account
- [ ] At least 2 guests added to wedding
- [ ] Catering FAQ generated (requires RSVPs)
- [ ] All Phase 3 endpoints return data (not 404 or 401)
- [ ] No console errors on any page visited