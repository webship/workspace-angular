#!/usr/bin/env bash

# Angular for the Webship Workspace: make an Angular app with the official starter (or take one from its repository),
# build it and serve it from a container of its own, and wire the Angular step pack into the testing setup of that app.
#
# Placed by `plugins.sh --install angular` in core/scripts/plugins/angular/functions/, where bootstrap sources it after
# the core's own functions. Everything runs in the project's containers, never on the host: Node.js is the app's
# language and runs in the app's own container, where the app is made (the Angular CLI, `ng new`, pinned), built
# (`ng build`, the app's own build script) and served:
#   - an app with server rendering by its own server (`node dist/<project>/server/server.mjs`), told the hosts it
#     answers (NG_ALLOWED_HOSTS: Angular's server answers any other host with 400);
#   - an app without it (its build is only files for the browser) by a static server that falls back to the app's
#     single page (`serve -s`, pinned), so the app's own router answers every address.
# The runtimes:
#   - DDEV (the default): a project with DDEV's generic web server and the Node.js of the workspace rule in its web
#     container; the app's server is a daemon of the web container, and the router sends the project's address to it
#     (.ddev/config.angular.yaml).
#   - Docker Compose, Podman and Kubernetes (--runtime docker, podman, kubernetes): the language stack of the core's
#     runtime layer (webship/workspace#841): Node.js's own image at the same major version (rt_stack node), and the
#     app's server as the web container's own (rt_serve); at http://127.0.0.1:<port>, or on Kubernetes (kind) at the
#     node's address and a NodePort. There is no database, so Kubernetes needs core 1.0.35 or newer
#     (webship/workspace#884).
# Lando and Docksal are not proven for it yet: asked for one, the builder says so and changes nothing.
#
# The project's folder: app/ (the Angular app: the official starter, the starter with the demo pages of the Angular
# step pack, or a repository cloned with --source), app/dist/ (its build), and .webship-angular/ (the script that serves
# the build, written once it is there, and the static server for an app without server rendering). There is no
# database.
#
# The container tool has no project type for Angular, so a project of this builder is recognised by its mark
# (.ddev/config.angular.yaml on DDEV, `platform: angular` in compose.yaml elsewhere), and four names are the ones the
# core's tools look for:
#   set_angular_users          an empty list: the app has no accounts of the workspace's  (cmd-tools-add-users.sh)
#   add_angular_users          says so, and adds nothing                                  (the same tool)
#   cancel_angular_users       says so, and removes nothing                               (cmd-tools-cancel-users.sh)
#   testing_configure_angular  the step pack in the testing stack                         (cmd-tools-testing.sh)

# The step pack an app is tested with, and the release line it is required at.
readonly ANGULAR_STEPS_PACKAGE='@webship-js/angular-steps';
readonly ANGULAR_STEPS_VERSION='^2.0.1';

# The release of the step pack whose demo pages the demo template takes: pinned, so the demo the builder makes is the
# one that pack's features were proven on.
readonly ANGULAR_DEMO_PACK_VERSION='2.0.1';

# The Angular CLI (https://github.com/angular/angular-cli), at the release the builder is proven with.
readonly ANGULAR_CLI_VERSION='22.3.0';

# The static server of an app without server rendering (https://github.com/vercel/serve, MIT), pinned.
readonly ANGULAR_SERVE_VERSION='14.2.8';

# Node.js, the app's language, at the major version of the workspace rule: DDEV's web container on DDEV, the stack's
# image (node:<version>-bookworm-slim) on another runtime.
readonly ANGULAR_NODE_VERSION='24';

# The port the app's server listens on in the web container, the app's folder, and the builder's own folder.
readonly ANGULAR_PORT='3000';
readonly ANGULAR_APP='app';
readonly ANGULAR_OWN='.webship-angular';

# The templates a new app can be made from, and the runtimes an app is built on.
readonly ANGULAR_TEMPLATES='demo minimal';
readonly ANGULAR_RUNTIMES='ddev docker podman kubernetes';

# The app has no accounts of the workspace's: the list is empty.
function set_angular_users() {
  users=();
}

