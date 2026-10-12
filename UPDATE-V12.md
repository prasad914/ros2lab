# v12: new home page and your channel logo everywhere

This includes v9, v10 and v11. Course content is unchanged.

## What's new
- **Channel logo everywhere:** your Robotics & ROS 2 Lab logo is on every page header and is the browser-tab icon. It is drawn as vector art, so it stays sharp.
- **Home page:** redesigned in your logo's colours (dark charcoal with the ROS red, green and blue axis colours), in this order:
  1. **Hero.** Visitors type real ROS 2 commands (or tap buttons such as "Draw a square") in a terminal on the page, and a TurtleSim turtle moves. This proves "no Ubuntu needed" before they register. The turtle draws a circle by itself when the page opens.
  2. **Free founding batch badge.** It counts the days left to 31 Dec 2026 and disappears automatically after that date.
  3. **Stats strip.**
     - 6 weeks;
     - 95 lessons;
     - 27 animations and 6 games;
     - 6 tests;
     - a personal project;
     - a 2-year certificate.
  4. **The live ROS graph** ("See inside a robot's software").
  5. **Your six-week route.** The wording is corrected: the old text said both "35-day" and "six weeks".
  6. **The existing sections:** "Three ways nodes talk", the concept lab, the game and "How every lesson works".
  7. **New "Finish it, and prove it" section.** The 4 steps to the certificate, the lifetime-access bonus, and a live **sample certificate**.
  8. **New "From the Robotics & ROS 2 Lab channel" section.** Your 3 YouTube videos load only when tapped, so they are fast on mobile data, and they use YouTube's privacy-enhanced player.
  9. **New "Who it is for"** section.
  10. **How to join.**
  11. **New FAQ.** Nine questions, matching the real rules: 60 days, lifetime access, tests, project, certificate, phone use, Ubuntu.
  12. **A final call to action.**
- The page title, search description and link preview (for WhatsApp and LinkedIn shares) are updated.
- Security policy updated to allow YouTube thumbnails and the privacy-enhanced YouTube player only.

## One thing to fill in
Open `public/js/index.js`. At the top:
- `YOUTUBE_CHANNEL_URL = ""`: paste your channel link, for example `https://www.youtube.com/@YourHandle`. Until then, the YouTube buttons open your "What is ROS 2?" video.
- `VIDEOS`: the three videos shown. Add or replace video IDs (the part after `youtu.be/`) as you publish more.

## Deploy
```
cd C:\ros2lab-course
set FUNCTIONS_DISCOVERY_TIMEOUT=120
firebase deploy --only firestore
firebase deploy --only functions
firebase deploy --only hosting
```
Then open www.ros2lab.com, press **Ctrl + F5**, and tap **Draw a square**.
If you have not done it yet, do the one-click **Instructor → Tests → Set up all tests for self-paced learning** (UPDATE-V11.md).
