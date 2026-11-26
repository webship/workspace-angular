Feature: An Angular app on Docker Compose, Podman and Kubernetes
  The builder builds on DDEV by default, and with --runtime on Docker Compose, Podman or a Kubernetes cluster. An app
  built there has the row a DDEV project has: its state, its own address and the runtime's menu, and its own server
  serves it.

  # Each scenario drives a real app of that runtime, built with cmd-angular-project.sh --runtime: the first running one
  # the workspace holds. Without one it is skipped, with the reason. In the plugin's CI the Docker Compose app is the
  # one the manifest's featuresSite builds: the demo template, ci-angular.

  @needs-runtime-docker @needs-platform-angular
  Scenario: An Angular app built on Docker Compose runs at its own address, with the DOCKER menu
    Given I am on the folder of the "docker" site
     Then the row of the "docker" site should show "Running"
      And the row of the "docker" site should link to the address of its runtime
      And the address of the "docker" site should answer
      And the row of the "docker" site should carry the "DOCKER" menu and no DDEV menu

  # The app's page rendered in the browser alone (the demo template's /client-only, a RenderMode.Client route) is
  # empty in the server's HTML: its text is there only once the app has started in the browser and drawn it.
  @needs-runtime-docker @needs-platform-angular
  Scenario: The app on Docker Compose is the built Angular app, and it takes its page over
    Given I am on the folder of the "docker" site
     When I open "/client-only" on the "docker" site
     Then "#where" should contain text "rendered in the browser" within 30 seconds

  @needs-runtime-podman @needs-platform-angular
  Scenario: An Angular app built on Podman runs at its own address, with the PODMAN menu
    Given I am on the folder of the "podman" site
     Then the row of the "podman" site should show "Running"
      And the row of the "podman" site should link to the address of its runtime
      And the address of the "podman" site should answer
      And the row of the "podman" site should carry the "PODMAN" menu and no DDEV menu

  @needs-runtime-podman @needs-platform-angular
  Scenario: The app on Podman is the built Angular app, and it takes its page over
    Given I am on the folder of the "podman" site
     When I open "/client-only" on the "podman" site
     Then "#where" should contain text "rendered in the browser" within 30 seconds

  @needs-runtime-kubernetes @needs-platform-angular
  Scenario: An Angular app built on Kubernetes runs at the address of its node, with the K8S menu
    Given I am on the folder of the "kubernetes" site
     Then the row of the "kubernetes" site should show "Running"
      And the row of the "kubernetes" site should link to the address of its runtime
      And the address of the "kubernetes" site should answer
      And the row of the "kubernetes" site should carry the "K8S" menu and no DDEV menu

  @needs-runtime-kubernetes @needs-platform-angular
  Scenario: The app on Kubernetes is the built Angular app, and it takes its page over
    Given I am on the folder of the "kubernetes" site
     When I open "/client-only" on the "kubernetes" site
     Then "#where" should contain text "rendered in the browser" within 30 seconds
