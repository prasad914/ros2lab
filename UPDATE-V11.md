# v11: self-paced tests (fixes students getting stuck)

This includes v9 and v10. Deploy it the same way as v10 (the steps are in UPDATE-V10.md). Course content is unchanged; there is no need to upload it again.

## Problems fixed
1. **Tests closed by date.** Every test closed 30 days after you uploaded the course, so students who registered later could never pass, never get lifetime access and never get a certificate.
   - Tests can now have **no closing date**.
   - New tests are created without one.
2. **Answers never shown.** "After the test closes" never happens without a closing date.
   - New recommended setting: **"After a pass or the last attempt"**. A student sees the answers once they score 60% or more, or after their last attempt, so a second attempt is never taken with the first attempt's answers in hand.
   - Old tests set to "after the test closes" with no closing date behave the same way automatically.
3. **Tests opening in the future blocked students.** A published test that has not opened yet no longer counts for lifetime access or certificates.
4. **Students with no attempts left.** A student who used both attempts below 60% could never qualify, and nobody was told.
   - They now see "All attempts used without reaching 60%. Ask your instructor for another attempt."
   - In **Students → click the student**, a Tests table shows each test with a **+1 attempt** button.
5. **Stuck students were invisible to you.** A new **Needs help** column in the Students table (also in the CSV) lists anyone who:
   - used all attempts below 60%;
   - failed the project;
   - has a project waiting for your marks;
   - has 7 days or fewer of access left.
6. **Re-registration.** The **Start fresh** option now also clears extra attempts, and it reminds you to tick it for students who ran out of attempts.

## After deploying: one click
1. Open **Instructor → Tests**.
2. Press **Set up all tests for self-paced learning** and confirm. For **every** test this sets:
   - open from now;
   - **no closing date**;
   - **Published**;
   - unlocked only after the student finishes that week's lessons;
   - answers shown after a pass or the last attempt.
3. Check that each test shows a green **Ready for self-paced students**. A red box explains anything that could still block students.

## How a weekly test works for a student now
They finish all the lessons of Week N, and the Week N test unlocks straight away. They have 2 attempts, and the best score counts. They need 60% or more. All of this happens within their 60 days.
