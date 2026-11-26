import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-angular.sh');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

const PLAYWRIGHT = `const chromiumArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
];
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(kind: 'demo' | 'own' | 'drupal') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-plugin-'));
  const dir = path.join(root, 'dev', 'app1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: app1\ntype: ${kind === 'drupal' ? 'drupal11' : 'generic'}\n`);
  if (kind !== 'drupal') {
    fs.writeFileSync(path.join(dir, '.ddev', 'config.angular.yaml'), '# An Angular app in this project.\n');
    fs.mkdirSync(path.join(dir, 'app', 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app', 'src', 'server.ts'), "app.use(express.static('browser'));\n");
    if (kind === 'demo') {
      fs.mkdirSync(path.join(dir, 'app', 'src', 'app', 'pages'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'app', 'src', 'app', 'pages', 'contact.ts'), 'export class Contact {}\n');
      fs.writeFileSync(path.join(dir, 'app', 'src', 'server.ts'), "app.post('/api/contact', () => {});\n");
    }
  }
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), PLAYWRIGHT);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app1', devDependencies: { 'webship-js': '^2.0.18' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'angular'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'angular', 'site.feature'));
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder. */
function bash(script: string, env: Record<string, string> = {}) {
  const fake = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; return 0 ; }';
  return spawnSync('bash', ['-c', `${fake}\nsource ${FUNCTIONS}\n${script}`], { encoding: 'utf8', env: { ...process.env, ...env } });
}

test('the app has no accounts of the workspace: the list is empty, and adding or removing them says so', () => {
  let r = bash('set_angular_users ; echo "${#users[@]}"');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), '0');
  r = bash('add_angular_users ; cancel_angular_users');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /no accounts of the workspace's, so there are none to add/);
  assert.match(r.stdout, /no accounts of the workspace's, so there are none to remove/);
});

