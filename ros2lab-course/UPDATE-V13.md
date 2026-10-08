# ROS2Lab update V13: access rules, student portal, Log in / Register

This package is built on your saved version, the one with RViz2 and Weeks 7 to 9. Nothing from that version is removed:
- The "core weeks" rule is kept: only Weeks 1 to 6 count for lifetime access and the certificate (`CORE_MODULES` in functions/config.js). Weeks 7 to 9 are optional.
- My course counts Weeks 1 to 6 the same way and labels Weeks 7 to 9 "Optional advanced track".
- The RViz page has the new header (Log in / Register, or My course / My account / Log out) and appears in the sitemap.

## What changed

**Registration and log in**
- The "I am over 18" box is gone. Students tick one box: *I agree to the Terms of Use and the Privacy Notice*. There is a new standard **Terms of Use** page (terms.html).
- Every password box has a **Show / Hide** button (register, log in). The register page also says when the two passwords match.
- Every public page has separate **Log in** and **Register** buttons. Once someone is logged in, these change to **My course · My account · Log out**.
- Logged-in students see a new notice the first time after this update and tick "I agree" once, because the terms changed.
- The privacy notice no longer says "independent" or "not affiliated with … any college or university".

**Access rules (enforced on the server)**
- **Exactly 60 days:** every approved registration gets 60 × 24 hours from approval.
  - Finishing every lesson of Weeks 1 to 6 and scoring at least 60% in each of their tests inside that time keeps the course open for life.
  - Otherwise the registration is **cancelled automatically**. A job checks this every hour, and the course closes at the exact end time anyway.
- **Extra time:** in the first registration only, a student can ask once, with a reason. You approve 1 to 30 days (added to the original end date) or refuse.
  - While a request is waiting, the registration is not cancelled; your decision comes first.
  - If you refuse after the end date, the registration is cancelled at once.
- **Re-registration:** after cancellation a student can ask to register again.
  - You must approve every request (never automatic).
  - It always starts afresh (old lessons, tests and project cleared) and gives exactly 60 days with no extra time.
  - At most **2 re-registrations**. After that, requests are rejected automatically and you cannot approve one by mistake.
  - Refusing a request does not use one up.
- **First registration record:** the email, name and college of the first registration are saved and never change. You see them on every registration card.
  - A small registration record per email address is kept even if the student deletes the account. So deleting and signing up again with the same email (including Gmail dots and +aliases) does not reset the limits.
  - Registration cards also warn when another account has the same name and college.

**The "61 days" bug**
The course page counted days from the phone's clock. When a phone was a few minutes behind the server, a fresh 60-day registration showed "61 days". Days are now counted from the server's start date and capped, so a new registration shows **Day 1 of 60 · 60 days left**.

**Student portal**
Student pages have a top menu: **Home · My course · My account · Playground**.
- **My course** is a dashboard with:
  - five summary cards: days left, lessons, tests passed, project and certificate;
  - tabs: **Overview** (countdown ring, next step, milestone timeline, extra-time request), **Lessons**, **Tests & scores** (best score, percent, attempts, last attempt; take or review a test) and **Project & certificate**.
- **My account** shows:
  - the profile and registration details (registration N, re-registrations left, access period, days left, extra time);
  - the first-registration record and the certificate;
  - a password reset email, Log out, and Delete account.

**Instructor dashboard**
- New **Extra time** tab: read the reason and progress, choose the days (≤ 30), approve or refuse with a note.
- **Registrations** has:
  - re-registration N of 2, always fresh (the old "Start fresh" box is gone);
  - the first-registration record and a possible second-account warning;
  - a new "Cancelled" filter.
- **Students** shows days left within the current period. A student's details show the registration history and any waiting request for extra time.
  - The old +7/+15/+30 days buttons are removed, because extra time is now only given on request.

**Also fixed**
- The link-preview image (og-card.jpg) and its tags were missing from your upload; they are back.
- The 404 page now loads its styles at any address.
- Footers have a Terms of Use link.
- The sitemap now lists the Terms and Playground pages, and drops the private course page.
- Finishing the lessons alone can no longer give lifetime access when no test is open yet.

## How to install

1. Unzip `ros2lab-v13-on-saved-version.zip` over your saved `C:\ros2lab-course` folder (the RViz2 / Weeks 7 to 9 version), replacing files.
2. Open a Command Prompt in `C:\ros2lab-course` and deploy **in this order**:

```
firebase deploy --only firestore
set FUNCTIONS_DISCOVERY_TIMEOUT=120
firebase deploy --only functions
firebase deploy --only hosting
```

- `firestore` uploads the new rules and a new index (users: status + accessUntil). Wait about 5 minutes for the index to finish building (Firebase console → Firestore → Indexes).
- `functions` adds **endAccessHourly**, **requestExtension** and **adminDecideExtension**. It asks to delete **adminExtendAccess**: type **Y**. That function is no longer used.

3. Check on your phone:
   - Log in as a student. You should see the "We have updated our terms" box once, then My course with the correct days.
   - Open My account.
   - In the instructor dashboard, open the Extra time tab.

## Notes
- Students already in the course keep their current end date. Anyone approved before access periods existed gets 60 days from the first daily run.
- Students under 18: the Terms ask them to register with a parent's or guardian's consent (India's DPDP Act requires this for minors).
- The limits are stored in `functions/config.js`: `ACCESS_DAYS = 60`, `MAX_EXTENSION_DAYS = 30`, `MAX_REREGISTRATIONS = 2`, `CORE_MODULES`. If you change `CORE_MODULES`, also change the same list at the top of `public/js/course.js`.
