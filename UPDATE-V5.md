# Publishing the v5 update (richer 30-minute lessons + screenshot protection)

Your site already runs v4. This update replaces a few website files, one database-rules file and the course content. Student accounts, progress and test results are kept. Plan about 15 minutes.

## What's new

- **Every lesson is now about 30 minutes** (the short 10–25 minute lessons were expanded; the hands-on lessons that already took 35–45 minutes keep their length).
- **For slow learners, lessons now have:**
  - an **"In plain words"** box at the top of every lesson: the whole idea in one or two sentences;
  - **slow, step-by-step worked examples** in most lessons ("Walking a path, one step at a time", "Decoding -rwxr-xr-- one letter at a time", "One message's journey, layer by layer"...);
  - a **"Common mistakes (and how to avoid them)"** box in every lesson after "Start here";
  - **flashcards** for revision at the end of every lesson.
- **More hands-on practice:** 19 new practice-terminal missions (treasure hunt, tidy the desktop, log detective with grep, permission locks, install a tool, draw a square with turtlesim, two robots in namespaces, tune parameters live, rotate with actions, a debugging mission...) and 16 new Python exercises, plus new match, sort, order and spot-the-bug puzzles and more quick checks. In total: 52 practice terminals and 43 Python exercises, all checked automatically.
- **Practice terminal:** new commands for checking a computer: `lsb_release -a`, `uname -a`, `free -h`, `df -h`, `nproc`.
- **Screenshot protection on lesson and test pages:** the page is blanked when a screenshot key is pressed (Print Screen, Windows Snip Win+Shift+S, Mac Cmd+Shift+3/4/5), the clipboard is wiped, and the content is hidden whenever the window is not in front (snipping tools and screen recorders take focus first). During tests, screenshot attempts are recorded in the integrity log ("pressed a screenshot key").
  - Honest limit: **no website can completely stop screenshots**. A phone's own screenshot button or another camera cannot be blocked by a web page. The student-name watermark stays on every page, so any photo still shows who took it.
- **Fixes:** the "Start here" lesson and the home page now describe the 5-week, 25-day course (they still said 3 weeks / 15 days), and the animation counts are correct (25).

## Steps

1. **Copy the files.** Unzip `ros2lab-v5-changed-files.zip`, then copy its `ros2lab-course` folder over your `C:\ros2lab-course` folder. Say **Yes** to replacing files.
2. **Check the lessons** (optional; needs Python 3):
   ```
   cd C:\ros2lab-course
   node tools\check-content.mjs
   ```
   It should say **All good** (52 practice terminals, 43 Python exercises).
3. **Publish the website and the new database rules** (the rules allow the new "screenshot" event in the test log):
   ```
   firebase deploy --only hosting,firestore:rules
   ```
   Functions did not change, so there is no need to deploy them.
4. **Upload the course.** Open the site → **Instructor → Course content** → choose `content\course-content.json` → **Upload**. It should report 5 modules, 57 lessons and 5 tests.
5. **Check it as a student.** Press **Ctrl + F5** on the course page, open lesson A0 and lesson A4, do one practice terminal, then press the Print Screen key: the page should turn dark with "Course content hidden".

**If something looks old,** ask students to press Ctrl + F5 once.
