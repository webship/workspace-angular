/**
 * Angular for Webship Workspace: a plugin for Angular apps.
 *
 * What the package carries is placed by the installer from the manifest: the builder in the sites
 * folders, its functions, argparse and machine files (a first feature) under core/scripts/plugins/angular/,
 * its AI items (ai/) in the AI folders. The builder makes an Angular app with the Angular CLI (the
 * official starter with server rendering, with the demo pages of the Angular step pack by default) or
 * takes one from its repository, builds it and serves it from a container of its own: an app with server
 * rendering by its own server, one without it by a static server that falls back to its single page.
 * Node.js, the app's language, runs in the app's container, never on the machine. The step pack
 * (@webship-js/angular-steps) goes into the testing setup of such an app with the core's
 * `cmd-tools-testing.sh <project>`. The dashboard needs nothing drawn for it: the builder is in the
 * Build list because it is a cmd-*-project.sh, the row menus are the core's, the AI items are listed
 * like any other. What register() adds is what the assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name, which its functions are named after. */
export const PLATFORM = 'angular';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-angular-project.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['angular-app-builder', 'angular-tester'];

/** The skill the installer places in the AI Skills folder (a folder each, with its SKILL.md). */
export const SKILLS = ['angular-scenarios'];

/** The slash command the installer places in the AI Commands folder. */
export const AI_COMMANDS = ['angular-test'];

/** The prompts the installer places in the AI Prompts folder: whole launch commands for a new session. */
export const PROMPTS = ['angular-build-and-test', 'angular-scenarios-for-an-app'];

/** What the assistant is told about Angular in this workspace. */
export function assistantContext(): string {
  return [
    'Angular (a plugin, @webship.co/workspace-angular): its builder makes an Angular app and serves it from a container of its own, with',
    '`bash cmd-angular-project.sh <name> --install` from a sites folder (dev, test, sandboxes, demos): the app is the official',
    'starter with server rendering (ng new --ssr, the Angular CLI pinned) with the demo pages of the Angular step pack (--template',
    'minimal for the starter alone, or a repository of your own with --source, --ref and --path), built with the app\'s own build in',
    'the app\'s container, where Node.js runs, and served at https://<name>.ddev.site: an app with server rendering by its own',
    'server (told the hosts it answers, NG_ALLOWED_HOSTS), one without it by a static server that falls back to its single page.',
    'The app\'s source is in <name>/app/. There is no database, and the app has no accounts. `--runtime docker`, `podman` or',
    '`kubernetes` builds it on Docker Compose, Podman or a Kubernetes cluster instead of DDEV, at the address that runtime gives',
    '(the build prints it).',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the step pack @webship-js/angular-steps on such an app: its steps',
    'wait for the app to take the page over (hydration), follow the router to the end of each navigation, and send a form',
    'either way (in place with JavaScript, with a page load without it).',
    `For building or fixing an Angular app (its build, its links and forms), hand over to the agent \`${AGENTS[0]}\`; for testing one, to \`${AGENTS[1]}\`.`,
    `The plugin also places the skill ${SKILLS.map((a) => `\`${a}\``).join(', ')} (the step pack's phrases) in ai-skills/,`,
    `the command ${AI_COMMANDS.map((a) => `\`/${a} <app>\``).join(', ')} in ai-commands/ and the prompts ${PROMPTS.map((a) => `\`${a}\``).join(' and ')} in ai-prompts/.`,
    'Never run node, npm, npx or ng on the host for a project.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
