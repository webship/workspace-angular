Feature: The official starter
  The one welcome page of Angular's official starter with server rendering, prerendered when the app is built. Built
  with `bash cmd-angular-project.sh ngmin --template minimal --install`, at the address of the app.

  @critical
  Scenario: The welcome page is taken over by the app
    Given I am on the homepage
    Then the page should be hydrated
    And I should see "Hello, demo"
    And the view's title should be "Demo"

  Scenario: The page is still there once the app has taken it over
    Given I am on the homepage
    And the page is hydrated
    Then I should see "Congratulations! Your app is running."