const hook = (p: { dir: string; root: string; scripts: string }) =>
  bash(`cd ${p.dir} && testing_configure_angular ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1' });

test('the testing hook adds the step pack and, for the demo template, a first feature, once', () => {
  const p = project('demo');
  const r = hook(p);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/angular-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.18', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/angular-steps/tests/step-definitions/*.js',", 'the pack is listed right after webship-js');
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; console.log(JSON.stringify([c.require.length, c.paths]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  assert.deepStrictEqual(JSON.parse(loaded.stdout), [3, ['tests/features/**/*.feature']]);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'playwright.config.ts'), 'utf8'), PLAYWRIGHT, 'the browser\'s arguments are the project\'s');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), read('testing/site.feature'));
  assert.match(r.stdout, /tests\/features\/site\.feature: a first feature for the demo/);
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  const again = hook(p);
  assert.strictEqual(again.status, 0);
  assert.doesNotMatch(again.stdout, /package\.json:|cucumber\.js:|tests\/features\/site\.feature:/, 'a second run adds nothing');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('an app of your own gets the step pack, and no first feature: it has its own names', () => {
  const p = project('own');
  const r = hook(p);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), /@webship-js\/angular-steps\/tests\/step-definitions/);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  assert.match(r.stdout, /the app is not the demo template, so no first feature is written/);
});

test('the testing hook waits for the testing stack: without cucumber.js it says to run the setup again', () => {
  const p = project('demo');
  fs.rmSync(path.join(p.dir, 'cucumber.js'));
  const r = hook(p);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /cucumber\.js is not here yet/);
});

test('the testing hook leaves any other project alone', () => {
  const p = project('drupal');
  const r = hook(p);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
});

const SERVE = 'while [ ! -f /var/www/html/.webship-angular/serve.sh ]; do sleep 2; done; exec bash /var/www/html/.webship-angular/serve.sh';

test('the app\'s container waits for the builder\'s serve script, then runs it', () => {
  const r = bash('angular_serve_command');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), SERVE);
  assert.doesNotMatch(r.stdout, / ;/, 'no " ;", which starts a comment in the supervisor configuration DDEV writes from it');
});

test('Angular\'s server is told the host of the project\'s address, and the container\'s own names', () => {
  const hosts = (url: string) => bash(`angular_allowed_hosts ${url}`).stdout.trim();
  assert.strictEqual(hosts('https://app1.ddev.site'), 'app1.ddev.site,127.0.0.1,localhost');
  assert.strictEqual(hosts('http://127.0.0.1:43210'), '127.0.0.1,localhost');
  assert.strictEqual(hosts('http://172.18.0.2:30080'), '172.18.0.2,127.0.0.1,localhost');
  assert.strictEqual(hosts('http://localhost:4000/'), '127.0.0.1,localhost');
});

test('the serve script: the app\'s own server with its allowed hosts, or the static server with the single-page fallback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-serve-'));
  let r = bash(`angular_write_serve ${root} server dist/demo 'app1.ddev.site,127.0.0.1,localhost'`);
  assert.strictEqual(r.status, 0, r.stderr);
  let script = fs.readFileSync(path.join(root, '.webship-angular', 'serve.sh'), 'utf8');
  assert.match(script, /^cd \/var\/www\/html\/app \|\| exit 1$/m);
  assert.match(script, /^exec env PORT=3000 NG_ALLOWED_HOSTS='app1\.ddev\.site,127\.0\.0\.1,localhost' node dist\/demo\/server\/server\.mjs$/m);
  assert.strictEqual(spawnSync('bash', ['-n', path.join(root, '.webship-angular', 'serve.sh')]).status, 0);
  r = bash(`angular_write_serve ${root} browser dist/demo/browser '127.0.0.1,localhost'`);
  assert.strictEqual(r.status, 0, r.stderr);
  script = fs.readFileSync(path.join(root, '.webship-angular', 'serve.sh'), 'utf8');
  assert.match(script, /^exec node \/var\/www\/html\/\.webship-angular\/serve\/node_modules\/serve\/build\/main\.js -s dist\/demo\/browser -l tcp:\/\/0\.0\.0\.0:3000 --no-clipboard$/m);
});

test('the kind of build is read from the app\'s angular.json and its output', () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-kind-'));
  const kind = () => bash(`angular_build_kind ${app}`).stdout.trim();
  assert.strictEqual(kind(), '', 'no angular.json: nothing');
  const ws = (projects: object, extra: object = {}) => fs.writeFileSync(path.join(app, 'angular.json'), JSON.stringify({ version: 1, projects, ...extra }));
  ws({ demo: { projectType: 'application', architect: { build: { options: {} } } } });
  assert.strictEqual(kind(), '', 'not built yet: nothing');
  fs.mkdirSync(path.join(app, 'dist', 'demo', 'browser'), { recursive: true });
  fs.writeFileSync(path.join(app, 'dist', 'demo', 'browser', 'index.html'), '');
  assert.strictEqual(kind(), 'browser dist/demo/browser', 'only files for the browser');
  fs.mkdirSync(path.join(app, 'dist', 'demo', 'server'), { recursive: true });
  fs.writeFileSync(path.join(app, 'dist', 'demo', 'server', 'server.mjs'), '');
  assert.strictEqual(kind(), 'server dist/demo', 'a server');
  ws({ lib: { projectType: 'library' }, shop: { projectType: 'application', architect: { build: { options: { outputPath: { base: 'out/shop' } } } } } });
  fs.mkdirSync(path.join(app, 'out', 'shop', 'browser'), { recursive: true });
  fs.writeFileSync(path.join(app, 'out', 'shop', 'browser', 'index.csr.html'), '');
  assert.strictEqual(kind(), 'browser out/shop/browser', 'the application, not the library; an output path given as an object');
  ws({ old: { architect: { build: { options: { outputPath: 'dist/old' } } } } });
  fs.mkdirSync(path.join(app, 'dist', 'old'), { recursive: true });
  fs.writeFileSync(path.join(app, 'dist', 'old', 'index.html'), '');
  assert.strictEqual(kind(), 'browser dist/old', 'an older build: index.html in the output folder itself');
});

test('on DDEV the router sends the address to the app\'s server, a daemon that waits for the serve script', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-ddev-'));
  const r = bash(`angular_write_ddev_config ${root} 'the official starter of the Angular CLI 22.3.0'`);
  assert.strictEqual(r.status, 0, r.stderr);
  const yaml = fs.readFileSync(path.join(root, '.ddev', 'config.angular.yaml'), 'utf8');
  assert.match(yaml, /web_extra_exposed_ports:\n  - name: angular\n    container_port: 3000\n    http_port: 80\n    https_port: 443/);
  assert.ok(yaml.includes(`web_extra_daemons:\n  - name: angular\n    command: "bash -c '${SERVE}'"\n    directory: /var/www/html`), yaml);
  assert.match(yaml, /^# app: the official starter of the Angular CLI 22\.3\.0$/m);
  assert.ok(!fs.existsSync(path.join(root, '.ddev', 'web-build')), 'the web image is DDEV\'s own: Node.js comes with the project\'s nodejs_version');
});

const STARTER = '{"name":"demo","scripts":{"build":"ng build"},"dependencies":{"@angular/core":"^22.3.0","@angular/ssr":"^22.3.0"}}';
const ANGULAR_JSON = '{"version":1,"projects":{"demo":{"projectType":"application","architect":{"build":{"options":{"outputPath":"dist/demo"}}}}}}';

/** A build of app1 in a fresh workspace folder, with `ddev` and the core's helpers recorded; `layer` stands for the
 * core's runtime layer (fun-runtime.sh), as far as the builder asks it. The recorder makes the files the commands in
 * the container would: the new app, the demo pages over it, the copied app (its package.json from PKGJSON, its
 * angular.json from NGJSON, its lock file LOCK), the build (BUILD: server, browser or none). */
function build(opts: { layer?: string; env?: Record<string, string> } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-build-'));
  fs.mkdirSync(path.join(root, 'dev'), { recursive: true });
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'angular'), { recursive: true });
  const log = path.join(root, 'ddev.log');
  const app = path.join(root, 'dev', 'app1', 'app');
  const script = [
    'trim_project_name() { :; } ; drop_database() { :; } ; ddev_up() { ddev "$@" ; } ; ddev_nodejs_version() { echo 24 ; }',
    `ddev() { echo "ddev $*" >> ${log} ; case "$*" in`,
    `  *"@angular/cli@22.3.0 new demo --directory app"*) mkdir -p ${app}/src/app && printf '%s' '${STARTER}' > ${app}/package.json && printf '%s' '${ANGULAR_JSON}' > ${app}/angular.json ;;`,
    `  *"npm pack --silent"*) mkdir -p ${app}/src/app/pages && touch ${app}/src/app/pages/contact.ts && echo "app.post('/api/contact')" > ${app}/src/server.ts ;;`,
    `  *"cp -a '/tmp/angular-source/"*) mkdir -p ${app} && printf '%s' "$PKGJSON" > ${app}/package.json && { [ -z "$NGJSON" ] || printf '%s' "$NGJSON" > ${app}/angular.json ; } && { [ -z "$LOCK" ] || touch ${app}/$LOCK ; } ;;`,
    `  *" run build"*) case "$BUILD" in server) mkdir -p ${app}/dist/demo/server && touch ${app}/dist/demo/server/server.mjs ;; browser) mkdir -p ${app}/dist/demo/browser && touch ${app}/dist/demo/browser/index.html ;; esac ;;`,
    'esac ; return 0 ; }',
    opts.layer || '',
    'PROJECT_NAME=app1',
    'angular_build',
  ].join('\n');
  const r = spawnSync('bash', ['-c', `source ${FUNCTIONS}\n${script}`], { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: root, WORKSPACE_SCRIPTS: scripts, doc_name: 'dev', INSTALL: 'yes', PKGJSON: '', NGJSON: '', LOCK: '', BUILD: 'server', ...(opts.env || {}) } });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  const serve = path.join(root, 'dev', 'app1', '.webship-angular', 'serve.sh');
  return { r, calls, root, log, project: path.join(root, 'dev', 'app1'), serve: fs.existsSync(serve) ? fs.readFileSync(serve, 'utf8') : '' };
}

test('a new app: the official starter with server rendering and the demo pages of the pinned pack, built in the container, served by its own server', () => {
  const b = build();
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /^ddev config --project-type=generic --webserver-type=generic --docroot= --project-name=app1 --omit-containers=db --nodejs-version=24$/m);
  assert.ok(fs.readFileSync(path.join(b.project, '.ddev', 'config.angular.yaml'), 'utf8').includes(SERVE), 'the daemon runs the serve script');
  assert.match(b.calls, /^ddev start -y$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html CI=true NG_CLI_ANALYTICS=false npx --yes @angular\/cli@22\.3\.0 new demo --directory app --ssr --defaults --interactive=false --ai-config=none --skip-git --skip-install --package-manager=npm --style=css$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html rm -rf \/tmp\/angular-demo && mkdir -p \/tmp\/angular-demo && cd \/tmp\/angular-demo && npm pack --silent @webship-js\/angular-steps@2\.0\.0 > \/dev\/null && tar -xzf \.\/\*\.tgz && test -d package\/demo && cp -a package\/demo\/\. \/var\/www\/html\/app\/ && rm -rf \/tmp\/angular-demo$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npm install --no-audit --no-fund$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npm run build$/m);
  const order = ['ddev start', '@angular/cli@22.3.0 new', 'npm pack', 'npm install', 'npm run build'].map((s) => b.calls.indexOf(s));
  assert.deepStrictEqual([...order].sort((x, y) => x - y), order, 'made in the container once it runs, the pages over the starter, then installed and built');
  assert.match(b.serve, /^exec env PORT=3000 NG_ALLOWED_HOSTS='app1\.ddev\.site,127\.0\.0\.1,localhost' node dist\/demo\/server\/server\.mjs$/m, 'the server answers the project\'s address');
  assert.doesNotMatch(b.calls, /serve@/, 'an app with server rendering needs no static server');
  assert.match(b.r.stdout, /The app has server rendering: its own server \(dist\/demo\/server\/server\.mjs\) serves it, answering app1\.ddev\.site,127\.0\.0\.1,localhost\./);
  assert.match(b.calls, /curl -sS -o \/dev\/null http:\/\/127\.0\.0\.1:3000\//, '--install waits for the app\'s server');
  assert.match(b.r.stdout, /^Go to https:\/\/app1\.ddev\.site$/m);
  assert.match(b.r.stdout, /dev app1 is served: the Angular app in app\/ \(the official starter of the Angular CLI 22\.3\.0, with the demo pages of @webship-js\/angular-steps 2\.0\.0\)\./);
  assert.doesNotMatch(b.calls, /^ddev stop/m, 'with --install the app stays served');
  assert.doesNotMatch(b.calls, /git clone|@latest/, 'nothing is cloned, nothing is taken at latest');
});

test('without --install the app is built and the project stopped; --template minimal is the starter alone', () => {
  const b = build({ env: { INSTALL: '', TEMPLATE: 'minimal' } });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /@angular\/cli@22\.3\.0 new demo --directory app --ssr /);
  assert.doesNotMatch(b.calls, /npm pack/, 'no demo pages');
  assert.match(b.calls, /^ddev stop$/m, 'ddev stop takes no -y');
  assert.match(b.r.stdout, /dev app1 is ready: the Angular app in app\/ \(the official starter of the Angular CLI 22\.3\.0\)\./);
  assert.match(b.r.stdout, /Serve it with: cd app1 && ddev start/);
});

const OWN = '{"name":"own","scripts":{"build":"ng build"},"dependencies":{"@angular/core":"^21.0.0"}}';

test('an app of your own without server rendering: its files for the browser, served by the pinned static server with the single-page fallback', () => {
  const b = build({ env: { SOURCE: 'https://example.com/apps.git', REF: 'main', APP_PATH: 'web', PKGJSON: OWN, NGJSON: ANGULAR_JSON, BUILD: 'browser' } });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /git clone --quiet --depth 1 --branch 'main' 'https:\/\/example\.com\/apps\.git' \/tmp\/angular-source/);
  assert.match(b.calls, /test -f '\/tmp\/angular-source\/web\/package\.json' && mkdir -p \/var\/www\/html\/app && cp -a '\/tmp\/angular-source\/web\/\.' \/var\/www\/html\/app\/ && rm -rf \/var\/www\/html\/app\/\.git/);
  assert.doesNotMatch(b.calls, /@angular\/cli@|npm pack/, 'no new app is made, and no demo page is added');
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npm install$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html npm install --prefix \/var\/www\/html\/\.webship-angular\/serve --no-audit --no-fund --no-save serve@14\.2\.8$/m);
  assert.match(b.r.stdout, /The app has no server rendering: its files for the browser \(dist\/demo\/browser\/\) are served by a static server that falls back to the app's single page \(serve 14\.2\.8\)\./);
  assert.match(b.serve, /-s dist\/demo\/browser -l tcp:\/\/0\.0\.0\.0:3000/);
  assert.match(fs.readFileSync(path.join(b.project, '.ddev', 'config.angular.yaml'), 'utf8'), /^# app: https:\/\/example\.com\/apps\.git \(main\), web\/$/m);
});

test('an app of your own with pnpm or yarn: installed and built through corepack', () => {
  for (const [lock, pm] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn']]) {
    const b = build({ env: { SOURCE: 'https://example.com/app.git', PKGJSON: OWN, NGJSON: ANGULAR_JSON, LOCK: lock } });
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.match(b.calls, new RegExp(`^ddev exec -d /var/www/html/app COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack ${pm} install$`, 'm'));
    assert.match(b.calls, new RegExp(`^ddev exec -d /var/www/html/app COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack ${pm} run build$`, 'm'));
  }
});

test('a build that leaves neither a server nor files for the browser stops with a message, and serves nothing', () => {
  const b = build({ env: { BUILD: 'none' } });
  assert.strictEqual(b.r.status, 1);
  assert.match(b.r.stdout, /The build left neither a server \(dist\/<project>\/server\/server\.mjs\) nor files for the browser \(index\.html\)/);
  assert.doesNotMatch(b.calls, /curl/, 'nothing is waited for');
  assert.strictEqual(b.serve, '', 'no serve script');
});

test('an app that is not an Angular app, takes packages of its repository\'s workspace, or needs Bun stops the build with a message', () => {
  for (const [env, message] of [
    [{ PKGJSON: '{"dependencies":{"react":"^19.0.0"}}', NGJSON: ANGULAR_JSON }, /is not an Angular app \(no @angular\/core in its package\.json, or no angular\.json\)/],
    [{ PKGJSON: OWN }, /is not an Angular app/],
    [{ PKGJSON: '{"dependencies":{"@angular/core":"^22.3.0","ui":"workspace:*"}}', NGJSON: ANGULAR_JSON }, /takes packages of a workspace of its repository/],
    [{ PKGJSON: OWN, NGJSON: ANGULAR_JSON, LOCK: 'bun.lock' }, /installed with Bun \(its lock file\), which is not in the app's container/],
  ] as Array<[Record<string, string>, RegExp]>) {
    const b = build({ env: { SOURCE: 'https://example.com/app.git', ...env } });
    assert.strictEqual(b.r.status, 1, JSON.stringify(env));
    assert.match(b.r.stdout, message);
    assert.doesNotMatch(b.calls, / install$| run build$/m, 'nothing is installed or built');
  }
});

test('--template with --source, an unknown template, --path without --source, a path out of the repository, or a bad project name stop the build before anything is made', () => {
  for (const [env, message] of [
    [{ TEMPLATE: 'minimal', SOURCE: 'https://example.com/app.git' }, /--template makes a new app, and --source takes an app of your own: give one of them\./],
    [{ TEMPLATE: 'library' }, /--template takes demo or minimal/],
    [{ APP_PATH: 'web' }, /--path names a folder of the repository given with --source: give --source too\./],
    [{ SOURCE: 'https://example.com/app.git', APP_PATH: '../etc' }, /take a repository, a branch or tag, and a folder inside the repository/],
    [{ SOURCE: "https://example.com/app.git'; rm -rf /" }, /take a repository, a branch or tag, and a folder inside the repository/],
  ] as Array<[Record<string, string>, RegExp]>) {
    const b = build({ env });
    assert.strictEqual(b.r.status, 1, JSON.stringify(env));
    assert.match(b.r.stdout, message);
    assert.strictEqual(b.calls, '', 'no ddev command ran');
    assert.ok(!fs.existsSync(b.project), 'no project folder was made');
  }
  const b = spawnSync('bash', ['-c', `source ${FUNCTIONS}\ntrim_project_name() { :; } ; ddev() { echo ran ; } ; PROJECT_NAME=App_1 ; angular_build`], { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: os.tmpdir(), doc_name: 'dev' } });
  assert.strictEqual(b.status, 1);
  assert.match(b.stdout, /The project name App_1 must be small letters, digits and dashes/);
  assert.doesNotMatch(b.stdout, /^ran$/m);
});

/** The core's runtime layer, as far as the builder asks it: the runtime, the address, the claim, the stack. */
const layer = (rt: string, url: string) => [
  `runtime_of() { echo ${rt} ; }`,
  `rt_url() { echo ${url} ; }`,
  'rt_claim() { echo "rt_claim $*" >> "$WORKSPACE_ROOT/ddev.log" ; }',
  'rt_stack() { echo "rt_stack $*" >> "$WORKSPACE_ROOT/ddev.log" ; }',
  'rt_web_build() { echo "rt_web_build $*" >> "$WORKSPACE_ROOT/ddev.log" ; cat > /dev/null ; }',
  'rt_serve() { echo "rt_serve $1" >> "$WORKSPACE_ROOT/ddev.log" ; printf "%s\\n" "$2" > "$WORKSPACE_ROOT/serve.txt" ; }',
].join(' ; ');

test('on DDEV the build runs the same commands with the runtime layer as without it', () => {
  const without = build();
  const withLayer = build({ layer: layer('ddev', 'https://app1.ddev.site') });
  for (const b of [without, withLayer]) {
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.doesNotMatch(b.calls, /rt_claim|rt_stack|rt_serve/, 'the language stack is for the other runtimes');
  }
  assert.strictEqual(withLayer.calls, without.calls, 'the same ddev commands, to the letter');
  assert.strictEqual(withLayer.serve, without.serve, 'the same serve script');
});

for (const [rt, url, host] of [['docker', 'http://127.0.0.1:43210', '127.0.0.1,localhost'], ['podman', 'http://127.0.0.1:43211', '127.0.0.1,localhost'], ['kubernetes', 'http://172.18.0.2:30080', '172.18.0.2,127.0.0.1,localhost']]) {
  test(`on ${rt}: the claim, Node.js's own image at the workspace's version, the serve script told the runtime's host; never a ddev.site`, () => {
    const b = build({ layer: layer(rt, url), env: { RUNTIME: rt } });
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.match(b.calls, /^ddev config --project-type=generic --webserver-type=generic --docroot= --project-name=app1 --omit-containers=db --auto$/m);
    assert.match(b.calls, /^rt_claim angular$/m);
    assert.match(b.calls, /^rt_stack node 24$/m);
    assert.match(b.calls, /^rt_serve 3000$/m);
    assert.doesNotMatch(b.calls, /rt_web_build/, 'Node.js\'s image and the stack\'s layer carry all the app needs');
    assert.strictEqual(fs.readFileSync(path.join(b.root, 'serve.txt'), 'utf8').trim(), SERVE);
    assert.ok(b.serve.includes(`NG_ALLOWED_HOSTS='${host}'`), b.serve);
    assert.ok(!fs.existsSync(path.join(b.project, '.ddev')), 'no .ddev folder: it would make the project a DDEV one');
    assert.ok(b.calls.indexOf('ddev config') < b.calls.indexOf('rt_claim angular'), 'the claim comes after the runtime\'s files are written');
    assert.match(b.calls, /@angular\/cli@22\.3\.0 new demo --directory app --ssr/, 'the app is made in the container, as on DDEV');
    assert.match(b.calls, /npm pack --silent @webship-js\/angular-steps@2\.0\.0/, 'with the same demo pages');
    assert.match(b.r.stdout, new RegExp(`^Go to ${url.replace(/[.:/]/g, '\\$&')}$`, 'm'));
    assert.doesNotMatch(b.r.stdout, /ddev\.site/, 'no message names a DDEV address');
  });
}

