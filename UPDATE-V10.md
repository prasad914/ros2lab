# Publishing the v10 update: lifetime access, signed certificates, new certificate design

This update **includes v9**: the new registration form, 60-day access, personal projects, progress tracking and security (described in UPDATE-V9.md). It works whether your site runs v8 or v9. Student accounts and results are kept. Plan about 30 minutes.

## What's new in v10

### Lifetime access
- A student who **finishes every lesson and scores at least 60% in every test within their 60 days** keeps the course for life, to revise whenever they like.
- It is granted automatically in each of these cases:
  - when the student finishes the last test;
  - when they open their course page with everything done;
  - by the nightly check on the day their 60 days end.
- **A student who did not finish in time** still loses access after 60 days. Registering again needs your approval.
- Lifetime students:
  - see a green **Lifetime access** note on their course page;
  - show **lifetime** in the **Days left** column of your Students tab;
  - are never expired by the nightly check.

### Certificates: the student applies, you sign, the student downloads
1. **Applying.** On the course page, **Apply for my certificate** stays **greyed out** until the student has:
   - finished every lesson;
   - scored at least **60% in every test**;
   - scored at least **80% in the project**.

   Under the button the student sees what is still missing. The server checks the same rules again, so the button cannot be forced.
2. **Automatic filling.** When the student applies, everything on the certificate is filled in automatically from the records:
   - name;
   - personal details (programme, department and college, or designation and workplace);
   - **registration date**;
   - **modules completed**;
   - **marks in each test** and their average;
   - **marks in the final project**.
3. **Signing.** Open **Instructor → Certificates**. Each application shows a full preview. You can:
   - correct the spelling of the name;
   - use your saved signature, or upload a different one for that certificate;
   - press **Endorse with my signature and issue**;
   - or press **Return to the student** with a note, for example "check the spelling of your name". The student can then apply again.
4. **Downloading.** Only after you sign can the student open and download the certificate from their course page. They can download it as **one A4 landscape PDF**, add it to LinkedIn, or copy its link.

### Your signature
- At the top of **Instructor → Certificates**, upload a photo or scan of your signature: dark ink on plain white paper.
- The white background is removed automatically, and the image is cropped and saved privately. Only the instructor account can read it.
- It then appears on every certificate you endorse.
- You can replace it at any time, or choose a different image for one certificate.

### Validity: 2 years
- Every certificate shows **Issued** and **Valid until**. Valid until is 2 years after you sign.
- The verification page says **"Genuine and valid"**, or **"Genuine, but expired"** after 2 years.
- The certificate has a **QR code** that opens this verification page.
- To change the 2 years, edit `CERT_VALID_YEARS` in `functions/config.js`.

### The certificate design (based on research into Coursera, NPTEL, NVIDIA, edX and Udacity certificates)
- **Layout:** A4 landscape: an ivory sheet in a deep-navy frame, with a fine gold guilloche ribbon (the security pattern used on degree certificates), a gold hairline, a faint rosette watermark and circuit traces.
- **Logo:** your **Robotics & ROS 2 Lab** channel logo (the ROS coordinate frame), redrawn as vector art so it prints sharp at any size. It also sits in the centre of the gold seal.
- **Fonts:** larger throughout.
  - Cinzel for "Certificate of Completion";
  - Cormorant Garamond for the name and course title;
  - Inter for details.
- **Certification statement:**
  > This is to certify that **[Name]** · [programme / workplace] · has successfully completed the six-week online course **ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes** offered by ROS2Lab, having passed all graded assessments and an individually assigned capstone project.
- **Three cards:**
  - **Course modules:** W1 to W6.
  - **Assessment record:** each weekly test as a percentage with the raw marks, and the average highlighted.
  - **Capstone project:** title and score badge.
- **Footer:**
  - registered, issued and valid-until dates;
  - your signature;
  - the gold seal;
  - the QR code with "Computer-generated certificate. Scan the code to check that it is genuine and still valid."
- Backgrounds and colours are kept in the PDF (print colour adjustment is set).

### Mistakes found and fixed while reviewing the whole site
- A quote mark in the dashboard's help text broke the **entire instructor dashboard**. It would not have loaded at all. Fixed.
- The course page would have shown the word "null" next to a greyed-out button. Fixed.
- A student who had finished everything, but whose window closed before the nightly check, could have been pushed into re-registration. They now get lifetime access instead.
- After lifetime access was granted, the page could keep using the old access date for up to an hour and wrongly show "access ended". It now refreshes immediately.
- Approving a re-registration with **Start fresh** now also clears an unfinished certificate application.
- The home page button now says "My access has ended" instead of "Continue my registration" for ended accounts.
- Checked every file:
  - all 71 scripts parse;
  - every import exists;
  - no undefined variables;
  - 22 server checks pass, from sign-up to signing, including a real test taken end to end;
  - all pages were rendered at laptop and phone width with no errors.

## Files in the zip (everything changed since v8)
```
README.md, UPDATE-V9.md, UPDATE-V10.md
firebase.json, firestore.rules
functions/config.js, functions/index.js, functions/projects.js, functions/test/run-tests.js
public/admin.html, public/certificate.html, public/project.html, public/img/logo-axes.svg
public/index.html, public/playground.html, public/privacy.html, public/resources.html
public/css/app.css, public/css/certificate.css
public/js/admin.js, cert-render.js, certificate.js, common.js, course.js, fb.js, firebase-config.js,
          index.js, lesson.js, project.js, register.js, test.js, vendor/qrcode.js
```

## Steps

1. **Copy the files.** Unzip `ros2lab-v10-changed-files.zip` and copy its `ros2lab-course` folder over `C:\ros2lab-course`. Say **Yes** to replacing files.

2. **Delete the old backup file**, if it is still there:
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

4. **Publish, in this order:**
   ```
   cd C:\ros2lab-course
   firebase deploy --only firestore
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
   - If asked to enable **Cloud Scheduler**, say **Yes**.
   - If asked whether to delete the function `claimCertificate` (it existed only in v9), say **Yes**.

5. **Upload your signature.**
   - Open www.ros2lab.com/admin.html and press **Ctrl + F5**.
   - Go to **Certificates → Upload my signature**.
   - Sign on white paper, photograph it in good light, and choose the photo. Check that the preview looks clean.

6. **Try the whole flow with a test student account.**
   - Finish the lessons and tests, submit a project, and mark it 80 or more in **Projects**.
   - As the student, check that **Apply for my certificate** has turned yellow, then apply.
   - As the instructor, sign the application in **Certificates**.
   - As the student, open the certificate from the course page, and download the PDF.
   - Scan the QR code with your phone.

## Strongly recommended security settings
If you have not done them yet, do the five console settings at the end of **UPDATE-V9.md**:
1. 2-Step Verification on your Google account;
2. a long, unique instructor password;
3. email enumeration protection and a password policy;
4. restrict the API key to your domains;
5. App Check.

## Good to know
- **Your signature on the web:** a signed certificate shows your signature image to anyone who has the certificate's ID. That is unavoidable for a certificate people can verify online, but it means the image is not secret. The QR verification is what makes forging pointless: a fake certificate has no matching record.
- **Pass marks and rules** are in `functions/config.js`:
  - `PASS_TEST_PERCENT` (60)
  - `PASS_PROJECT_PERCENT` (80)
  - `ACCESS_DAYS` (60)
  - `CERT_VALID_YEARS` (2)

  Exactly 60% and exactly 80% count as passing. After a change, run `firebase deploy --only functions`.
- **Names:** the certificate uses the name from registration. Students cannot change it after approval, so check it in the preview before signing.
