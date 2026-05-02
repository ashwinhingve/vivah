# AWS SES (Production) — Activation Runbook

---

## What it does in vivahOS

Transactional email:
- Booking confirmations + receipts
- Dispute resolution updates
- Wedding invitation digests
- KYC verification status emails
- Match request notifications (if user opted into email)
- Vendor onboarding emails
- Admin alerts

Code reference: `apps/api/src/notifications/providers/ses.ts`, `apps/api/src/notifications/templates/email.ts`.

---

## Lead time

**1–2 weeks** dominated by AWS SES production access (sandbox lift) review.

Breakdown:
- Day 0: AWS account + SES enabled in `ap-south-1`
- Day 0–1: Domain DKIM + SPF + DMARC published in DNS
- Day 1–2: Submit production access request
- Day 2–14: AWS reviews (typically 1–3 days; can be longer)

---

## What we need from the client

### Domain
- [ ] **Confirm domain ownership.** `smartshaadi.co.in` registered, DNS managed by Cloudflare or Route 53
- [ ] **Add DKIM records.** AWS provides 3 CNAME records; client adds them in DNS
- [ ] **Add SPF record.** `v=spf1 include:amazonses.com ~all`
- [ ] **Add DMARC record.** `v=DMARC1; p=quarantine; rua=mailto:dmarc@smartshaadi.co.in`

### AWS account
- [ ] AWS account with billing set up. **Recommendation:** client owns billing; developer is IAM admin.
- [ ] Region locked to `ap-south-1` (Mumbai) for data residency
- [ ] **From-address verified** — `noreply@smartshaadi.co.in`, `support@smartshaadi.co.in`

### Sandbox lift request
- [ ] Justification document — we draft, client reviews:
  - Use case: transactional email only
  - Volume: ~50k/month at launch, growing to 500k/month
  - Bounce/complaint handling: SES events → SNS → our webhook → notification preferences updated
  - Opt-out: every email has unsubscribe link (legal requirement)
- [ ] Submit via AWS Support Center
- [ ] Respond to AWS clarification questions within 24h (they often ask about list hygiene)

### Hand over to developer
- [ ] **`AWS_SES_ACCESS_KEY`**
- [ ] **`AWS_SES_SECRET_KEY`**
- [ ] **`AWS_SES_REGION`** = `ap-south-1`
- [ ] Confirmation that production access is granted (email from AWS)

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set AWS_SES_ACCESS_KEY=AKIAxxxxx
railway env set AWS_SES_SECRET_KEY=xxxxx
railway env set AWS_SES_REGION=ap-south-1

# 2. Flip mock
railway env set USE_SES_MOCK=false

# 3. Deploy + smoke
git push origin main
pnpm test:provider:ses -- --live
# Sends test email to developer's address; asserts SMTP 200 + bounce webhook handler reachable

# 4. Configure SES bounce + complaint webhook
# - In AWS console, add SNS topic for SES events
# - Subscribe: https://api.smartshaadi.co.in/api/v1/notifications/email-events
# - Verify: SES sends a confirmation email; click confirm

# 5. Monitor 24h
# - SES dashboard: bounces <2%, complaints <0.1%
# - If bounce rate spikes, AWS will throttle and eventually suspend
```

---

## Rollback

```bash
railway env set USE_SES_MOCK=true
# Emails print to logs. Past sent emails unaffected.
```

---

## Cost model

| Volume | Cost |
|--------|------|
| First 62k/month from EC2 | Free |
| Beyond 62k/month | $0.10 per 1000 emails (~₹8/1000) |
| Attachments (rare) | $0.12 per GB |

At 10k MAU with ~5 emails/MAU/month: well within free tier.

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Bounce rate >5% | AWS throttles | Audit recipient list quality; pause non-critical emails; AWS may require written remediation plan |
| Complaint rate >0.5% | AWS suspends | Critical — request reinstatement with proof of opt-in; rebuild list trust |
| `MessageRejected` errors | Sentry | Likely DKIM / SPF misconfig; verify DNS in AWS dashboard |
| Cold-start sender reputation | First 1000 emails per day land in spam | Warm up gradually over 2 weeks; start with 50/day, double daily |

---

## Critical gotcha — sandbox vs production

Until AWS grants production access, SES will only deliver to **verified addresses**. Adding the developer's email + Col. Deepak's email as verified is fine for internal testing. But going live with real customers requires the sandbox lift — there's no workaround.