# The runtime of the project in this folder, or of a new build (--runtime, else the workspace's setting, else DDEV).
# A core without the runtime layer has DDEV only.
function angular_runtime() {
  if declare -f runtime_of > /dev/null ; then runtime_of ; else echo 'ddev' ; fi
}

# The address of the app in this folder: https://<name>.ddev.site on DDEV, http://127.0.0.1:<port> on Docker Compose
# and Podman, the node's address and a port on Kubernetes. Asked after `ddev config`.
function angular_url() {
  if declare -f rt_url > /dev/null ; then rt_url ; else echo "https://${PROJECT_NAME}.ddev.site" ; fi
}

# The project's folder in the web container.
function angular_root() {
  echo '/var/www/html' ;
}

# Is this folder a project of the Angular builder? On DDEV the builder leaves .ddev/config.angular.yaml in it; on
# another runtime it claims the project (`platform: angular` in the x-webship block).
function angular_is_project() {
  local project_path="$1";
  [ -f "${project_path}/.ddev/config.angular.yaml" ] && return 0 ;
  declare -f rt_is_platform > /dev/null && rt_is_platform "${project_path}" angular ;
}

# The hosts Angular's server answers (its guard against server-side request forgery answers any other with 400): the
# host of the project's address, and the container's own names, for a check from inside it.
function angular_allowed_hosts() {
  local url="$1" host ;
  host="$(echo "${url}" | sed -E 's#^[a-z]+://##; s#[:/].*$##')" ;
  if [ -n "${host}" ] && [ "${host}" != '127.0.0.1' ] && [ "${host}" != 'localhost' ] ; then
    echo "${host},127.0.0.1,localhost" ;
  else
    echo '127.0.0.1,localhost' ;
  fi
}

# The command the app's container runs: it waits for the builder's serve script (written once the app is built), then
# runs it. No space before a `;`: in the supervisor configuration DDEV writes from it, " ;" starts a comment.
function angular_serve_command() {
  local root ; root="$(angular_root)" ;
  echo "while [ ! -f ${root}/${ANGULAR_OWN}/serve.sh ]; do sleep 2; done; exec bash ${root}/${ANGULAR_OWN}/serve.sh" ;
}

# What DDEV is told about the app: the router sends the project's address to the app's server, which the web container
# runs as a daemon. The file also marks the project as one of this builder.
function angular_write_ddev_config() {
  local project_path="$1" made="$2" ;
  mkdir -p "${project_path}/.ddev" || return 1 ;
  cat > "${project_path}/.ddev/config.angular.yaml" <<YAMLEOF
# An Angular app in this project. Written by the Angular builder of the workspace; build again rather than editing by
# hand. The web container serves no files of its own: the router sends ports 80 and 443 of the project's address to
# the app's server, a daemon of the web container that runs ${ANGULAR_OWN}/serve.sh once the builder has written it.
# app: ${made}
web_extra_exposed_ports:
  - name: angular
    container_port: ${ANGULAR_PORT}
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: angular
    command: "bash -c '$(angular_serve_command)'"
    directory: $(angular_root)
YAMLEOF
}

# On another runtime than DDEV (webship/workspace#841): the plugin's claim, Node.js's own image as the stack, and the
# app's server as the web container's own, once the app is built.
function angular_runtime_config() {
  rt_claim angular || return 1 ;
  rt_stack node "${ANGULAR_NODE_VERSION}" || return 1 ;
  rt_serve "${ANGULAR_PORT}" "$(angular_serve_command)" ;
}

# Wait until the app's server answers (any answer of HTTP: an app of your own may ask for a sign-in at its root).
function angular_wait() {
  local attempt ;
  for attempt in $(seq 1 60) ; do
    if ddev exec "curl -sS -o /dev/null http://127.0.0.1:${ANGULAR_PORT}/" < /dev/null > /dev/null 2>&1 ; then
      return 0 ;
    fi
    sleep 2 ;
  done
  echo "The app's server does not answer." ;
  return 1 ;
}

# The package manager of an app from its lock file: npm (package-lock.json, or none), pnpm or yarn, the last two
# through Node.js's corepack. Bun is not in the app's container.
function angular_package_manager() {
  local app="$1" ;
  if [ -f "${app}/pnpm-lock.yaml" ] ; then echo 'pnpm' ;
  elif [ -f "${app}/yarn.lock" ] ; then echo 'yarn' ;
  elif [ -f "${app}/bun.lock" ] || [ -f "${app}/bun.lockb" ] ; then echo 'bun' ;
  else echo 'npm' ; fi
}

