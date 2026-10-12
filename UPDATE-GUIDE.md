# ROS2Lab v2: how to update www.ros2lab.com

This update gives the site a new look, adds six mini-games, a Playground page and a Free resources page, and puts the games inside six lessons. It changes **only the website files and the course content**. Firebase functions, database rules, student accounts, progress and test results are not touched.

## What is new

| Where | What changed |
|---|---|
| Home page | Live, tappable ROS 2 graph of Chiku the robot; 10-day route map; animated topic/service/action explainers; a playable game; new "How every lesson works" strip |
| `playground.html` (new, public) | All six games with badges saved on the student's device |
| `resources.html` (new, public) | Curated free resources for Linux, Python, C++ and ROS 2 Jazzy |
| My course page | Playground banner with the student's badges; menu with Playground and Free resources |
| Lessons | Games inside A2 (Path Finder), B8 (Tune the Radio), A7 (Source It!); bonus games in C4 (Pizza Tracker, Topic/Service/Action?) and R2 (Turtle Commander); "Go deeper" links in A1, P1, C1, B8, R4 |

Games in A2, B8 and A7 count as practice parts, so students finish the game to complete those lessons. Bonus games are optional. Lessons a student already completed stay completed.

## Files in this update

Copy these into your existing `C:\ros2lab-course` folder, replacing the old ones:

```
public\        (all website files, including the new js\games folder)
content\course-content.json
tools\add-games.js
tools\preview.html
UPDATE-GUIDE.md
```

Your `public\js\firebase-config.js` in this zip is the same file you sent, with your own settings. If you changed it since, keep your newer copy.

## Step by step (Command Prompt)

**1. Back up the current folder.**
```
xcopy C:\ros2lab-course C:\ros2lab-course-backup /E /I /H /Y
```

**2. Copy the new files in.** Unzip `ros2lab-v2.zip`, then copy its `public`, `content` and `tools` folders and `UPDATE-GUIDE.md` into `C:\ros2lab-course`. Choose **Replace the files in the destination** when Windows asks.

**3. Look at it on your laptop first.**
```
cd C:\ros2lab-course
npx http-server -c-1 -p 8080
```
Open these in Chrome, then press Ctrl+C in Command Prompt when done:
- http://localhost:8080/public/index.html (home page)
- http://localhost:8080/public/playground.html (all six games)
- http://localhost:8080/tools/preview.html?id=B8 (a lesson with a game)

**4. Publish to a private test address (preview channel).**
```
firebase hosting:channel:deploy redesign --expires 7d
```
It prints an address like `https://ros2lab--redesign-xxxxxxxx.web.app`. Open it on your laptop **and your phone**, sign in, open My course and one lesson. The live site is not changed yet. You can share this address with two or three students for feedback.

**5. Publish to the live site.**
```
firebase deploy --only hosting
```
Only the website changes. Do **not** run a plain `firebase deploy`.

**6. Upload the new course content** (this puts the games into the lessons). Open the site, then **Instructor → Course content →** choose `content\course-content.json` **→ Upload**. Test dates and settings are kept.

**7. Check it.** Press **Ctrl+Shift+R** on each page to skip the old cached files. Open the home page, the Playground, My course, and lessons A2, B8 and A7.

**8. If something is wrong, roll back in one click.** Firebase console → **Hosting → Release history** → the release before today → **⋮ → Rollback**. To roll back the lessons too, upload the `course-content.json` from `C:\ros2lab-course-backup\content`.

**9. Tidy up after a week.**
```
firebase hosting:channel:delete redesign
```

## www.ros2lab.com

Updating the site never touches DNS. Once `www.ros2lab.com` shows **Connected** in Firebase Hosting (SETUP-GUIDE Part 13), every `firebase deploy --only hosting` appears there automatically.

- Keep the **TXT** record Firebase gave you in GoDaddy **permanently**. Firebase uses it to renew the SSL certificate.
- Do **not** turn on GoDaddy **Forwarding** for ros2lab.com. It replaces Firebase's A records.

## Adding more games or links to lessons later

In `content\course-content.json`, a lesson block can be:

```
{ "t": "game", "id": "turtle", "bonus": true, "intro": "Optional sentence above the game." }
{ "t": "links", "label": "Go deeper (free resources)", "items": [ { "title": "Name", "url": "https://...", "note": "short note" } ] }
```

Game ids: `paths`, `radio`, `pizza`, `tsa`, `source`, `turtle`. Without `"bonus": true`, the game must be won to complete the lesson. Links must start with `https://`. After editing, preview with step 3, then upload as in step 6.
