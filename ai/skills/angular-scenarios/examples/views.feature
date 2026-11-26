Feature: The views of the demo template
  The official starter with server rendering and the step pack's demo pages: a home page with a counter, an about
  page, posts from the demo's API, a contact form and a page rendered in the browser alone. Built with `bash
  cmd-angular-project.sh ngapp --install`, at the address of the app.

  @critical
  Scenario: A link changes the view by the router, with its title and its active link
    Given I am on the homepage
    When I navigate with the "Posts" link
    Then the router should have changed the view
    And the view's title should be "Posts"
    And the "Posts" link should be the active one
    And the app's address should be "/posts"

  Scenario: A view whose data a resolver fetches, and the browser's back
    Given I am on "/posts"
    When I navigate with the "Moving between pages" link
    Then the router should have changed the view
    And the view's title should be "Moving between pages"
    When I go back one view
    Then the app's address should be "/posts"

  # A guard sends /posts/latest on to the latest post: the steps follow the router to the address it ends at.
  Scenario: A link whose view a guard redirects ends where it was sent
    Given I am on "/posts"
    When I navigate with the "The latest post" link
    Then the router should have changed the view
    And the app's address should be "/posts/3"
    And the view's title should be "Forms"

  Scenario: Data loaded again
    Given I am on "/posts"
    When I press "Load the posts again"
    And I wait for the app's requests to finish
    Then I should see "resolved" in the "#status" element

  Scenario: A page rendered in the browser alone
    Given I am on "/client-only"
    Then the page should have been rendered in the browser alone
    And I should see "rendered in the browser"