# The command line of a package manager in the container: pnpm and yarn through corepack, without its prompt.
function angular_pm() {
  case "$1" in
    npm) echo 'npm' ;;
    *) echo "COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack $1" ;;
  esac
}

# The build of the app's project, read from its angular.json once it is built: "server <folder>" for a build with
# server rendering (its server is <folder>/server/server.mjs), "browser <folder>" for one without it (files for the
# browser in <folder>/browser, or in <folder> itself for an older build), or nothing.
function angular_build_kind() {
  local app="$1" ;
  python3 - "${app}" <<'PYEOF'
import json, os, sys
app = sys.argv[1]
try:
    ws = json.load(open(os.path.join(app, 'angular.json')))
except Exception:
    sys.exit(0)
projects = ws.get('projects') or {}
apps = [n for n, p in projects.items() if (p or {}).get('projectType', 'application') == 'application']
name = ws.get('defaultProject') if ws.get('defaultProject') in apps else (apps[0] if apps else None)
if not name:
    sys.exit(0)
options = ((projects[name].get('architect') or projects[name].get('targets') or {}).get('build') or {}).get('options') or {}
out = options.get('outputPath') or f'dist/{name}'
if isinstance(out, dict):
    out = out.get('base') or f'dist/{name}'
out = out.rstrip('/')
if os.path.isfile(os.path.join(app, out, 'server', 'server.mjs')):
    print(f'server {out}')
elif os.path.isfile(os.path.join(app, out, 'browser', 'index.html')) or os.path.isfile(os.path.join(app, out, 'browser', 'index.csr.html')):
    print(f'browser {out}/browser')
elif os.path.isfile(os.path.join(app, out, 'index.html')):
    print(f'browser {out}')
PYEOF
}

# The script that serves the build, written once the app is built: the app's own server with the hosts it answers, or
# the static server with the fallback to the app's single page.
function angular_write_serve() {
  local project_path="$1" kind="$2" folder="$3" hosts="$4" root ;
  root="$(angular_root)" ;
  mkdir -p "${project_path}/${ANGULAR_OWN}" || return 1 ;
  if [ "${kind}" = 'server' ] ; then
    cat > "${project_path}/${ANGULAR_OWN}/serve.sh" <<SERVEEOF
#!/usr/bin/env bash
# Written by the Angular builder of the workspace: the app's own server (server rendering), told the hosts it answers.
cd ${root}/${ANGULAR_APP} || exit 1
exec env PORT=${ANGULAR_PORT} NG_ALLOWED_HOSTS='${hosts}' node ${folder}/server/server.mjs
SERVEEOF
  else
    cat > "${project_path}/${ANGULAR_OWN}/serve.sh" <<SERVEEOF
#!/usr/bin/env bash
# Written by the Angular builder of the workspace: the app has no server rendering, so its build for the browser is
# served by a static server that falls back to the app's single page (serve ${ANGULAR_SERVE_VERSION}, -s).
cd ${root}/${ANGULAR_APP} || exit 1
exec node ${root}/${ANGULAR_OWN}/serve/node_modules/serve/build/main.js -s ${folder} -l tcp://0.0.0.0:${ANGULAR_PORT} --no-clipboard
SERVEEOF
  fi
}

