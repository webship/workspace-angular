#!/usr/bin/env bash

# workspace-name: Angular (Angular app)

# Installed by the Angular plugin (plugins.sh --install angular); __WORKSPACE__ is the workspace it was installed into.
#
# Make an Angular app with the Angular CLI (the official starter with server rendering, with the Angular step pack's
# demo pages by default), or take one from its repository with --source, build it, and serve it from a container of
# its own: an app with server rendering by its own server, one without it by a static server that falls back to its
# single page. Node.js, the app's language, runs in the app's container, never on the machine. With --install the app
# is served and checked. It has no database, and no accounts of the workspace's. The workspace is container-based
# (DDEV by default, at https://<name>.ddev.site); --runtime docker, podman or kubernetes builds it on Docker Compose,
# Podman or a Kubernetes cluster instead, at the address that runtime gives.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Where the app comes from: nothing means a new app of the Angular CLI.
app_source="";
app_source_ref="";
app_source_path="";

# Distribution.
distribution_name="angular";
distribution_title="Angular";
distribution_webroot="app/dist";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/angular/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/angular/args/arg-angular.sh || exit 1 ;

shift $#;

angular_build ;
