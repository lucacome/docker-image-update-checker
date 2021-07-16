# Docker Image Update Checker Action

Action to check if the base image was updated and your image (published on DockerHub) needs to be rebuilt


## Inputs

| Name                | Type     | Description                        |
|---------------------|----------|------------------------------------|
| `base-image`        | String   | Base Docker Image                  |
| `image`             | String   | Your image based on `base-image`   |


## Output

| Name            | Type    | Description                                               |
|-----------------|---------|-----------------------------------------------------------|
| `needs-updating`| String  | 'true' or 'false' if the image needs to be updated or not |
