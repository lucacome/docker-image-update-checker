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

## Output

| Name            | Type    | Description                                               |
|-----------------|---------|-----------------------------------------------------------|
| `needs-updating`| String  | 'true' or 'false' if the image needs to be updated or not |


## Example

```yaml
name: check docker images

on:
  schedule:
    - cron:  '0 4 * * *'

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      -
        name: Checkout
        uses: actions/checkout@v2
      -
        name: Check if update available
        id: check
        uses: lucacome/docker-image-update-checker@v1.1.1
        with:
          base-image: nginx:1.21.0
          image: user/app:latest
      -
        name: Build and push
        uses: docker/build-push-action@v2
        with:
          context: .
          push: true
          tags: user/app:latest
        if: steps.check.outputs.needs-updating == 'true'
```
