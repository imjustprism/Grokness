# Contributing to Grokness

Thank you for your interest in contributing to Grokness! We welcome contributions from the community to help improve the project. Please follow these guidelines to ensure a smooth collaboration process.

## Contribution Steps

1. Fork the Grokness repository on GitHub to your own account. Then, run the following commands to set up your local environment, make changes, and submit them:

    ```bash
    git clone https://github.com/your-username/grokness.git
    cd grokness
    bun install
    bun run build  # or build:firefox | build:chrome
    ```

2. For loading the extension in Chrome:

    - Go to `chrome://extensions/`, enable Developer mode, and load the `dist/chrome` folder.

3. For loading the extension in Firefox:

    - Go to `about:debugging#/runtime/this-firefox`, load the `dist/firefox` folder as a temporary add-on.

4. Create a feature branch:

    ```bash
    git checkout -b feature/your-feature-name
    ```

5. Make your changes and test in both Chrome and Firefox.

6. Commit and push:

    ```bash
    git add .
    git commit -m "Add feature: description of changes"
    git push origin feature/your-feature-name
    ```

7. After pushing, go to the original Grokness repository on GitHub and create a pull request from your forked branch. Provide a clear title and description for your PR, explaining what changes were made and why. Reference any related issues.

Your PR will be reviewed by maintainers. Be responsive to feedback and make necessary updates.

## Code of Conduct

All contributions must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with detailed information to help us understand and address it.

Thank you for contributing to Grokness!