# The app in app/: a new one of the Angular CLI (the official starter with server rendering; the demo template puts
# the demo pages of the Angular step pack over it, at the pack's pinned release), or the folder of a repository. An app
# of your own must be an Angular app whose packages are its own (not those of a workspace of its repository).
function angular_get_app() {
  local project_path="$1" template="$2" source="$3" ref="$4" app_path="$5" root ;
  root="$(angular_root)" ;
  if [ -z "${source}" ] ; then
    echo "Making a new app with the Angular CLI (${ANGULAR_CLI_VERSION}): its official starter, with server rendering." ;
    ddev exec -d "${root}" "CI=true NG_CLI_ANALYTICS=false npx --yes @angular/cli@${ANGULAR_CLI_VERSION} new demo --directory ${ANGULAR_APP} --ssr --defaults --interactive=false --ai-config=none --skip-git --skip-install --package-manager=npm --style=css" < /dev/null \
      || { echo "ng new failed." ; return 1 ; } ;
    if [ "${template}" = 'demo' ] ; then
      echo "Putting the demo pages of ${ANGULAR_STEPS_PACKAGE} ${ANGULAR_DEMO_PACK_VERSION} over the starter." ;
      ddev exec -d "${root}" "rm -rf /tmp/angular-demo && mkdir -p /tmp/angular-demo && cd /tmp/angular-demo && npm pack --silent ${ANGULAR_STEPS_PACKAGE}@${ANGULAR_DEMO_PACK_VERSION} > /dev/null && tar -xzf ./*.tgz && test -d package/demo && cp -a package/demo/. ${root}/${ANGULAR_APP}/ && rm -rf /tmp/angular-demo" < /dev/null \
        || { echo "The demo pages of ${ANGULAR_STEPS_PACKAGE} ${ANGULAR_DEMO_PACK_VERSION} could not be taken from npm." ; return 1 ; } ;
    fi
    echo "Installing the app's packages with npm." ;
    ddev exec -d "${root}/${ANGULAR_APP}" "npm install --no-audit --no-fund" < /dev/null \
      || { echo "npm install failed." ; return 1 ; } ;
    return 0 ;
  fi
  echo "Getting the app: ${source}${ref:+ at ${ref}}${app_path:+, its folder ${app_path}/}" ;
  ddev exec "rm -rf /tmp/angular-source && git clone --quiet --depth 1 ${ref:+--branch '${ref}'} '${source}' /tmp/angular-source" < /dev/null \
    || { echo "The app could not be cloned from ${source}${ref:+ at ${ref}}." ; return 1 ; } ;
  ddev exec "test -f '/tmp/angular-source/${app_path:+${app_path}/}package.json' && mkdir -p ${root}/${ANGULAR_APP} && cp -a '/tmp/angular-source/${app_path:+${app_path}/}.' ${root}/${ANGULAR_APP}/ && rm -rf ${root}/${ANGULAR_APP}/.git" < /dev/null \
    || { echo "${source}${app_path:+ (${app_path}/)} has no package.json: it is not the folder of an app." ; return 1 ; } ;
  ddev exec "rm -rf /tmp/angular-source" < /dev/null ;
  local app="${project_path}/${ANGULAR_APP}" ;
  if ! grep -q '"@angular/core"' "${app}/package.json" || [ ! -f "${app}/angular.json" ] ; then
    echo "${source}${app_path:+ (${app_path}/)} is not an Angular app (no @angular/core in its package.json, or no angular.json): this builder makes and serves Angular apps." ;
    return 1 ;
  fi
  if grep -q '"workspace:' "${app}/package.json" ; then
    echo "The app takes packages of a workspace of its repository (\"workspace:\" in its package.json), which are not copied with it: build it from a repository of its own." ;
    return 1 ;
  fi
  local pm ; pm="$(angular_package_manager "${app}")" ;
  if [ "${pm}" = 'bun' ] ; then
    echo "The app is installed with Bun (its lock file), which is not in the app's container: npm, pnpm and yarn are." ;
    return 1 ;
  fi
  echo "Installing the app's packages with ${pm}." ;
  ddev exec -d "${root}/${ANGULAR_APP}" "$(angular_pm "${pm}") install" < /dev/null \
    || { echo "${pm} install failed." ; return 1 ; } ;
}

