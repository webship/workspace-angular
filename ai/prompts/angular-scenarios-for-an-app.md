Write and run the webship-js scenarios of one Angular app of the workspace.

The launch command below is for Claude Code, the default; the text between the triple quotes can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Write webship-js scenarios for the Angular app <app> (its <page> page) and run them
# ~/workspace/<dev|test|sandboxes|demos> · https://<app>.ddev.site · container-based (DDEV by default)
# the steps wait for the app to take the page over, follow the router to the end of each navigation and send a form the way the app does
# fields are filled after "And the page is hydrated": what is typed before the app takes the page over is lost
# nothing on the host: no node, npm, npx or ng outside the app's container
# before writing: the book Automated Functional Testing Recipes (its README.md, then ch27-testing-spa.md and ch07-waiting-dynamic-content.md), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

1. bash cmd-tools-testing.sh <app>
2. Open https://<app>.ddev.site/<page> in the Playwright MCP browser, in a tab of your own, and take a snapshot: note the
   name of each link, button and field, the view's title, and where each link goes; use one link and see whether the
   view changes by the router and its title changes.
3. Write tests/features/<page>.feature from the installed phrases only
   (grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/angular-steps/tests/step-definitions/*.steps.js):
   no fixed wait, no framework or platform name in a step, no account created.
4. bash cmd-tools-testing.sh <app> --dry-run --path tests/features/<page>.feature
5. bash cmd-tools-testing.sh <app> --run --path tests/features/<page>.feature

If a command fails, show the line that failed and stop. A failing scenario is a result: say what the app did.
When the feature is green: how many scenarios and steps passed, and which links or buttons of the page a person cannot name.
"""
```
