# Smart Shaadi UAT — Wednesday 13 May 2026

## Environment
- URL: https://smartshaadi.co.in
- Test phone 1: +919999999999 (prod OTP: 135246)
- Test phone 2: +918120684036 (prod OTP: 135246)
- Browser: Chrome incognito + DevTools mobile mode (iPhone 14 Pro)

## Bug severity legend
- 🔴 BLOCKER — demo cannot proceed, must fix before Sunday
- 🟠 MAJOR — visible problem, fix before demo if possible
- 🟡 MINOR — annoying but not demo-killer
- 🟢 POLISH — nice-to-have

## Critical path — desktop (45 min)

### Auth + Profile
- [ y] Landing page loads, no console errors
- [y ] Sign up flow — phone, OTP, profile setup
- [ need fix] All 6 profile sections save (Personal, Family, Education, Career, Lifestyle, Partner Prefs)
- [ need fix ] Photo upload (R2 storage)
- [ y] Profile completeness % updates correctly

### Matching
- [ partial ] /feed shows compatible profiles
- [y ] Profile detail page — Guna Milan score visible
- [ n] DPI gauge renders
- [n ] FII Family Inclination Index breakdown
- [n ] Behaviour score from Tuesday's work (if surfaced)
- [only one side ] Send interest → switch account → accept
- [yes ] Match scoring uses real data

### Chat
- [y ] /matches → click match → chat opens
- [ n] Send message, see read receipt
- [n ] Conversation coach suggestion appears
- [n ] Emotional score visible somewhere
- [n ] Photo sharing in chat

### Weddings
- [ n] /weddings/new — create wedding
- [ y] Guest management — add 5 guests
- [not ckeck ] RSVP flow works
- [ n] /weddings/[id]/catering — FAQ predictions render
- [ y] Budget tracker
- [ yes but have error in working] Mood board
- [ 404] Tasks/timeline

### Subscriptions
- [ ]n] /settings/billing — 4 plans visible
- [n ] Plan compare layout clean
- [n ] Mock checkout flow (Razorpay live keys not yet)
- [n ] Subscription status reflects on profile

### NEW — Tuesday + Wednesday features
- [y ] /settings/referral — code + copy + activity
- [y but have error ] /assistant page or floating widget renders (mock or real)
- [ y ] /vendor/pipeline (if you have vendor test account)
- [ss] /vendor/leads
- [ share screnshot ] /family/parent-mode dashboard
- [ss ] /family/inbox

### SEO landing pages (public, no auth)
- [n ] /community/marriages-in-bhopal
- [y ] /hindu-matrimony
- [ y] /brahmin-marriage-bureau
- [ y] /pricing
- [ 404] /about (if exists)

## Mobile (15 min — switch to iPhone 14 Pro in DevTools)
- [ not chech deep but look fine ] All critical path pages render at 393px width
- [ n] No horizontal scroll
- [ dont know ] Touch targets ≥ 44px
- [y ] Bottom navigation works
- [ ] Modal/dialog UX clean

## Bugs found (add here as you test)

### 🔴 BLOCKERS

### 🟠 MAJOR

### 🟡 MINOR

### 🟢 POLISH

## Notes & observations
- Auth + Profile
1 profile data is not showing in profile page and Profile Completeness but 7 of 8 sections complete 
2 profile/horoscope is not have option for Kundli Chart Upload and not auto detect DOB from priviues page also horoscope is not advance its very basic  
3 profile/personality is now save anywhere always show no data
4 profile/photos not show photos properly and profile/photos and profile/personality is not showing in row with other pages of profiles
5 all profile data dont have proper update option

- Matching
1 /feed not shoe any data on 999999999 and show data on 8120684036
2 https://smartshaadi.co.in/profiles/b49645ac-3e8b-4e24-b6e6-4ae3889e5cbd not show send button and have console error 
3 all other option are not show as we dont have any profile

Chat
1 /matches/64fa9812-d93b-4b04-ac54-9aceb57a4d2b/compatibility show nothing just as always Some Areas to Discuss
2 /matches show our seed data only 
3 chat and video call not woking give error in video call and show ofline in chat 
4 fix this is critical i think

Weddings
1 /weddings/new give error
2 ON /weddings/[id] edit save button not work for update ceremony 
3 Auspicious Dates (Muhurat) is dummy static not real 
below all tabs work fine 

Subscriptions
1 /settings/billing is empty 

new
1 /assistant is give error Assistant request failed (503)
2 /vendor/pipeline 

seo 
/community/marriages-in-bhopal not found
/about not exits 
other exit but guve erro i share screen shots 
