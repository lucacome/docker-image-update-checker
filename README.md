# Docker Image Update Checker Action

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/lucacome/docker-image-update-checker/badge)](https://scorecard.dev/viewer/?uri=github.com/lucacome/docker-image-update-checker)
[![Test](https://github.com/lucacome/docker-image-update-checker/actions/workflows/test.yml/badge.svg)](https://github.com/lucacome/docker-image-update-checker/actions/workflows/test.yml)
[![GitHub release badge](https://badgen.net/github/release/lucacome/docker-image-update-checker/stable)](https://github.com/lucacome/docker-image-update-checker/releases/latest)
[![GitHub license badge](https://badgen.net/github/license/lucacome/docker-image-update-checker)](https://github.com/lucacome/docker-image-update-checker/blob/main/LICENSE)
[![GitHub Workflows badge](https://badgen.net/runkit/lucacome/lucacome-workflow)](https://github.com/search?q=docker-image-update-checker+path%3A.github%2Fworkflows%2F+language%3AYAML&type=Code)

This action checks if a Docker image needs to be updated based on the base image it uses (e.g. `FROM nginx:1.21.0`). By default it checks for all platforms, but you can specify the platforms to check.

## Inputs

| Name         | Type   | Description                                                                |
|--------------|--------|----------------------------------------------------------------------------|
| `base-image` | String | Base Docker Image. This is the image you have as `FROM` in your Dockerfile |
| `image`      | String | Your image based on `base-image`                                           |
| `platforms`  | String | Platforms to check (default `all`), e.g. `linux/amd64,linux/arm64`         |

## Output

| Name             | Type   | Description                                                                           |
|------------------|--------|---------------------------------------------------------------------------------------|
| `needs-updating` | String | 'true' or 'false' if the image needs to be updated or not                             |
| `diff-images`    | String | List of images (platforms) that need to be updated                                    |
| `diff-json`      | String | JSON output of the images (platforms) that need to be updated with the list of layers |

## Runners

The action works on `ubuntu` and `windows` runners with or without a `docker/login-action` step. Without a login step, it will perform an anonymous pull of the manifests, except for Docker Hub because the Runners already have a token provided by GitHub (I can't find any documentation on this, but the token is there and it works).

It also works on `macos` runners, but because `docker` is not installed on the runners, you can't use the `docker/login-action`, so you can only use it with public images and anonymous pulls.

## Authentication

To authenticate with a Docker registry, you can use the [`docker/login-action`](https://github.com/docker/login-action) in a step before this action.

## Examples

- [Minimal](#minimal)
- [Single platform](#single-platform)
- [Multiple platforms](#multiple-platforms)

### Minimal

Check if the image `user/app:latest`, that has `nginx` as a base image, needs to be updated:

```yaml
name: Check docker image

on:
  schedule:
    - cron:  '0 4 * * *'

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v2.0.0
        with:
          base-image: nginx:1.21.0
          image: user/app:latest

      - name: Check result
        run: echo "Needs updating: ${{ steps.check.outputs.needs-updating }}"

```

### Single platform

Check if the image `user/app:latest`, that has `nginx` has a base image, needs to be updated and build and push the image if needed:

```yaml
name: Check docker image

on:
  schedule:
    - cron:  '0 4 * * *'

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4.2.2

      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v2.0.0
        with:
          base-image: nginx:1.21.0
          image: user/app:latest
          platforms: linux/amd64

      - name: Build and push
        uses: docker/build-push-action@v6.14.0
        with:
          context: .
          push: true
          tags: user/app:latest
        if: steps.check.outputs.needs-updating == 'true'
```

### Multiple platforms

Check if the image `user/app:latest`, that has `nginx` has a base image, needs to be updated for `linux/amd64` and `linux/arm64`:

```yaml
name: Check docker image for multiple platforms

on:
  schedule:
    - cron:  '0 4 * * *'

jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      needs-updating: ${{ steps.check.outputs.needs-updating }}
    steps:
      - name: Login to Docker Registry
        uses: docker/login-action@v3.3.0
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v2.0.0
        with:
          base-image: nginx:1.21.0
          image: user/app:latest
          platforms: linux/amd64,linux/arm64 # Use 'all' to check all platforms

  build:
    needs: check
    runs-on: ubuntu-latest
    if: needs.check.outputs.needs-updating == 'true'
    steps:
      - name: Checkout
        uses: actions/checkout@v4.2.2

      - name: Setup QEMU
        uses: docker/setup-qemu-action@v3.6.0
        with:
          platforms: arm64

      - name: Docker Buildx
        uses: docker/setup-buildx-action@v3.10.0

      - name: Build and push
        uses: docker/build-push-action@v6.14.0
        with:
          context: .
          push: true
          tags: user/app:latest
          platforms: linux/amd64,linux/arm64
```

> **Note**
>
> The `platforms` input is optional and defaults to `all`.

## Debugging

If something is not working as expected, you can enable debug logging to get more information (a lot more information).
You can re-run the action with the `Enable debug logging` checkbox checked for a single run or set the `ACTIONS_STEP_DEBUG` secret to `true` in the repository's secrets.
For more information on debugging actions, see [Enabling debug logging](https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging).
