# ROS2Lab: step-by-step publishing guide

This guide puts the course **"ROS 2 from zero, in two weeks"** online at **www.ros2lab.com**, with open registration and college-ID approval.

You can test everything on the free Firebase address (`https://YOUR-PROJECT-ID.web.app`) before www.ros2lab.com points to it, so nothing breaks while you set up.

**Which parts to do:**
- **First time setting up Firebase:** do every part in order. Plan about 3 hours, plus waiting time for DNS.
- **Already set up the previous version (single-college Google sign-in):** skip Parts 1, 2, 4, 6 and 13. Everything you already have keeps working.

> Firebase console menus move a little from time to time. If a button has a slightly different name, use the closest match or the console's search box.

---

## What changed from the previous version

| Before | Now |
|---|---|
| "Sign in with Google", one college's accounts only | Email and password; students from **any college** can register |
| Anyone with that college's account got in | Students upload their **college ID card**; you approve or reject each one |
| Modules A and B (16 lessons) | **2-week course: 24 lessons over 10 days**, plus a Week 1 test and a Week 2 test |
| No file storage | ID card photos in private Cloud Storage (Mumbai), **deleted after review** |

---

## Choose how students get access (one setting)

| `REGISTRATION_MODE` | What students do | What you do |
|---|---|---|
| `"id-card"` (default) | Register, verify email, add college details, upload a college ID card photo | Approve or reject each student in **Registrations**, comparing the ID card with the details |
| `"manual"` | Register, verify email, add college details (no photo) | Approve or reject each student from their details only |
| `"auto"` | Register, verify email, add college details | Nothing: students start the course immediately |

**To change it,** set the **same** value in **both** files, then deploy hosting and functions:

```
functions\config.js          const REGISTRATION_MODE = "manual";
public\js\firebase-config.js export const REGISTRATION_MODE = "manual";
```

**If you choose `"manual"` or `"auto"`:**
- **Skip Part 5** (Storage). It is only needed for ID card photos.
- **In Part 8,** publish with `firebase deploy --only firestore`, not `--only firestore,storage`. Always use the `--only` commands from this guide; a plain `firebase deploy` would look for Storage.
- **In Part 11,** skip the rows about the ID card photo.
- **In `"auto"` mode,** there is no Registrations tab, and Part 14 has no daily review. Anyone with a verified email can study the course, so treat the lessons as public. Tests still give every student a different paper.

**Switching after students have registered:**
- **Leaving `"id-card"` or `"manual"`:** first approve or reject everyone still waiting in Registrations.
- **Switching to `"auto"`:** students who were already pending stay pending until you approve them.

---

## Part 0. Decide two things first

1. **You are responsible for the data.** ROS2Lab is an independent project, developed by the Robotics and ROS2 lab Channel and run on your own Google account, domain and billing. So you are responsible for the students' data (under India's DPDP Act). Keep every account in your own name, not an employer's.
2. **The contact email** shown to students. It is set to `prasadprabhu145@gmail.com` in:
   - `public/privacy.html`;
   - `public/js/firebase-config.js` (`CONTACT_EMAIL`).

   Change both if needed.

## Part 1. Create the Firebase project (first time only)

1. Open <https://console.firebase.google.com> and sign in with your instructor Google account.
2. Click **Create a project**. Name it `ros2lab`.
3. Note the **Project ID** shown under the name.
4. Turn Google Analytics **off**, then click **Create project**.

## Part 2. Register the website (first time only)

1. In the project, click the **Web** icon `</>`. Nickname: `ros2lab-web`. Click **Register app**.
2. Keep the page that shows `firebaseConfig = { ... }` open. You need it in Part 7.

## Part 3. Set up email and password accounts

In the Firebase console, open **Authentication**.

1. **Sign-in method** tab → **Email/Password** → switch **Email/Password** on (leave "Email link" off) → **Save**.
   - Upgrading? You may switch **Google** off now; the new site doesn't use it.
2. **Settings** tab → **Authorized domains**: make sure `ros2lab.com` and `www.ros2lab.com` are listed.
3. **Settings** tab: if you see **Upgrade to Firebase Authentication with Identity Platform**, click it.
   - This upgrade is required for the sign-up checks.
   - It is free at this scale.
   - Skip it if you already did it.
4. **Settings → Password policy**:
   - turn on enforcement as **Require**;
   - minimum length **10**;
   - tick **Require numeric character**.
