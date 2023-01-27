# Docker Image Update Checker Action

[![Test](https://github.com/lucacome/docker-image-update-checker/actions/workflows/test.yml/badge.svg)](https://github.com/lucacome/docker-image-update-checker/actions/workflows/test.yml)
[![GitHub release badge](https://badgen.net/github/release/lucacome/docker-image-update-checker/stable)](https://github.com/lucacome/docker-image-update-checker/releases/latest)
[![GitHub license badge](https://badgen.net/github/license/lucacome/docker-image-update-checker)](https://github.com/lucacome/docker-image-update-checker/blob/main/LICENSE)
[![GitHub Workflows badge](https://badgen.net/runkit/lucacome/lucacome-workflow)](https://github.com/search?q=docker-image-update-checker+path%3A.github%2Fworkflows%2F+language%3AYAML&type=Code)

Action to check if the base image was updated and your image (published on DockerHub) needs to be rebuilt. This action will use Docker's API to compare the base layers of your image with the `base-image`, without the need to pull the images.


## Inputs

| Name                | Type     | Description                        |
|---------------------|----------|------------------------------------|
| `base-image`        | String   | Base Docker Image                  |
| `image`             | String   | Your image based on `base-image`   |
| `platforms`         | String   | Platforms to check                 |

## Output

| Name            | Type    | Description                                               |
|-----------------|---------|-----------------------------------------------------------|
| `needs-updating`| String  | 'true' or 'false' if the image needs to be updated or not |


## Examples
- [Minimal](#minimal)
- [Single platform](#single-platform)
- [Multiple platforms](#multiple-platforms)

### Minimal

Check if the image `user/app:latest`, that has `nginx` has a base image, needs to be updated:

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
        uses: lucacome/docker-image-update-checker@v1
        with:
          base-image: nginx:1.21.0
          image: user/app:latest

      - name: Check result
        run: echo "Needs updating: ${{ steps.check.outputs.needs-updating }}"

```


### Single platform

Check if the image `user/app:latest`, that has `nginx` has a base image, needs to be updated:

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
        uses: actions/checkout@v3

      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v1
        with:
          base-image: nginx:1.21.0
          image: user/app:latest

      - name: Build and push
        uses: docker/build-push-action@v3
        with:
          context: .
          push: true
          tags: user/app:latest
        if: steps.check.outputs.needs-updating == 'true'
```
> **Note**
>
> The `platforms` input is optional and defaults to `linux/amd64`.


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
      - name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v1
        with:
          base-image: nginx:1.21.0
          image: user/app:latest
          platforms: linux/amd64,linux/arm64

build:
    needs: check
    runs-on: ubuntu-latest
    if: needs.check.outputs.needs-updating == 'true'
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup QEMU
        uses: docker/setup-qemu-action@v2
        with:
          platforms: arm64

      - name: Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build and push
        uses: docker/build-push-action@v3
        with:
          context: .
          push: true
          tags: user/app:latest
          platforms: linux/amd64,linux/arm64
```

> **Note**
>
> If any of the platforms is not present in either the base-image or the image, the action will exit with an error.

## Debugging

To debug the action, you can set the `DEBUG` environment variable to `true` in the workflow file. The variable can be set at any level.

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
        uses: lucacome/docker-image-update-checker@v1
        with:
          base-image: nginx:1.21.0
          image: user/app:latest
        env:
          DEBUG: true
```

To make it more convenient, you can use `${{ secrets.ACTIONS_STEP_DEBUG }}` to enable debugging only when needed.

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
        uses: lucacome/docker-image-update-checker@v1
        with:
          base-image: nginx:1.21.0
          image: user/app:latest
        env:
          DEBUG: ${{ secrets.ACTIONS_STEP_DEBUG }}
```

This works even when re-running the action with the `Re-run job` button and the `Enable debug logging` checkbox checked.
To read more about debugging actions, see [Debugging actions](https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging#enabling-step-debug-logging).
