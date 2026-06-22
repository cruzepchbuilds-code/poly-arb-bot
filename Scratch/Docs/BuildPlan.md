# Scratch — Build Plan

## 7-Day Sprint: Working Prototype

| Day | Goal |
|-----|------|
| 1 | Xcode project setup, all Swift files added, app boots with onboarding |
| 2 | Complete onboarding flow, local data persistence, all tabs navigate |
| 3 | Home tab fully functional: add round, weekly plan, AI insight |
| 4 | Coach tab: full chat UI, suggested prompts, mock AI responses |
| 5 | Swing tab: video picker, mock analysis, analysis result sheet |
| 6 | Progress tab: charts, milestones, leaker breakdown |
| 7 | Profile + Paywall UI, subscription gating, TestFlight build |

**End of Day 7:** A demo-ready app with mock AI and no backend dependency.

---

## 30-Day MVP

### Week 1 (Days 1–7)
See 7-Day Sprint above.

### Week 2 (Days 8–14): AI Integration
- Wire `AnthropicAIService` (Claude API) into CoachView
- Implement real swing video upload to cloud storage (Supabase Storage or S3)
- Build actual swing analysis prompt pipeline using vision API
- Connect `generatePracticePlan` to real AI output
- Rate limiting + error handling for API calls

### Week 3 (Days 15–21): Polish + Persistence
- Migrate storage from UserDefaults to Supabase (or keep local for v1)
- Add user authentication (Apple Sign-In)
- App icon, launch screen, custom fonts
- Haptic feedback on key actions
- Smooth transitions, loading states
- Empty states for all screens

### Week 4 (Days 22–30): Monetization + Review
- Wire RevenueCat (real products in App Store Connect)
- Test purchase flow in Sandbox
- Accessibility audit (Dynamic Type, VoiceOver)
- Fix crashes, edge cases
- TestFlight beta with 10–20 real golfers
- Collect feedback, fix top 3 issues

**End of Day 30:** Beta-ready app with real AI, real payments, real users.

---

## 60-Day App Store Launch

### Days 31–40: Beta Feedback Loop
- Weekly TestFlight builds
- In-app feedback button
- Fix onboarding drop-off (track where users quit)
- A/B test paywall copy
- Refine AI coach tone based on user feedback

### Days 41–50: App Store Prep
- All screenshots (6.5" + 12.9" iPad if targeting iPad)
- App preview video (30 sec max)
- App Store description (see AppStoreListing.md)
- Privacy nutrition label completed
- Support URL live
- Privacy policy URL live

### Days 51–55: Submission
- Final QA pass: all 5 tabs, onboarding, paywall, edge cases
- Submit to App Store Review
- Prepare launch assets (social, Product Hunt, golf communities)

### Days 56–60: Launch
- App Store approval (typical 24–48 hrs)
- Launch day: Product Hunt, golf subreddits, Facebook golf groups
- Press outreach: golf media, tech blogs
- Monitor reviews, respond to support emails
- Push fixes within 48 hrs of launch

**End of Day 60:** Live on the App Store.

---

## What to Fake for V1

These can be mock/hardcoded in the first version without impacting user value:

| Feature | How to Fake |
|---------|-------------|
| Handicap calculation | Use round differentials as estimate |
| Swing video AI analysis | Return hardcoded analysis for demo |
| Practice plan generation | Use pre-written plans based on weakness |
| Weekly AI insight | Rotate from a set of 20 pre-written insights |
| Course rating/slope | Default to 72.0 / 113 |
| GHIN/Arccos/Garmin sync | "Coming soon" placeholder |
| Backend sync | UserDefaults only — local storage |
| Push notifications | Skip entirely for v1 |

---

## What Must Be Real for Launch

These cannot be faked — users will notice:

| Feature | Why It Must Be Real |
|---------|---------------------|
| AI chat (Coach tab) | The core value prop — must respond intelligently |
| Subscription billing | RevenueCat with real App Store products |
| Privacy policy + terms | Required by App Store |
| Camera/photo permissions | Required for swing upload |
| App icon | Required for App Store |
| Onboarding personalization | First impression — must feel real |

---

## What to Delay Until V2

These are valuable but not launch-critical:

| Feature | Notes |
|---------|-------|
| GHIN sync | Complex API, not worth delaying launch |
| Real swing video AI vision | Expensive; mock analysis works for v1 |
| Backend sync (multi-device) | Local storage is fine for v1 |
| Social features (share progress) | Distraction for v1 |
| Apple Watch app | After iOS app is stable |
| Scorecard photo import | Nice to have |
| Lesson booking integration | Partnership required |
| Leaderboard / challenges | Adds complexity, delays launch |
| iPad layout | Can ship iPhone-only |