5. **Settings → User actions**: make sure **Email enumeration protection** is **on**. It stops strangers from finding out which emails are registered.
6. **Templates** tab → **Email address verification**:
   - set the sender name to `ROS2Lab`;
   - set the subject to `Verify your email for ROS2Lab`.

   Do the same for **Password reset**.

## Part 4. Create the database (first time only)

1. **Firestore Database → Create database**.
2. Location: **asia-south1 (Mumbai)**.
3. **Start in production mode** → **Create**.

## Part 5. Turn on file storage for ID cards (only for `"id-card"` mode)

1. **Storage** (sometimes under **Build**) → **Get started**.
2. Location: **asia-south1 (Mumbai)**.
3. **Start in production mode** → **Done**.

Storage needs the Blaze plan (Part 6). Expected cost: a few rupees per month at most, because photos are small and deleted after review.

## Part 6. Blaze plan and a spending alert (first time only)

1. Bottom-left of the Firebase console: **Upgrade → Blaze**, and link a billing account.
2. In <https://console.cloud.google.com/billing>, open **Budgets & alerts → Create budget**:
   - amount **₹200**;
   - alerts at **50%, 90% and 100%**.

## Part 7. Prepare the folder on your Windows laptop

1. **First time only:** install Node.js 22 LTS from <https://nodejs.org>. Then, in **Command Prompt** (not PowerShell), run:
   ```
   npm install -g firebase-tools
   firebase login
   ```
2. Unzip `ros2lab-course.zip` to `C:\ros2lab-course` (avoid OneDrive folders).
   - Upgrading? Copy your three edited files from the old folder (step 3) into the new folder first.
3. Edit with Notepad:
   - `public\js\firebase-config.js`: paste your values from Part 2 over every `PASTE-...`, keeping the quotes.
   - `.firebaserc`: put your Project ID.
   - `functions\config.js`: check `ADMIN_EMAILS`. It must be the email you will register with as instructor, in small letters.
   - **`REGISTRATION_MODE`:** set the same value in `functions\config.js` and `public\js\firebase-config.js` (see "Choose how students get access" above).

## Part 8. Test and publish

In Command Prompt:

```
cd C:\ros2lab-course\functions
npm install
npm test
```

`npm test` must end with **All checks passed**. It checks all 77 question templates and confirms that 200 students get 200 different papers.

Then publish, in this order:

```
cd C:\ros2lab-course
firebase deploy --only firestore,storage
firebase deploy --only functions
firebase deploy --only hosting
```

In `"manual"` or `"auto"` mode, use `firebase deploy --only firestore` as the first command instead (no Storage).

- **First functions deploy:** it can take 5–10 minutes. If it fails with an "API not enabled" or permissions message, wait 5 minutes and run it again.
- **Container images question:** if it asks how long to keep container images, press Enter.

Then check **Authentication → Settings → Blocking functions**. You should see:
- `beforecreated` under **Before account creation**;
- `beforesignedin` under **Before sign in**.

## Part 9. Create your instructor account

1. Open your Hosting address (for example `https://ros2lab.web.app`) and click **Register for free**.
2. Register with the email in `ADMIN_EMAILS`, open the verification email, and click the link.
3. **Don't fill in the college details form.** Click **Sign out** (top right), then **Sign in** again.
   - You land on the **Instructor dashboard**.
   - If you still see the registration steps, sign out and in once more.

## Part 10. Upload the course and open the tests

1. **Instructor → Course content** → choose `content\course-content.json` → **Upload**.
   - This creates Week 1 (9 lessons) and Week 2 (15 lessons).
   - Upgrading? The old Modules A/B are removed, and the old tests are unpublished; their results are kept.
2. **Tests** tab. For **Week 1 test** and **Week 2 test**:
   - set the opening and closing times;
   - suggested: 35 minutes, 2 attempts, answers shown "After the test closes";
   - tick **Published**, then click **Save test settings**.
3. Click **My course** (or open `course.html`) to see the student view. As instructor you can open every lesson and preview tests without finishing the lessons.

## Part 11. Pilot test before announcing

Use one personal Gmail account as a test student, and ask one or two real students to help.

| Check | Expected result |
|---|---|
| Register with an email from a temporary-mail site (e.g. mailinator) | Refused |
| Register with a normal email | Verification email arrives (check Spam) |
| Before clicking the link, press "I have clicked the link" | "Your email is not verified yet" |
| After verifying: details form, then ID card photo from a phone | Photo preview, then "Your registration is being checked" |
| Open `course.html` before approval | Sent back to the registration status page |
| Instructor → Registrations | The student appears with the ID card next to the details |
| Approve | Student's page switches to the course by itself within a few seconds |
| Reject another test account with a reason | That student sees the reason and can upload again (3 uploads in total) |
| Firebase console → Storage, after a decision | The ID card photo is gone |
| Student: My account → Delete my account | Account and data deleted; sign-in page confirms |
| Do one lesson and the Week 1 test | Progress and score appear in Instructor → Students |

