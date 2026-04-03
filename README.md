# Docker Image Update Checker Action

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/lucacome/docker-image-update-checker/badge)](https://scorecard.dev/viewer/?uri=github.com/lucacome/docker-image-update-checker)
[![Test](https://github.com/lucacome/docker-image-update-checker/actions/workflows/test.yml/badge.svg)](https://github.com/lucacome/docker-image-update-checker/actions/workflows/test.yml)
[![GitHub release badge](https://badgen.net/github/release/lucacome/docker-image-update-checker/stable)](https://github.com/lucacome/docker-image-update-checker/releases/latest)
[![GitHub license badge](https://badgen.net/github/license/lucacome/docker-image-update-checker)](https://github.com/lucacome/docker-image-update-checker/blob/main/LICENSE)
[![GitHub Workflows badge](https://img.shields.io/endpoint?url=https%3A%2F%2Flucacome-curiousgreenangelfish.web.val.run)](https://github.com/search?q=docker-image-update-checker+path%3A.github%2Fworkflows%2F+language%3AYAML&type=Code)

This action checks whether your **already-published Docker image** is out of date relative to its base image. It works by comparing the layers of your image (e.g. `user/app:latest`) against the current layers of the base image you specify (e.g. `debian:13.1`), the image referenced in your Dockerfile's `FROM` instruction. If the base image was silently re-published under the same tag, for example because of a security patch or OS update, this action detects the drift so you can trigger a rebuild.

> [!NOTE]
>
> This is **not** the same as what Dependabot/Renovate does. Dependabot/Renovate opens PRs when a *new tag* is published (e.g. `debian:13.1` → `debian:13.2`). This action handles the complementary case: the tag hasn't changed, but the image behind it has.

By default this action checks differences across all platforms (e.g. `linux/amd64,linux/arm64,linux/arm/v7`), but you can specify which platforms to check.

## Supported Registries

| Registry                             | Hostname pattern                       |
| ------------------------------------ | -------------------------------------- |
| Docker Hub                           | `docker.io`                            |
| GitHub Container Registry            | `ghcr.io`                              |
| GitLab Container Registry            | `registry.gitlab.com`                  |
| Google Container Registry            | `gcr.io`, `*.gcr.io`                   |
| Google Artifact Registry             | `*.pkg.dev`                            |
| Amazon ECR Public                    | `public.ecr.aws`                       |
| Amazon ECR Private                   | `*.dkr.ecr.*.amazonaws.com`            |
| Azure Container Registry             | `*.azurecr.io`                         |
| DigitalOcean Container Registry      | `registry.digitalocean.com`            |
| Oracle Cloud Infrastructure Registry | `*.ocir.io`                            |
| Quay.io                              | `quay.io`                              |
| Any OCI-compliant registry           | auto-discovered via `WWW-Authenticate` |

## Inputs

| Name         | Type   | Description                                                                       |
| ------------ | ------ | --------------------------------------------------------------------------------- |
| `base-image` | String | Base Docker image — i.e. the value you use in `FROM` in your Dockerfile           |
| `image`      | String | Your already-published image to check for updates                                 |
| `platforms`  | String | Platforms to check (default `all`), e.g. `linux/amd64,linux/arm64`                |

## Outputs

| Name             | Type   | Description                                                                                                               |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `needs-updating` | String | `true` if any platform needs updating, `false` otherwise                                                                  |
| `needs-building` | String | `true` or `false` if the image doesn't exist and needs to be built for the first time                                     |
| `diff-images`    | String | Comma-separated list of platforms that need updating, e.g. `linux/amd64,linux/arm64`                                      |
| `diff-json`      | String | JSON array of objects — one per platform — each with `os`, `architecture`, `variant`, `digest`, and `layers` fields       |

## Runners

The action works on `ubuntu` and `windows` runners with or without a `docker/login-action` step. Without a login step it will perform an anonymous pull of the manifests, except for Docker Hub because GitHub-hosted runners already have a Docker Hub authentication token embedded — see the [`docker/login-action` docs](https://github.com/docker/login-action?tab=readme-ov-file#set-scopes-for-the-authentication-token) for details.

It also works on `macos` runners, but `docker` is not installed by default on macOS runners, so unless you manually install Docker, you can only use it with public images and anonymous pulls.

## Authentication

To authenticate with a Docker registry, add a [`docker/login-action`](https://github.com/docker/login-action) step **before** this action. If `base-image` and `image` are from different registries, run `docker/login-action` once for each registry that requires credentials.

## Examples

- [Minimal](#minimal)
- [Single platform](#single-platform)
- [Multiple platforms](#multiple-platforms)
- [Build image for the first time](#build-image-for-the-first-time)

### Minimal

Check if the image `user/app:latest`, that has `debian` as a base image, needs to be updated:

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
        uses: lucacome/docker-image-update-checker@v3.0.1
        with:
          base-image: debian:13.1
          image: user/app:latest

      - name: Check result
        run: echo "Needs updating: ${{ steps.check.outputs.needs-updating }}"

```

### Single platform

Check if the image `user/app:latest`, that has `debian` as a base image, needs to be updated and build and push the image if needed:

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
        uses: actions/checkout@v6

      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v3.0.1
        with:
          base-image: debian:13.1
          image: user/app:latest
          platforms: linux/amd64

      - name: Build and push
        uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: user/app:latest
        if: steps.check.outputs.needs-updating == 'true'
```

### Multiple platforms

Check if the image `user/app:latest`, that has `debian` as a base image, needs to be updated for `linux/amd64` and `linux/arm64`:

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
        uses: docker/login-action@v4
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v3.0.1
        with:
          base-image: debian:13.1
          image: user/app:latest
          platforms: linux/amd64,linux/arm64 # Use 'all' to check all platforms

  build:
    needs: check
    runs-on: ubuntu-latest
    if: needs.check.outputs.needs-updating == 'true'
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup QEMU
        uses: docker/setup-qemu-action@v4
        with:
          platforms: arm64

      - name: Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Build and push
        uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: user/app:latest
          platforms: linux/amd64,linux/arm64
```

> [!NOTE]
>
> The `platforms` input is optional and defaults to `all`.

### Build image for the first time

`needs-updating` is `true` whenever a build is needed — including when an `image` does not exist.

`needs-building` is `true` **only** when the `image` does not exist yet, so use it for steps that should run exclusively then.

```yaml
name: Check and build docker image

on:
  schedule:
    - cron:  '0 4 * * *'

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v3.0.1
        with:
          base-image: debian:13.1
          image: user/app:latest

      - name: Do something on first build
        run: echo "Image did not exist — built for the first time"
        if: steps.check.outputs.needs-building == 'true'

      - name: Build and push
        uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: user/app:latest
        if: steps.check.outputs.needs-updating == 'true'
```

## Debugging

If something is not working as expected, you can enable debug logging to get significantly more detail.
You can re-run the action with the `Enable debug logging` checkbox checked for a single run or set the `ACTIONS_STEP_DEBUG` secret to `true` in the repository's secrets.
For more information on debugging actions, see [Enabling debug logging](https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging).
