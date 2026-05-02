# Provider Activation Timeline (Visual)

> Visual companion to `README.md`. Shows when each provider goes live if all client-side actions start on Day 0.

---

## Optimistic timeline (parallel client actions)

If Col. Deepak signs everything on Day 0:

```
Week    │ 0       1       2       3       4       5       6       7       8
─────────┼────────────────────────────────────────────────────────────────────
Daily.co │ ●─live (Day 1)
FCM      │ ●─live (Day 1)
Rekog.   │ ●─live (Day 1)
Razorpay │ ──●─live (Day 5)
SES      │ ────●─live (Day 10)
Karza    │ ───────●─live (Day 14)
MSG91    │ ───────●─live (Day 14)
NSDL     │ ──────────●─live (Day 18)
DigiLkr  │ ──────────────●─live (Day 28)
Refiniti │ ──────────────────●─live (Day 35)
```

**Reading:** each `─` is a day where client / provider work happens. `●─live` is the day we flip the env flag and that provider's real flow activates.

---

## Realistic timeline (sequential client actions)

In practice, the client signs one provider at a time. This stretches everything:

```
Week    │ 0       1       2       3       4       5       6       7       8       9       10
─────────┼─────────────────────────────────────────────────────────────────────────────────────────
Razorpay │ ──●─live (Day 5)
Daily.co │      ●─live (Day 8)
FCM      │      ●─live (Day 8)
Rekog.   │      ●─live (Day 8)
SES      │           ────●─live (Day 18)
Karza    │                   ────●─live (Day 28)
MSG91    │                       ────●─live (Day 32)
NSDL     │                            ────●─live (Day 38)
DigiLkr  │                                ─────────●─live (Day 56)
Refiniti │                                          ─────────●─live (Day 70)
```

**Reading:** Razorpay first (highest priority, fastest revenue), then the trio of 1-day activations (Daily, FCM, Rekognition), then the medium-lead-time providers, finally DigiLocker and Refinitiv.

---

## Gantt-style breakdown per provider

### Razorpay LIVE
```
Day 0      Sign merchant agreement, upload KYC
Day 1      KYC review by Razorpay risk team
Day 2      Bank penny-drop
Day 3-4    Internal review
Day 5      LIVE keys issued → switch on
```

### MSG91 + DLT
```
Day 0      MSG91 signup
Day 1-2    DLT registration on 4 telcos (Jio/Airtel/Vi/BSNL)
Day 3-7    Telco PE ID issuance
Day 7-12   Template approvals (parallel per template)
Day 12-14  All templates approved → switch on
```

### AWS SES
```
Day 0      AWS account ready, SES enabled in ap-south-1
Day 1      DKIM/SPF/DMARC published in DNS
Day 2      Sandbox lift request submitted
Day 3-10   AWS reviews
Day 10     Production access granted → switch on
```

### DigiLocker
```
Day 0      Partner application submitted
Day 1-7    RSA key pair generated, public key uploaded
Day 7-14   Government review (MeitY)
Day 14-21  MoU drafted
Day 21-28  Legal review + signing
Day 28     Sandbox credentials issued
Day 28-35  Sandbox testing (us)
Day 35     Production credentials → switch on
```

### NSDL PAN
```
Day 0      NSDL e-Gov onboarding form
Day 1-7    Documents reviewed, fee paid
Day 7-14   IP whitelisting (Railway egress IPs)
Day 14-18  Sandbox → production credentials → switch on
```

### Refinitiv WorldCheck One
```
Day 0-7    Sales engagement, demo, quote
Day 7-21   Contract negotiation
Day 21-28  Contract signed, first payment
Day 28-35  Sandbox credentials issued, sandbox testing
Day 35     Production credentials → switch on
```

### Karza criminal
```
Day 0      Vendor selection (Karza recommended)
Day 1-7    Sales call, contract review
Day 7-12   Contract signed, sandbox credentials
Day 12-14  Async webhook integration tested → switch on
```

### Daily.co paid
```
Day 0      Plan upgrade ($99/mo)
Day 0      Custom domain CNAME added
Day 1      Webhook registered → switch on
```

### Firebase FCM
```
Day 0      Firebase project creation
Day 1      Service account JSON shared, VAPID key in Vercel → switch on
```

### AWS Rekognition
```
Day 0      IAM user + policies created
Day 1      Face collection created → switch on
```

---

## Critical-path observations

- **Razorpay** is the lone provider whose lead time is set by *Razorpay's* internal review, not the client's documents. As soon as the client uploads docs, the clock is running.
- **DigiLocker** is the longest critical path because of the government MoU step. Start it early, run in parallel.
- **MSG91** depends on DLT registration — a 4-portal serial process unless parallelized. Parallel reduces it from 4 weeks to 2.
- **Refinitiv** is the only provider with a sales cycle. Free tier doesn't exist; the floor is ~$1,500/year. Defer if NRI is not in v1 scope.

---

## Recommended start order

1. **Razorpay LIVE** (Day 0) — fastest revenue, highest visibility
2. **DigiLocker** (Day 0) — start the longest clock immediately, even though it lands last
3. **Daily.co + FCM + Rekognition** (Day 1) — all 1-day activations, batch them
4. **AWS SES** (Day 1) — start sandbox lift; runs in parallel to others
5. **MSG91 + DLT** (Day 1) — start DLT portals; parallelize across telcos
6. **NSDL PAN** (Day 7) — sequential after Razorpay (same docs reused)
7. **Karza criminal** (Day 14) — only if premium KYC tier launches in v1
8. **Refinitiv** (Day 28) — only if NRI corridor or banking partnership planned

If client follows this order, Razorpay ships in Week 1; everything except DigiLocker + Refinitiv ships by Week 4; full KYC stack live by Week 5; Refinitiv by Week 6.

---

## Client-side checklist by week

### Week 1 client work
- Razorpay merchant signup + KYC docs
- Daily.co plan upgrade
- Firebase project creation + service account JSON
- AWS account confirm + IAM user for Rekognition
- DigiLocker partner application + RSA key generation
- AWS SES domain DKIM/SPF/DMARC publish
- MSG91 signup + DLT portal registrations on all 4 telcos
- NSDL onboarding form

### Week 2 client work
- Respond to Razorpay risk team queries (24h turn)
- Respond to AWS sandbox lift questions (24h turn)
- Karza vendor selection + sales call
- Submit MSG91 templates for approval
- Submit AWS production access request

### Week 3-4 client work
- DigiLocker MoU legal review
- DigiLocker MoU signing
- NSDL IP whitelisting (developer provides IPs)
- Karza contract finalization

### Week 5+ (if doing Refinitiv)
- Refinitiv sales engagement
- Refinitiv contract review + signing
- First annual fee paid

---

## Developer-side work per provider

Each provider switch-on is **≤1 day of developer time** once client inputs are received. The work is:
1. Add env vars to Railway/Vercel (15 min)
2. Implement adapter (replace mock — 1–8 hours depending on provider complexity)
3. Run smoke test (15 min)
4. Monitor 24h (passive)

For providers where adapter is already implemented (Razorpay LIVE, AWS SES, Daily.co, FCM): 30 minutes total.

For TODO-stub providers (DigiLocker, NSDL, Karza, Refinitiv): 0.5–1 day each.

Total developer effort across all 11 providers: ~5 days, spread over the activation period.