## Part 12. Announce the course

Share **https://www.ros2lab.com** (or your `.web.app` address until Part 13 is done) with a short message, for example:

> ROS2Lab is a free 2-week online course: Ubuntu, Python and C++ from zero, then ROS 2 Jazzy installation and lab setup. Register at www.ros2lab.com with your email, and keep a photo of your college ID card ready. Registrations are approved within 1–2 working days.

**Registering a whole class at once:** Firebase limits sign-ups from one internet connection per hour. If a full class will register together on college Wi-Fi, temporarily raise the sign-up limit first: Authentication → Settings, look for **sign-up quota**.

## Part 13. Move www.ros2lab.com to the new site (first time only)

Do this only after Part 11 works on the `.web.app` address.

1. **Hosting → Add custom domain** → `www.ros2lab.com`. Add `ros2lab.com` too, and choose **redirect** to `www.ros2lab.com`.
2. In **GoDaddy → DNS**:
   - **Delete:** the four GitHub A records (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`), the CNAME `www → prasad914.github.io`, and the CNAME `_acme-challenge`.
   - **Add:** exactly the records Firebase shows.
   - **Keep:** NS, SOA and `_domainconnect`.
3. Wait until Firebase shows **Connected** (a few hours, sometimes 24–48 hours).
4. In GitHub, remove the custom domain from the old `ros2lab` repository, then delete it or make it private.

## Part 14. Everyday work

- **Registrations:** review them every working day. For each one:
  - compare the name, college, USN and validity date with the details;
  - approve, or reject with a reason.

  Each photo is deleted automatically after your decision, and any photo left unreviewed is deleted after 30 days.
- **Students:** progress, study time, scores and flags, filtered by status and semester. **Download CSV** opens in Excel.
- **Flags** (leaving the test page, paste attempts) are clues, not proof.
- **Cancel attempt:** for power cuts or network failures during a test.
- **Changing lessons:**
  1. Edit `content\course-content.json` (or ask Claude for the next lesson).
  2. Preview it with `npx http-server -c-1 -p 8080` and <http://localhost:8080/tools/preview.html>.
  3. Upload it from Course content.
- **Changing test questions:** edit `functions\questions\*.js`, run `npm test`, then `firebase deploy --only functions`.

## Part 15. Optional extras

- **App Check (after the first week):** it blocks scripts and bots.
  1. Firebase → **App Check** → register the web app with **reCAPTCHA Enterprise**.
  2. Put the site key into `RECAPTCHA_ENTERPRISE_SITE_KEY` in `public\js\firebase-config.js`, then deploy hosting.
  3. Watch the metrics for a few days.
  4. Set `ENFORCE_APP_CHECK = true` in `functions\config.js` and deploy functions.
  5. Click **Enforce** for Firestore and Storage.
- **Email notifications on approval:** by default, students see their status on the website. To also send emails, install the Firebase **Trigger Email** extension with an SMTP account. This is optional, and not needed to run the course.

---

## Keep these safe

- **Never upload this folder to a public GitHub repository.** It contains all lessons and the question templates.
- Turn on **2-Step Verification** for the instructor's email account.
- Don't approve anyone whose card you cannot read clearly. Ask them to upload again.
- **Don't accept Aadhaar.** The upload page already tells students to send only the college ID card.

## Troubleshooting

| Problem | Fix |
|---|---|
| Verification email doesn't arrive | Check Spam/Promotions; press "Send the email again"; check Authentication → Templates |
| "Too many attempts" during a class registration session | Raise the sign-up quota (Part 12) or wait an hour |
| Student's ID upload fails | Check Storage is created (Part 5) and `firebase deploy --only storage` was run |
| You see the student registration form instead of the dashboard | Your email must be in `ADMIN_EMAILS` exactly; deploy functions; sign out and sign in again |
| Course page says "No lessons yet" | Upload `course-content.json` (Part 10) |
| A test says "not available" | Tick **Published** and check the dates in Tests |
| `'firebase' is not recognized` | Reopen Command Prompt after installing Node.js, or use `npx firebase-tools` |
| See server errors | `firebase functions:log`, or Google Cloud console → Logging |
