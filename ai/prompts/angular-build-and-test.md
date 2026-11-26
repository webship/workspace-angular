Build an Angular app in a sites folder, serve it, and prove it with its first webship-js feature.

The launch command below is for Claude Code, the default; the text between the triple quotes can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Build the Angular app named <name> in this sites folder, serve it and test it with webship-js
# ~/workspace/<dev|test|sandboxes|demos> · https://<name>.ddev.site · container-based (DDEV by default)
# the builder deletes a project of the same name first: stop if <name> is an app somebody still needs
# nothing on the host: no node, npm, npx or ng outside the app's container
# a feature to write or a run to read: the book Automated Functional Testing Recipes first (its README.md, then the matching chapter), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

1. bash cmd-angular-project.sh <name> --install
   the official starter with server rendering and the step pack's demo pages, built in the app's container, Node.js in it
2. bash cmd-tools-testing.sh <name>
   webship-js, the step pack and tests/features/site.feature
3. bash cmd-tools-testing.sh <name> --dry-run --path tests/features/site.feature
4. bash cmd-tools-testing.sh <name> --run --path tests/features/site.feature

If a command fails, show the line that failed and stop. Do not retry with other flags.
When the feature is green: the address, the release of the Angular CLI the app was made with, how many scenarios and steps passed.
Then ask me whether to keep the app or remove it with: bash cmd-tools-remove.sh <name>
"""
```
