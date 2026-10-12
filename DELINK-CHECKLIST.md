# Moving ROS2Lab to your own Gmail (prasadprabhu145@gmail.com)

The website and lessons no longer mention any institution: the footer of every page now says **"Developed by the Robotics and ROS2 lab Channel"**, and the contact email is your Gmail. This checklist moves the **accounts** behind the site.

Do the steps in order. **Keep the college account until the last steps**, because you need it to hand over ownership.

## Part A: hand the Firebase project to your Gmail

1. **Add your Gmail as an owner.**
   1. Sign in to <https://console.firebase.google.com> with the college account and open the project **ros2lab**.
   2. Go to **⚙ Project settings → Users and permissions → Add member**, enter `prasadprabhu145@gmail.com`, choose role **Owner**, and save.
   3. Open the invitation email in Gmail and accept it.
2. **Check that the college doesn't own the project.**
   1. Sign in to <https://console.cloud.google.com> with Gmail and open the project picker at the top.
   2. Look at what is shown above **ros2lab**:
      - **"No organization"**: good, continue.
      - **The college's domain (an organization)**: the project belongs to the college's Google Workspace, and its administrators control it. You cannot fully separate it yourself. Either ask the college IT team to move it to "No organization", or create a fresh project under Gmail and move the site there. If this happens, tell me and I'll give you the exact migration steps.
3. **Move billing to your own account.**
   1. Signed in with Gmail, go to Google Cloud console → **Billing** → **Create account**, and add your own card or UPI.
   2. Go to **Billing → My projects**, find **ros2lab**, open the **⋮** menu, choose **Change billing**, and select the new account.
   3. Add the **₹200 budget alert** again (Budgets & alerts).
4. **Change the public contact details.**
   1. In Firebase, go to **⚙ Project settings → General**: set **Public-facing name** to `ROS2Lab` and **Support email** to your Gmail.
   2. Only if it exists: Google Cloud console → **APIs & Services → OAuth consent screen**: set the user support email and the developer contact to your Gmail.

## Part B: update the website (on your laptop)

5. **Copy the new files.** Copy the `ros2lab-course` folder from `ros2lab-independent-changed-files.zip` over `C:\ros2lab-course`, replacing files.
6. **Switch the command-line tools to Gmail.** In Command Prompt:
   ```
   firebase logout
   firebase login
   ```
   Choose **prasadprabhu145@gmail.com** in the browser. Then:
   ```
   cd C:\ros2lab-course
   firebase use ros2lab
   ```
7. **Test and publish:**
   ```
   cd functions
   npm test
   cd ..
   node tools\check-content.mjs
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
8. **Create your new instructor account.**
   1. On the website, click **Register for free** and register with `prasadprabhu145@gmail.com`.
   2. Click the link in the verification email.
   3. **Sign out, then sign in again.** You land on the Instructor dashboard.
   4. Go to **Course content** and upload `content\course-content.json` again (one exercise changed).
   5. Because the privacy notice changed, students are asked to accept it again the next time they sign in. This is expected.
   6. Check the **Tests** settings.
9. **Remove the old instructor account.**
   1. Firebase console → **Authentication → Users**: delete the user `prasadprabhu@nitte.edu.in`, if it is listed. Until you do, that account keeps instructor rights on the site.
   2. Firebase console → **⚙ Project settings → Users and permissions**: remove the college account. Do this **only after** steps 6–8 worked with Gmail.
10. **Update the emails students receive.** Firebase console → **Authentication → Templates**: set the sender name to `ROS2Lab` for "Email address verification" and "Password reset".

## Part C: your other accounts

11. **Domain (GoDaddy).** If the GoDaddy account or the domain's contact uses the college email, change it to your Gmail. Turn on **domain privacy** and **2-step verification**.
12. **GitHub (prasad914).** In **Settings → Emails**, add your Gmail and make it the primary address. On your laptop, run `git config --global user.email "prasadprabhu145@gmail.com"`. Archive or delete the old `ros2lab` GitHub Pages repository.
13. **Protect the Gmail account.** It now controls everything, so turn on **2-Step Verification** and set a recovery phone number.
14. **Add your YouTube link.** In `public\js\index.js`, set:
    ```
    YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@your-channel"
    ```
    Then run `firebase deploy --only hosting`. The home page's YouTube links then open your channel.

## Good practice

Being independent means the site uses no college name, email, money or equipment. You are still employed, though, so keep it free unless you get permission, don't use it for official marks, and consider mentioning it to your HoD as a personal outreach project. That keeps everything transparent.
