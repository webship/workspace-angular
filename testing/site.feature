Feature: The app answers, changes its views and takes its form
  As the owner of the app
  I want its pages to open, its links to change the view by the router and its form to answer
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup for the demo template, as a starting point: it is yours to change. The
  # steps wait for the app to take each page over, follow the router to the end of each navigation, and send the form
  # the way the app does. The fields are filled once the page is hydrated: what is typed before is lost.

  @critical
  Scenario: The home page is taken over by the app
    Given I am on the homepage
    Then the page should be hydrated
    And I should see "Welcome to the demo"

  @critical
  Scenario: A link changes the view by the router, with its title
    Given I am on the homepage
    When I navigate with the "Posts" link
    Then the router should have changed the view
    And the view's title should be "Posts"
    And the "Posts" link should be the active one

  @critical
  Scenario: A message is accepted
    Given I am on "/contact"
    And the page is hydrated
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the first feature."
    And I send the form by its "Send" button
    Then the form should have been accepted

  # The browser logs the refusal's answer (422) as a console error: a project that fails on browser errors keeps this
  # scenario at warn (@js-warn).
  @js-warn
  Scenario: A message too short is refused
    Given I am on "/contact"
    And the page is hydrated
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Too short"
    And I send the form by its "Send" button
    Then the form should have been refused with "Your message needs at least 10 characters."

  @js-warn
  Scenario: A post that does not exist shows the app's 404 page
    Given I am on "/posts/9"
    Then the app should show its 404 page saying "Post not found"
