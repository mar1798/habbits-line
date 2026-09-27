## Purpose

Describes what makes a Habbits Line build publishable in the App Store: how the app
declares its version and legal declarations, how a release is built and submitted, which
listing artifacts live in the repository, and what the user sees about the version and
privacy inside the app.

## ADDED Requirements

### Requirement: Version and build number are declared in the app config

The app configuration SHALL set the user-facing version (`version`) and the build
number (`ios.buildNumber`) explicitly, in one place: `app.json`. The build number MUST
strictly increase between any two uploads to App Store Connect, including two uploads of
the same `version`. Incrementing the number MUST be a step of the release order, not a
side effect of the build.

#### Scenario: The built binary carries the declared numbers

- **WHEN** `expo prebuild` has run and a release archive has been built
- **THEN** `CFBundleShortVersionString` in `Info.plist` equals `version` from `app.json`,
  and `CFBundleVersion` equals `ios.buildNumber`

#### Scenario: Re-uploading the same version

- **WHEN** a build with some number has already been uploaded to App Store Connect and
  another one with the same `version` is being prepared
- **THEN** the release order requires bumping `ios.buildNumber` before the build, and an
  upload with an old or equal number is rejected as an ordering error, not fixed in place

### Requirement: The app declares no non-exempt encryption

The app configuration SHALL declare that the app uses no encryption beyond the
exemptions (`usesNonExemptEncryption: false`), so that an uploaded build does not sit in
App Store Connect with the "Missing Compliance" status and does not require a manual
answer to the export compliance questionnaire on every upload.

#### Scenario: A build is uploaded to App Store Connect

- **WHEN** the build has been processed by App Store Connect
- **THEN** it is available for submission to review without a request for export
  compliance information

### Requirement: The release build contains local reminders

The release build SHALL include the native part of local notifications: reminders are an
advertised feature of the app, and their absence from the built binary makes the listing
description false.

#### Scenario: A reminder in the release build

- **WHEN** in a release build on a device a habit has a reminder enabled and the
  scheduled time arrives
- **THEN** the notification arrives, and tapping it opens the app on that habit

### Requirement: Submission to App Store Connect is reproducible and keeps no secrets in the repository

The repository SHALL contain a submit profile sufficient to upload a locally built `.ipa`
to App Store Connect with one command, without interactively entering the app and team
identifiers. Apple credentials (the App Store Connect API private key, its identifiers
and passwords) MUST NOT get into the repository: the profile refers to them via a path
outside the repository or environment variables, and key file name patterns are covered
by `.gitignore`.

#### Scenario: Uploading a local build

- **WHEN** a release `.ipa` has been built and App Store Connect API credentials are set
- **THEN** one submit command uploads it to App Store Connect without interactive
  questions about the bundle id, app identifier and team

#### Scenario: The key does not leak into history

- **WHEN** the App Store Connect API private key lies in the working copy
- **THEN** `git status` does not show it as an untracked file, and `git add -A` does not
  add it

### Requirement: Listing metadata is stored in the repository in two languages

The repository SHALL contain the App Store metadata as a versioned file, not only as
fields filled in by hand in App Store Connect. The metadata MUST cover the `ru` and
`en-US` localizations (the same two languages as the app UI) and include for each the
name, subtitle, description, keywords and release notes, plus the app-wide categories,
age rating, review contacts and links to the privacy policy and support. Lengths MUST fit
the App Store limits (name and subtitle: 30 characters, keywords field: 100 characters).

#### Scenario: The listing is opened on a Russian device

- **WHEN** a user with a Russian locale opens the app's page in the App Store
- **THEN** they see the name, subtitle and description in Russian

#### Scenario: The listing is opened outside the Russian locale

- **WHEN** a user with any other locale opens the page
- **THEN** they see the English version of the same fields

#### Scenario: Metadata exceeds a limit

- **WHEN** some field exceeds the App Store length limit
- **THEN** this is caught by a metadata check before submission, not by a rejection
  from App Store Connect

### Requirement: Screenshots are taken reproducibly

The repository SHALL contain a set of listing screenshots and a way to retake it with
one command. The set MUST cover the size required for iPhone, 6.9″ (1320 × 2868), and
show the app's main screens (habits, expenses, statistics) on predictable demo data that
is the same from run to run. Screenshots MUST NOT contain debug overlays, empty
placeholder screens or data that does not match the listing description.

#### Scenario: Retaking the set

- **WHEN** the screenshot script runs twice in a row on the same simulator
- **THEN** both runs produce images with identical content at the required resolution

#### Scenario: A screen has changed

- **WHEN** the look of one of the shown screens has changed
- **THEN** an up-to-date set is obtained by rerunning the same script, without manual
  reshooting

### Requirement: The privacy policy is published and matches the app's behavior

The app SHALL have a privacy policy available at a public URL, which is set in App Store
Connect. The policy text MUST exist in Russian and English and MUST match actual
behavior: the app works offline, has no accounts, sends no data to servers and uses no
tracking; the only way data leaves the device is a backup file that the user exports
and sends wherever they choose. The App Privacy declarations ("data not collected", no
tracking) MUST match this text and the privacy manifest in the build.

#### Scenario: A reviewer opens the given URL

- **WHEN** a reviewer opens the policy URL from App Store Connect
- **THEN** the page is publicly available without authentication and contains the
  policy text

#### Scenario: Declarations are checked against behavior

- **WHEN** the App Privacy questionnaire, the policy text and the build's privacy
  manifest are compared
- **THEN** all three say the same thing: no data is collected and there is no tracking

### Requirement: Settings show the version and a link to the policy

The settings screen SHALL contain an About section showing the app version and build
number as they ended up in the binary, and a link to the privacy policy that opens in an
external browser. Both labels MUST exist in `ru` and `en`.

#### Scenario: The user checks the version

- **WHEN** the user opens settings and scrolls to the About section
- **THEN** they see the version and build number matching the uploaded build

#### Scenario: The user opens the policy

- **WHEN** the user taps the privacy policy link
- **THEN** the policy opens in an external browser, and the app is in the same state on
  return

#### Scenario: The language is switched

- **WHEN** English is selected in settings
- **THEN** the About section and its labels are shown in English

### Requirement: The release order is documented

The repository SHALL contain a document describing a release end to end: what gets
bumped, what builds it, what submits it, what is filled in by hand in App Store Connect,
and which external accounts this requires. The document MUST describe what is in the
repository and MUST be updated in the same commit as a change to the release order.

#### Scenario: Releasing from the document

- **WHEN** a release is shipped for the first time after a break, from the document alone
- **THEN** no step requires information that is in neither the document nor the
  repository, other than Apple credentials

### Requirement: The release build passes acceptance before submission

The release build SHALL be checked on a device before submission: clean install, cold
start, launch from a notification tap, backup export and import, both themes, both
languages. The build MUST NOT contain traces of development visible to the user: debug
overlays, test data on first launch, references to a local Metro.

#### Scenario: First launch after a clean install

- **WHEN** a release build is installed on a device with no previous app data and
  launched
- **THEN** the app opens on the empty state, without errors and without calls to the
  local development server

#### Scenario: Acceptance fails

- **WHEN** any acceptance item fails on the release build
- **THEN** the build is not submitted, and the build number is bumped for the next attempt
