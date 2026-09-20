# MicroLab Exam

An English, browser-based Lab Microbiology exam system covering Lab Modules 01–06.

## Exam collections

- Lessons 01 & 02: 78 questions
- Lessons 03 & 04: 60 questions
- Lessons 05 & 06: 61 questions
- Study Guide Exam: 48 questions limited to the teacher-provided objectives
- Final Exam: 54 balanced questions spanning all six modules

Every collection provides Easy, Medium, and Hard exams, multiple-choice and figure-based short-answer items, automatic grading, final results, complete attempt history, and saved mistakes. Completing all three levels unlocks a Mistake Review Exam made from questions missed in that collection.

## Flashcards

The app also includes five saved-progress flashcard decks:

- Lessons 01 & 02: 78 cards
- Lessons 03 & 04: 60 cards
- Lessons 05 & 06: 61 cards
- Study Guide Lab Exam 1: 48 cards limited to the teacher-provided objectives
- All Lessons 01–06: 199 cards

Each card shows the question first, then reveals the correct answer, explanation, figure when available, and source locator. Learners can mark cards as known or send them to a focused review set.

Progress and unfinished attempts save automatically in the current browser. Exam data keeps its existing `microlab-exam-v3-*` storage keys, while flashcards use separate `microlab-flashcards-v1-*` keys, so adding flashcards does not reset earlier exam history. Because this is a static GitHub Pages application, progress does not sync between browsers or devices.

## Run locally

Serve the repository folder with any static web server, then open `index.html`. For example:

```bash
python -m http.server 4173
```

The deployed version is available at [mehdimarzooghian.github.io/microlab-exam](https://mehdimarzooghian.github.io/microlab-exam/).

## Source traceability

Each question includes a topic, explanation, module number, and source locator. The source coverage view summarizes the reviewed materials for the selected exam collection.