test('--runtime on a core without the runtime layer is refused, and nothing is started', () => {
  const b = build({ env: { RUNTIME: 'docker' } });
  assert.strictEqual(b.r.status, 1);
  assert.match(b.r.stdout, /--runtime docker needs a Webship Workspace with the container runtimes \(webship\/workspace#694\)/);
  assert.strictEqual(b.calls, '', 'no ddev command ran');
  assert.ok(!fs.existsSync(b.project), 'no project folder was made');
});

for (const rt of ['lando', 'docksal']) {
  test(`a runtime this builder is not proven on (${rt}, the workspace's setting) stops the build before anything is made`, () => {
    const b = build({ layer: layer(rt, 'http://127.0.0.1:43212') });
    assert.strictEqual(b.r.status, 1);
    assert.match(b.r.stdout, new RegExp(`builds on DDEV, Docker Compose, Podman and Kubernetes for now \\(--runtime ddev, docker, podman or kubernetes\\), not on ${rt}`));
    assert.strictEqual(b.calls, '', 'no ddev command ran');
    assert.ok(!fs.existsSync(b.project), 'no project folder was made');
  });
}

test('a project of the builder is known by DDEV\'s file, else by the core\'s rt_is_platform', () => {
  let r = bash('rt_is_platform() { echo "asked $*" ; return 0 ; } ; angular_is_project /x/app1');
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'asked /x/app1 angular');
  r = bash('rt_is_platform() { return 1 ; } ; angular_is_project /x/app1');
  assert.strictEqual(r.status, 1);
  const p = project('demo');
  assert.strictEqual(bash(`angular_is_project ${p.dir}`).status, 0, 'without the layer, .ddev/config.angular.yaml says so');
  fs.rmSync(path.join(p.dir, '.ddev', 'config.angular.yaml'));
  assert.strictEqual(bash(`angular_is_project ${p.dir}`).status, 1);
});

test('the package manager of an app is read from its lock file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-pm-'));
  const pm = () => bash(`angular_package_manager ${dir}`).stdout.trim();
  assert.strictEqual(pm(), 'npm', 'no lock file: npm');
  for (const [lock, wanted] of [['package-lock.json', 'npm'], ['yarn.lock', 'yarn'], ['pnpm-lock.yaml', 'pnpm'], ['bun.lockb', 'pnpm']]) {
    fs.writeFileSync(path.join(dir, lock), '');
    assert.strictEqual(pm(), wanted, lock);
  }
  assert.strictEqual(bash('angular_pm npm').stdout.trim(), 'npm');
  assert.strictEqual(bash('angular_pm pnpm').stdout.trim(), 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm');
});

test('the builder takes the runtimes it is proven on and the two templates, and never a flag that would take the name PATH', () => {
  const args = read('scripts/args/arg-angular.sh');
  assert.match(args, /choices=\['ddev', 'docker', 'podman', 'kubernetes'\]/);
  assert.match(args, /dest='RUNTIME',\n\s+default="_none_"/);
  assert.match(args, /'--template',\n\s+dest='TEMPLATE',\n\s+default="_none_",\n\s+choices=\['demo', 'minimal'\]/);
  assert.match(args, /'--path',\n\s+dest='APP_PATH',/, '--path would otherwise set PATH');
  for (const help of args.match(/help='[^\n]*/g) || []) assert.match(help, /^help='[^']*'\)?$/, help);
  const src = read('scripts/functions/fun-angular.sh');
  assert.match(src, /^readonly ANGULAR_RUNTIMES='ddev docker podman kubernetes';$/m);
  assert.match(src, /^readonly ANGULAR_TEMPLATES='demo minimal';$/m);
});

test('the first feature names no framework or platform in the words of a step', () => {
  const feature = read('testing/site.feature');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s.replace(/"[^"]*"/g, '""'), /angular|vue|nuxt|vite|node|drupal|wordpress|joomla/i, s);
});
