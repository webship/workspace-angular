---
name: angular-scenarios
description: Write and fix webship-js scenarios for an Angular app with the Angular step pack (`@webship-js/angular-steps`) in the Webship Workspace — the pack's phrases for the app taking a page over, its router's views, its forms and its page for a status, how the steps name things (a link or a button by its name, from its start), the two lanes (with JavaScript and without), the traps found on a real app, and three example features that pass. Use when writing a feature for an Angular app, choosing the phrase for a link, a form or an error, or reading why an Angular scenario failed.
---

# angular-scenarios

Scenarios for Angular apps in a Webship Workspace (`~/workspace`), a container-based workspace (DDEV by default), with
webship-js and [`@webship-js/angular-steps`](https://github.com/webship/angular-steps). An app of the Angular builder
(`cmd-angular-project.sh`) gets the pack with `bash cmd-tools-testing.sh <app>`; the suite runs in the app's container
(`bash cmd-tools-testing.sh <app> --run`).

A page drawn on the server arrives as HTML; the app's scripts then take it over in the browser (hydration). Every step
of the pack that acts waits for that first, when the page has Angular and the browser runs JavaScript; a page without
Angular, and every page in a browser without JavaScript, have nothing to wait for, and the run's log says so.

## The phrases

Check them against the installed pack before you use them
(`grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/angular-steps/tests/step-definitions/*.steps.js`).

**The page**

```gherkin
Given the page is hydrated
Then the page should be hydrated
Then the page should have been rendered in the browser alone
When I wait for the app to be idle
```

**Views**: a link by its name; how the last navigation ended; the view's title; the current link.

```gherkin
When I navigate with the "Posts" link
When I go back one view
Then the router should have changed the view
Then a whole page should have loaded
Then the view's title should be "Posts"
Then the "Posts" link should be the active one
Then the app's address should be "/posts"
When I wait for the app's requests to finish
```

**Forms**: a form by the button that sends it; whether the app accepted it, or why it refused it; how it was answered.

```gherkin
When I send the form by its "Send" button
Then the form should have been accepted
Then the form should have been refused with "Your message needs at least 10 characters."
Then the form should have been answered in place
Then the form should have been answered with a whole page
```

**The app's page for a status**

```gherkin
Then the app should show its 404 page
Then the app should show its 404 page saying "Post not found"
```

webship-js's own steps still go to an address (`Given I am on "/posts"`), read the page (`Then I should see "Moving
between pages"`), fill in fields and press keys. A button with a label and no text (an icon) is pressed with `When I
press "Add one to the count" by attr` (its `aria-label`).

## The traps

- **A name matches from its start.** Exactly, then without regard to case, then by its start (three characters or
  more); never a part in the middle. A failure lists the names it found.
- **Before the app takes the page over, a link loads a whole page and a form posts to the server.** The pack's steps
  wait; a step of webship-js (`I click`, `I press`) does not: tag the scenario `@idle-after-steps`, or add `When I wait
  for the app to be idle` after it.
- **Fill in fields after `And the page is hydrated`.** When the app takes the page over, its form writes its own
  values into its fields: what was typed before is lost, and the form is sent empty.
- **A navigation by its end, never by a request.** A resolver fetches a view's data before the address changes, the
  view's own request comes after: `Then the router should have changed the view` reads what happened to the document.
- **A guard's redirect ends where it sent the app.** Assert the address it was sent to (`Then the app's address should
  be "/posts/3"`), not the link's.
- **No route announcer.** Angular tells a screen reader nothing of a new view unless the app does: check the view's
  title. A view without a title in its route keeps the title it found.
- **The current link needs `aria-current`.** `routerLinkActive` sets it with `ariaCurrentWhenActive="page"`; a class
  alone tells no one, and `the "…" link should be the active one` finds none.
- **A refusal logs a browser error.** The browser logs a 4xx answer as a console error: a scenario that expects one is
  tagged `@js-warn` when the project fails on browser errors, with a comment that says why.
- **The page for a status.** Loaded, the page answers with its status; reached inside the app there is none, and the
  view must say the code (in its first heading or its title).
- **A page rendered in the browser alone** (`RenderMode.Client`) is empty without JavaScript: tag its scenario
  `@needs-javascript`.
- **Two lanes.** `@needs-javascript` for a scenario that holds only with JavaScript, `@no-javascript` for one that
  holds only without it; never `@javascript`, which webship-js reads as "fail on any browser error".
- **No fixed waits.** The steps wait on the app's own signals; a Then step waits for what it expects.

## The examples

Three features that pass, each against the app it names:

- [`examples/views.feature`](examples/views.feature): the demo template (`bash cmd-angular-project.sh ngapp
  --install`), its views, its data, a guard's redirect and the browser's back.
- [`examples/contact.feature`](examples/contact.feature): the demo's contact form, accepted and refused (the same
  app).
- [`examples/starter.feature`](examples/starter.feature): the official starter alone (`bash cmd-angular-project.sh
  ngmin --template minimal --install`), its welcome page.

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Angular.** Start with `ch27-testing-spa.md` (an app that changes its views without page loads),
  `ch07-waiting-dynamic-content.md` (why a wait names its signal, never a time),
  `ch15-accessibility-testing.md` (names a person reads, and what a screen reader is told of a new view) and
  `ch21-when-tests-go-bad.md` (flaky, brittle and slow scenarios).
