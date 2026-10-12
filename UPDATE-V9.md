> **Use UPDATE-V10.md to deploy.** It includes everything below. This file only describes the v9 features.

# Publishing the v9 update: new registration form, 60-day access, personal projects, certificates, stronger security

This update works on top of **v8**. Student accounts, progress and test results are kept. Plan about 30 minutes.

## What's new

### Registration form: students, graduates and working people
- **Semester and USN removed.** The first question is now "Which describes you best?":
  - **Studying now (UG, PG or PhD):** college, programme (BE/BTech, ME/MTech, MSc, PhD…), department, expected year of passing.
  - **Finished studies:** college, programme, department, year of passing.
  - **Working** (faculty, research scholar, research assistant, industry): institution or company, designation, optional department. **No year of passing.**
- The name entered here is printed on the certificate.
- Students who registered earlier keep their old details. If they edit them, they are asked to choose a category.

### 60-day access
- Approval gives **60 days** of access to lessons, tests and the project.
  - In "auto" mode, approval happens at registration.
  - The 60 days start at approval, so a student waiting for you to approve does not lose days.
- The course page shows a countdown. It turns red with 10 days left.
- **When the 60 days end, access stops immediately.** The date is inside the student's sign-in token and is checked by the database rules and the server.
- After that, the student sees **"Ask for a new registration."**
  - This request **always waits for your approval**, even in auto mode. It appears in **Instructor → Registrations**.
  - When approving, you may tick **Start fresh** to delete their old lesson progress, test attempts and project. Their certificate, if they have one, stays.
- A daily job (00:30 IST) marks ended accounts as "access ended".
  - **Students approved before this update** get their 60 days starting from the first run of this job, which is the night after you deploy.
- In the student details (**Students → click a student**) you can give **+7, +15 or +30 days** for genuine cases.
- The setting is `ACCESS_DAYS` in `functions/config.js`.

### Personal final project
- When a student finishes every lesson, **"Get my project"** gives them their own project brief.
  - There are 10 project types, built on TurtleSim: polygon, patrol, battery guard, service switch, spawner, safety filter, custom message, action, follower and parameter spiral.
  - Robot names, numbers, topics and limits are random. In a test of 3,000 students, 2,607 briefs were different. Two students sitting together almost never get the same project.
- Students submit in **Python or C++**. Each submission has:
  - up to 15 files;
  - a report;
  - optional terminal output and an optional video link.
- **Two submissions at most.** You mark each one in **Instructor → Projects** with a 100-mark scheme:
  - works as specified: 40;
  - exact interfaces: 15;
  - code quality: 20;
  - launch and YAML: 10;
  - report: 15.
- **80 or more passes.** Below 80, the student sees your feedback and may submit once more. After two fails the project is marked failed.
  - For a genuine problem (for example, a wrong file uploaded), use **Allow one more submission**.
- Use **Download all files (.txt)** to copy a submission to your Jazzy machine and run it.

### Certificates
Replaced in v10: students apply, you sign, then they download. See **UPDATE-V10.md**.

### Tracking progress (Instructor → Students)
- The table has new columns:
  - Category
  - Days of access left (flagged red at 7 days or fewer)
  - Project status and score
  - Certificate ID
- The category filter replaces the semester filter. The status filter now includes "access ended". The CSV export includes the new columns.

### Screenshots
- **No website can block screenshots on a phone.** Android and iPhone screenshots never reach the web page. Only a native app can block them on Android, and iPhones cannot block them at all.
- What the site does instead:
  - Every lesson and test page is covered with a light watermark showing the **student's name, email and date**. The watermark is stronger on phones.
  - If someone deletes the watermark with developer tools, it comes back.
  - A leaked screenshot therefore shows who took it.
- The laptop screenshot blocking from v8 stays.

### Security
- Hosting headers:
  - The Content-Security-Policy now allows only the exact Pyodide version used, plus Google Analytics. The old policy blocked Analytics, so visit counts were not being recorded.
  - HSTS is now 2 years, including subdomains.
  - New Cross-Origin-Opener and Cross-Origin-Resource policies, and `upgrade-insecure-requests`.
- `.bak` files are no longer published.
- New database rules:
  - Projects and certificates can be written only by the server.
  - Certificates can be opened only by their exact ID; nobody can list them.
  - Expired students cannot read course content.
- Server checks:
  - Every new server function checks sign-in, approval and the access date.
  - File names, sizes and links in project submissions are checked; for example, `../` paths and `javascript:` links are refused.