# Build an app from nothing: the project and its container, the app, its build, the script that serves it, and with
# --install the app served and checked.
function angular_build() {
  trim_project_name ;
  local base_url runtime ;
  runtime="$(angular_runtime)" ;
  if [ "${RUNTIME:-_none_}" != '_none_' ] && [ "${RUNTIME}" != "${runtime}" ] ; then
    echo "--runtime ${RUNTIME} needs a Webship Workspace with the container runtimes (webship/workspace#694): update the workspace, or build on DDEV." ;
    exit 1 ;
  fi
  case " ${ANGULAR_RUNTIMES} " in
    *" ${runtime} "*) ;;
    *) echo "An Angular app builds on DDEV, Docker Compose, Podman and Kubernetes for now (--runtime ddev, docker, podman or kubernetes), not on ${runtime}: that runtime is not proven for it yet. Nothing was changed." ; exit 1 ;;
  esac
  if [ "${runtime}" != 'ddev' ] && ! declare -f rt_serve > /dev/null ; then
    echo "Angular on ${runtime} needs a Webship Workspace whose runtimes take an application's own language and server (webship/workspace#841, core 1.0.32 or later): update the workspace, or build on DDEV." ;
    exit 1 ;
  fi
  local source="${SOURCE:-${app_source:-}}" ;
  local ref="${REF:-${app_source_ref:-}}" ;
  local app_path="${APP_PATH:-${app_source_path:-}}" ;
  local template="${TEMPLATE:-_none_}" ;
  [ "${template}" = '_none_' ] && template='' ;
  if [ -n "${template}" ] && [ -n "${source}" ] ; then
    echo "--template makes a new app, and --source takes an app of your own: give one of them. Nothing was changed." ;
    exit 1 ;
  fi
  [ -z "${source}" ] && template="${template:-demo}" ;
  case " ${ANGULAR_TEMPLATES} " in
    *" ${template:-demo} "*) ;;
    *) echo "--template takes demo or minimal: the official starter with the step pack's demo pages, or the starter alone. Nothing was changed." ; exit 1 ;;
  esac
  if [ -n "${app_path}" ] && [ -z "${source}" ] ; then
    echo "--path names a folder of the repository given with --source: give --source too. Nothing was changed." ;
    exit 1 ;
  fi
  if [[ "${app_path}" == /* ]] || [[ "/${app_path}/" == */../* ]] || [[ "${app_path}" == *"'"* ]] || [[ "${source}${ref}" == *"'"* ]] ; then
    echo "--source, --ref and --path take a repository, a branch or tag, and a folder inside the repository. Nothing was changed." ;
    exit 1 ;
  fi
  if [ ${#PROJECT_NAME} -gt 40 ] || ! [[ "${PROJECT_NAME}" =~ ^[a-z0-9][a-z0-9-]*$ ]] ; then
    echo "The project name ${PROJECT_NAME} must be small letters, digits and dashes (its address and its containers take it). Nothing was changed." ;
    exit 1 ;
  fi
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" ;
  local root ; root="$(angular_root)" ;
  local made ;
  if [ -n "${source}" ] ; then made="${source}${ref:+ (${ref})}${app_path:+, ${app_path}/}" ;
  elif [ "${template}" = 'demo' ] ; then made="the official starter of the Angular CLI ${ANGULAR_CLI_VERSION}, with the demo pages of ${ANGULAR_STEPS_PACKAGE} ${ANGULAR_DEMO_PACK_VERSION}" ;
  else made="the official starter of the Angular CLI ${ANGULAR_CLI_VERSION}" ; fi

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  # A project of the same name goes first, with its containers.
  drop_database ;
  rm -rf "${PROJECT_NAME:?}" ;
  mkdir -p "${PROJECT_NAME}" ;
  cd "${project_path}" || exit 1 ;

  # A generic web server, no database, and Node.js in the app's container: the app's own server serves it.
  if [ "${runtime}" == 'ddev' ] ; then
    ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
      --omit-containers=db --nodejs-version=$(ddev_nodejs_version) < /dev/null || exit 1 ;
    angular_write_ddev_config "${project_path}" "${made}" || exit 1 ;
  else
    # The runtime's own project: Docker Compose, Podman or Kubernetes, through the runtime layer.
    ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
      --omit-containers=db --auto < /dev/null || exit 1 ;
    angular_runtime_config || { echo "The app's stack could not be written through the runtime layer." ; exit 1 ; } ;
  fi
  # The address is the runtime's to say, once the project is configured: never a written ddev.site.
  base_url="$(angular_url)" ;

  echo "Starting the project: Node.js ${ANGULAR_NODE_VERSION} in the app's container." ;
  ddev_up start -y < /dev/null || exit 1 ;

  angular_get_app "${project_path}" "${template}" "${source}" "${ref}" "${app_path}" || exit 1 ;

  local pm ; pm="$(angular_package_manager "${project_path}/${ANGULAR_APP}")" ;
  echo "Building the app: ${pm} run build." ;
  ddev exec -d "${root}/${ANGULAR_APP}" "$(angular_pm "${pm}") run build" < /dev/null \
    || { echo "The app's build failed." ; exit 1 ; } ;
  local build kind folder ;
  build="$(angular_build_kind "${project_path}/${ANGULAR_APP}")" ;
  kind="${build%% *}" ; folder="${build#* }" ;
  if [ -z "${build}" ] ; then
    echo "The build left neither a server (dist/<project>/server/server.mjs) nor files for the browser (index.html) where the app's angular.json says: the builder cannot serve it." ;
    exit 1 ;
  fi
  if [ "${kind}" = 'browser' ] ; then
    echo "The app has no server rendering: its files for the browser (${folder}/) are served by a static server that falls back to the app's single page (serve ${ANGULAR_SERVE_VERSION})." ;
    ddev exec -d "${root}" "npm install --prefix ${root}/${ANGULAR_OWN}/serve --no-audit --no-fund --no-save serve@${ANGULAR_SERVE_VERSION}" < /dev/null \
      || { echo "The static server could not be installed." ; exit 1 ; } ;
  else
    echo "The app has server rendering: its own server (${folder}/server/server.mjs) serves it, answering $(angular_allowed_hosts "${base_url}")." ;
  fi
  angular_write_serve "${project_path}" "${kind}" "${folder}" "$(angular_allowed_hosts "${base_url}")" || exit 1 ;

  [ "${ADD_USERS}" == 'yes' ] && echo "--add-users: the app has no accounts of the workspace's; nothing is added." ;

  if [ "${INSTALL}" == 'yes' ] ; then
    angular_wait || exit 1 ;
    echo "${doc_name} ${PROJECT_NAME} is served: the Angular app in ${ANGULAR_APP}/ (${made})." ;
    echo "Go to ${base_url}" ;
  else
    ddev stop < /dev/null ;
    echo "${doc_name} ${PROJECT_NAME} is ready: the Angular app in ${ANGULAR_APP}/ (${made})." ;
    if [ "${runtime}" = 'ddev' ] ; then
      echo "Serve it with: cd ${PROJECT_NAME} && ddev start   (or build with --install)" ;
    else
      echo "Serve it with Start in its row of the dashboard (or build with --install)" ;
    fi
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The app has no accounts of the workspace's: there is nothing to add, and nothing to remove.
function add_angular_users() {
  echo "The Angular app has no accounts of the workspace's, so there are none to add." ;
}

function cancel_angular_users() {
  echo "The Angular app has no accounts of the workspace's, so there are none to remove." ;
}

# The step pack in the testing stack of an app of this builder. The core's testing_configure calls this in the project
# folder once webship-js is scaffolded and before the dependencies are installed; for a project that is not an app of
# this builder it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's own, and, for the demo
# template, writes a first feature when the project has none of its own. There is no users registry: the app has no
# accounts. Every part is skipped when it is already done, so a second run adds what the first missed and never resets
# a suite. The suite is the project's (its package.json, cucumber.js and tests/ are next to app/, not in it).
function testing_configure_angular() {
  local project_path="$1";
  angular_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Angular: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Angular step pack (${ANGULAR_STEPS_PACKAGE} ${ANGULAR_STEPS_VERSION}).";

  python3 - "${project_path}" "${ANGULAR_STEPS_PACKAGE}" "${ANGULAR_STEPS_VERSION}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version = sys.argv[1:4]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, for the demo template only (an app of your own has its own names), when the project has none
  # for the app yet.
  local feature="${WORKSPACE_SCRIPTS}/plugins/angular/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    if [ -f "${project_path}/${ANGULAR_APP}/src/app/pages/contact.ts" ] && grep -q "/api/contact" "${project_path}/${ANGULAR_APP}/src/server.ts" 2>/dev/null ; then
      mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
        && echo "  tests/features/site.feature: a first feature for the demo" ;
    else
      echo "  Angular: the app is not the demo template, so no first feature is written: write one from what its pages show." ;
    fi
  fi
}
