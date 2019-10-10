<!-- gen:toc -->
- [How to Contribute](#how-to-contribute)
  * [Contributor License Agreement](#contributor-license-agreement)
  * [Getting Code](#getting-code)
  * [Code reviews](#code-reviews)
  * [Code Style](#code-style)
  * [Adding New Dependencies](#adding-new-dependencies)
  * [Running & Writing Tests](#running--writing-tests)
<!-- gen:stop -->

# How to Contribute

First of all, thank you for your interest in Rendertron!
We'd love to accept your patches and contributions!

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution,
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to <https://cla.developers.google.com/> to see
your current agreements on file or to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Getting Code

1. Clone this repository

```bash
git clone https://github.com/GoogleChrome/rendertron
cd rendertron
```

2. Install dependencies

```bash
npm install
```

3. Run tests locally. For more information about tests, read [Running & Writing Tests](#running--writing-tests).

```bash
npm test
```

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Code Style

- Coding style is fully defined in [tslint.json](https://github.com/GoogleChrome/rendertron/blob/master/tslint.json)
- Comments should be generally avoided. If the code would not be understood without comments, consider re-writing the code to make it self-explanatory.

To run code linter, use:

```bash
npm run lint
```

## Adding New Dependencies

For all dependencies (both installation and development):
- **Do not add** a dependency if the desired functionality is easily implementable.
- If adding a dependency, it should be well-maintained and trustworthy.

A barrier for introducing new installation dependencies is especially high:
- **Do not add** installation dependency unless it's critical to project success.

## Running & Writing Tests

- Every feature should be accompanied by a test.
- Tests should be *hermetic*. Tests should not depend on external services unless absolutely needed.
- Tests should work on all three platforms: Mac, Linux and Windows.

- To run all tests:

```bash
npm test
```