- Privacy notice updated (version 2026-10-v9):
  - the new details asked at registration;
  - projects, certificates and the 60-day access;
  - Google Analytics.

## Changed and new files
```
README.md
UPDATE-V9.md                      (new)
firebase.json
firestore.rules
functions/config.js
functions/index.js
functions/projects.js             (new)
functions/test/run-tests.js
public/certificate.html           (new)
public/project.html               (new)
public/css/app.css
public/index.html
public/playground.html
public/privacy.html
public/resources.html
public/js/admin.js
public/js/certificate.js          (new)
public/js/common.js
public/js/course.js
public/js/fb.js
public/js/firebase-config.js
public/js/lesson.js
public/js/project.js              (new)
public/js/register.js
public/js/test.js
```

## Steps

1. **Copy the files.** Unzip `ros2lab-v9-changed-files.zip` and copy its `ros2lab-course` folder over `C:\ros2lab-course`. Say **Yes** to replacing files.
   - Your `firebase-config.js` in the zip already contains your keys and the Analytics ID.
   - `REGISTRATION_MODE` stays `"auto"`.

2. **Delete the old backup file** (the zip cannot delete files for you):
   ```
   del C:\ros2lab-course\public\js\lesson-render.js.2026-10-02T14-20-56-626Z.bak
   ```

3. **Update the server libraries and run the checks:**
   ```
   cd C:\ros2lab-course\functions
   npm audit fix
   npm test
   ```
   The checks must end with **All checks passed**.

4. **Publish the rules, the server code and the website, in this order:**
   ```
   cd C:\ros2lab-course
   firebase deploy --only firestore
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
   If the functions deploy asks to enable **Cloud Scheduler**, say **Yes**. The daily access check needs it.

5. **Check it as the instructor.** Open www.ros2lab.com/admin.html and press **Ctrl + F5**.
   - You should see the tabs **Registrations, Students, Projects, Tests, Course content, Help**.

6. **Check it as a student.** Register a test account in a private window.
   - Choose **"I am working"**. There should be no year of passing.
   - On the course page, check the countdown and **"Your path to the certificate"**.

7. **Optional: preview a certificate.** Mark a test student's project (Projects tab) with 80 or more after they have passed all tests. Then open the certificate link shown in the Students tab.

## Strongly recommended security settings (Firebase and Google consoles, 15 minutes)

These are settings only you can change; code cannot change them.

1. **Protect your Google account.** It controls the whole project. Turn on **2-Step Verification** at https://myaccount.google.com/security.
2. **Instructor password.** Use a long, unique password (16+ characters) for prasadprabhu145@gmail.com on ROS2Lab, and use it nowhere else.
3. **Firebase console → Authentication → Settings:**
   - **User actions:** turn on **Email enumeration protection**.
   - **Password policy:** require at least 10 characters, with letters and numbers.
   - **Authorized domains:** keep only `ros2lab.com`, `www.ros2lab.com`, `ros2lab.web.app` and `ros2lab.firebaseapp.com`. Delete `localhost`.
4. **Restrict the web API key.**
   - Go to https://console.cloud.google.com → project **ros2lab** → **APIs & Services → Credentials** → the **Browser key** → **Application restrictions: Websites**.
   - Add:
     ```
     https://www.ros2lab.com/*
     https://ros2lab.com/*
     https://ros2lab.web.app/*
     https://ros2lab.firebaseapp.com/*
     ```
   - Save. Then sign in on the site once to confirm it still works.
5. **App Check** blocks scripts and bots that are not your website.
   - Follow **SETUP-GUIDE.md, Part 11** to create the reCAPTCHA Enterprise key.
   - Put the key in `public/js/firebase-config.js` (`RECAPTCHA_ENTERPRISE_SITE_KEY`).
   - Set `ENFORCE_APP_CHECK = true` in `functions/config.js`.
   - Deploy hosting and functions, then click **Enforce** for Firestore in **App Check**.
6. **Budget alert:** keep the one you set (₹1,000/month with email at 50%, 90% and 100%).

## Good to know
- **Changing the rules:** pass marks, access days and the certificate text are all in `functions/config.js`. After a change, run `firebase deploy --only functions`.
- **Certificates and account deletion:** a student who deletes their account also deletes their certificate, which then no longer verifies. The privacy notice says this.
- **Marking turnaround:** the student's 60 days keep running while you mark, but a project marked late still produces the certificate. Try to mark within a few days so a student who fails has time to resubmit.
