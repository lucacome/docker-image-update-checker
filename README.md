# Docker Image Update Checker Action

Action to check if the base image was updated and your image (published on DockerHub) needs to be rebuilt. This action will use Docker's API to compare the base layers of your image with the `base-image`, without the need to pull the images.


## Inputs

| Name                | Type     | Description                        |
|---------------------|----------|------------------------------------|
| `base-image`        | String   | Base Docker Image                  |
| `image`             | String   | Your image based on `base-image`   |

Note: the `base-image` needs to have the full path. For example for official images like `nginx`, the full path is `library/nginx`.

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
        uses: lucacome/docker-image-update-checker@v1
        with:
          base-image: library/nginx:1.21.0
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
