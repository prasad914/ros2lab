# About this folder

This is the **website code** of the ROS2Lab course (v3, "ROS 2 from zero, in three weeks"), kept here for version history.

Three parts of the full project are **deliberately not in this public repository**:

| Left out | Why |
|---|---|
| `content/course-content.json` | The lessons and their quick-check answers are only shown to approved students (they are stored in Firestore, not on the public site). |
| `functions/` | It contains the test question templates (and the instructor's account settings). Publishing them would let students see test answers. |
| `public/js/firebase-config.js` | Your Firebase project settings. Not secret, but it belongs to the deployed project, not to the code history. |

Keep the complete project (from the v3 zip) in your private `C:\ros2lab-course` folder and deploy from there, following **UPDATE-GUIDE.md**.
`tools/check-content.mjs` and `tools/preview.html` need the `content/` folder, so run them from the full project.
