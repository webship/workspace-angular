Feature: The demo's contact form
  The form posts to the server without JavaScript, and is sent in place with it; a message too short is refused with
  an alert. Built with `bash cmd-angular-project.sh ngapp --install`, at the address of the app. The fields are filled
  once the page is hydrated: what is typed before is lost when the app takes the page over.

  Background:
    Given I am on "/contact"
    And the page is hydrated
    And I fill in "Your name" with "Ada"

  @critical
  Scenario: A message is accepted, in place
    When I fill in "Your message" with "Hello from the scenarios of the skill."
    And I send the form by its "Send" button
    Then the form should have been answered in place
    And the form should have been accepted
    And I should see "Thanks, Ada: your message was sent."

  # The browser logs the refusal's answer (422) as a console error: a project that fails on browser errors keeps this
  # scenario at warn.
  @js-warn
  Scenario: A message too short is refused, and says why
    When I fill in "Your message" with "Too short"
    And I send the form by its "Send" button
    Then the form should have been refused with "Your message needs at least 10 characters."

  # The counter of the home page changes in place: the steps of webship-js do not wait for the app, the tag does, after
  # each step.
  @idle-after-steps
  Scenario: A count that changes in place
    Given I am on the homepage
    When I press "Add one to the count" by attr
    Then I should see "1" in the "#count" element
