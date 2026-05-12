# 🗺️ Project Planning Skill — New Project Kickoff

## When This Skill Activates
Activate this skill automatically whenever:
- A new project folder/workspace is opened with no existing code
- The developer says anything like "new project", "start a project", "I want to build", or "let's plan"
- No `README.md`, `index.html`, `main.py`, or equivalent entry file exists yet

When activated, begin the **Discovery Interview** below before writing a single line of code.

---

## 🎤 Phase 0 — Discovery Interview (Always First)

Before planning anything, ask the developer these questions **one or two at a time** — never all at once. Wait for their answer before moving on. Be conversational, encouraging, and curious.

### Round 1 — The Big Idea
> "Let's start at the beginning — what are you trying to build? Don't worry about the technical details yet, just describe it like you'd explain it to a friend."

Then ask:
> "Who is this for? Just you, a small group, or could it grow into something bigger one day?"

### Round 2 — Project Type
Based on their answer, ask the most relevant clarifying question:

> "Great! To help me plan the right structure, which of these sounds closest to what you're building?"
> - 📄 **Static Website** — mostly text, images, maybe a contact form (HTML/CSS)
> - 🌐 **Interactive Web App** — users can log in, save data, interact with the page (HTML + JS + backend)
> - ☁️ **SaaS (Software as a Service)** — a product other people pay to use, with accounts and features
> - 🐍 **Script or Tool** — a Python or Java program that runs locally and does a specific job
> - 🗄️ **Data/Database Project** — focused on storing, querying, and managing data (SQL-heavy)
> - 🤔 **Not sure yet** — that's totally fine, let's figure it out together

### Round 3 — Features & Goals
> "What are the 2 or 3 most important things your project needs to *do*? These are your core features."

Then:
> "Is there anything it absolutely does NOT need to do right now? Knowing what's out of scope is just as important as knowing what's in scope."

### Round 4 — Tech Comfort Check
> "Quick check-in on the tech side — which languages or tools are you most comfortable with so far? And is there anything you've been wanting to try or learn through this project?"

### Round 5 — Timeline & Stakes
> "Last planning question: is this for a class deadline, a personal portfolio, or something else? Knowing the timeline helps me set the right pace."

---

## 📋 Phase 1 — Project Summary (After Interview)

Once the interview is complete, produce a **Project Brief** in this format and ask the developer to confirm it before proceeding:


📋 Project Brief
Project Name: [working title]
Type: [Static Site / Web App / SaaS / Script / Data Project]
Goal: [one sentence — what does it do and for who]
Core Features:

[feature]
[feature]
[feature]
Out of Scope (for now): [what we're not building yet]
Primary Languages: [e.g., HTML, CSS, JavaScript, Python, SQL]
Learning Goals: [what the developer wants to learn through this]
Timeline: [deadline or pace]

Then ask:
> "Does this capture your vision? Change anything before we lock it in and start planning."

---

## 🏗️ Phase 2 — Architecture Overview (Teaching Moment)

After the brief is confirmed, explain the recommended architecture **in plain English** before showing any structure.

### Teach the concept first:
> "Before we write any code, let's talk about *architecture* — that's just a fancy word for 'how we organize the pieces of our project.' Think of it like the blueprint for a house: you decide where the rooms go before you start building walls."

Then recommend a structure based on project type:

### Static Website:
project-name/
├── index.html       ← The home page — where everything starts
├── about.html       ← Additional pages follow the same pattern
├── css/
│   └── style.css    ← All visual styling lives here
├── js/
│   └── main.js      ← Any interactivity goes here
└── images/          ← Keep all media organized in one place

### Web App (HTML/CSS/JS + Python backend):
project-name/
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── backend/
│   ├── app.py           ← Main server file (e.g., Flask or FastAPI)
│   ├── routes/          ← URL endpoints organized by feature
│   └── models/          ← Database models (how data is structured)
├── database/
│   └── schema.sql       ← SQL table definitions
├── tests/               ← All tests live here — never skip this folder!
├── .github/workflows/   ← CI/CD automation (explained in Phase 4)
├── README.md
└── requirements.txt     ← List of Python packages needed

### Script / Tool (Python or Java):
project-name/
├── src/
│   └── main.py          ← Entry point — where the program starts
├── utils/               ← Helper functions used across the project
├── tests/               ← Tests for every function you write
├── README.md
└── requirements.txt

Explain:
> "This structure follows the **Separation of Concerns** principle — a core industry standard that means keeping different types of code in their own dedicated places. It makes your project easier to read, debug, and grow."

---

## 🔢 Phase 3 — Development Phases (Small Steps, Always)

**Never plan the whole project as one big task.** Always break it into small, testable phases. Present the plan phase by phase and explain each one before moving on.

Teach this concept:
> "Professional developers work in *phases* or *sprints* — small chunks of work that each produce something you can actually run and test. This is how real teams avoid building a mountain of code that breaks all at once."

### Template Phase Plan:

#### ✅ Phase 1 — Foundation (Get something visible/runnable)
- Set up project folder structure
- Create the entry point file (index.html / main.py / Main.java)
- Add just enough to prove it works (a heading, a print statement, a "Hello World")
- **Test:** Can you open/run it? Does it display/execute without errors?
- **Commit:** Save your work to version control (Git)

#### ✅ Phase 2 — Core Feature #1
- Build only the first core feature from the Project Brief
- Keep it simple — no styling, no edge cases yet
- **Test:** Does the feature work as expected? Write at least one test for it.
- **Commit**

#### ✅ Phase 3 — Core Feature #2
- Same pattern — build, test, commit
- Begin connecting features if they depend on each other

#### ✅ Phase 4 — Core Feature #3 + Integration
- Build the third feature
- Test that all three features work *together*
- **Integration Test:** Does the whole flow work end to end?

#### ✅ Phase 5 — Styling & Polish
- Add CSS / UI improvements
- Improve error messages and edge case handling
- **Test:** Does it still work after styling changes?

#### ✅ Phase 6 — Review & Documentation
- Write/update README.md
- Add final comments to all code (see claude.md commenting rules)
- Do a full end-to-end test
- **Ship it** (deploy or submit)

> After presenting the phases, ask: "Does this order make sense for your project? Want to adjust any phase before we start Phase 1?"

---

## ⚙️ Phase 4 — CI/CD Explained (Teaching Moment)

Introduce CI/CD at the right time — after the plan is set, before coding starts.

Teach:
> "CI/CD stands for **Continuous Integration / Continuous Deployment**. It sounds intimidating but the idea is simple: every time you save and push your code, an automated system runs your tests and checks that nothing is broken — before it ever reaches users. Think of it as a robot QA tester that works 24/7."

> "**CI (Continuous Integration):** Every code change is automatically tested."
> "**CD (Continuous Deployment):** If tests pass, the code is automatically published/deployed."

### Starter GitHub Actions Workflow (for any project):
```yaml
# .github/workflows/ci.yml
# 📘 WHAT THIS FILE DOES: Automatically runs tests every time you push code to GitHub.
# 🔗 Learn more: https://docs.github.com/en/actions

name: Run Tests on Push   # The name shown in GitHub's Actions tab

on: [push, pull_request]  # Triggers: run this workflow on every push or pull request

jobs:
  test:
    runs-on: ubuntu-latest  # Run on a fresh Linux machine in the cloud

    steps:
      - uses: actions/checkout@v3         # Step 1: Download your code onto the machine
      - name: Set up Python               # Step 2: Install Python (adjust for your language)
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies        # Step 3: Install required packages
        run: pip install -r requirements.txt
      - name: Run tests                   # Step 4: Run your test suite
        run: python -m pytest tests/
```

> "We'll add this file in Phase 1 so it's working from day one — not bolted on at the end."

---

## 🧪 Testing Philosophy (Always Teach This)

Reinforce testing at every phase. Use this language consistently:

> "We write tests *as we build*, not after. This is called **Test-Driven Development (TDD)** — or at least test-alongside development. It means when something breaks later, you'll know exactly where."

### Testing vocabulary to introduce gradually:
- **Unit test** — tests one small function in isolation
- **Integration test** — tests that two or more parts work together
- **End-to-end test** — tests the full user flow from start to finish
- **Regression test** — re-runs old tests to make sure new code didn't break old features

Recommend tools by language:
- Python → `pytest` 🔗 https://docs.pytest.org
- JavaScript → `Jest` 🔗 https://jestjs.io
- Java → `JUnit` 🔗 https://junit.org
- SQL → manual query validation + row count checks

---

## 🔁 How This Skill Interacts With claude.md and w3schools.com.md

- **claude.md** governs HOW to write and explain code (comments, teaching tone, W3Schools links). This skill defers to it for all code explanations.
- **w3schools.com.md** provides navigation tips when the developer needs to look something up mid-project.
- **This skill** governs the *structure and sequence* of the project — the what and when, not the how.

When these skills overlap, apply all three together. Example: when setting up `index.html` in Phase 1, use this skill's folder structure, write the file with claude.md's HTML commenting style, and link to `https://www.w3schools.com/html/html_intro.asp`.

---

## ✅ Planning Skill Checklist (Run Through Before First Code)

- [ ] Discovery Interview complete
- [ ] Project Brief confirmed by developer
- [ ] Architecture explained and folder structure agreed on
- [ ] Phase plan presented and approved
- [ ] CI/CD workflow file added to project
- [ ] `tests/` folder created (even if empty)
- [ ] `README.md` started with project name and goal
- [ ] Developer knows which phase we're starting and what "done" looks like for it

