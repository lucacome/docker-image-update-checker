#!/usr/bin/env bash

set -o nounset
set -o errexit
set -o pipefail
if [ "${TRACE-0}" -eq 1 ]; then set -o xtrace; fi

error() {
    # print error and exit
    printf "Error: $1\n" >&2
    exit 1

}

get_manifests() {
    local repo=$1
    local digest=$2
    local token=$3

    manifest_list=$(curl -sSL --dump-header headers -H "Authorization: Bearer $token" \
        -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json" \
        "https://index.docker.io/v2/${repo}/manifests/${digest}" 2>/dev/null)

    if jq -e -r '.errors[0].code' <<<"$manifest_list" >/dev/null; then
        error_code=$(jq -r '.errors[0].code' <<<"$manifest_list")
        message=$(jq -r '.errors[0].message' <<<"$manifest_list")
        error "Response from $repo\n code: $error_code\n message: $message"
    fi

    headers=$(cat headers | awk -F ': ' '{sub(/\r/,"\n",$2); print $1","$2}' | grep 'docker-content-digest\|content-type' | jq -R 'split(",") | {(if .[0] == "content-type" then "type" else "digest" end): .[1]}' | jq -s 'reduce .[] as $item ({}; . * $item)')
    manifest_v2=$(jq -r '. | select(.type == "application/vnd.docker.distribution.manifest.v2+json" or .type == "application/vnd.oci.image.manifest.v1+json") | [{digest: .digest, platform: "linux/amd64"}]' <<<"$headers")
    if [ ! -z "$manifest_v2" ]; then
        echo "$manifest_v2"
        return
    fi

    jq -r '[.manifests[] | select(.platform.architecture | contains ("unknown") | not) | {digest: .digest, platform: (.platform.os +"/"+ .platform.architecture)}]' <<<"$manifest_list"

}

get_layers() {
    local repo=$1
    local digest=$2
    local token=$3

    digestOutput=$(curl -sSL -H "Authorization: Bearer $token" \
        -H "Accept: application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json" \
        "https://index.docker.io/v2/${repo}/manifests/${digest}" 2>/dev/null)

    if jq -e -r '.errors[0].code' <<<"$digestOutput" >/dev/null; then
        error_code=$(jq -r '.errors[0].code' <<<"$digestOutput")
        message=$(jq -r '.errors[0].message' <<<"$digestOutput")
        error "Response from $repo\n code: $error_code\n message: $message"
    fi

    jq -r '[.layers[].digest]' <<<"$digestOutput"

}

get_token() {
    local repo=$1
    local url
    url="https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull"
    curl -fsSL "$url" 2>/dev/null | jq -r '.token'
}

check_if_library() {
    local IMAGE_PATTERN_WITH_USERNAME="^.+/.+$"
    local repo=$1
    local token

    token=$(get_token "$repo")

    code=$(curl --write-out %{http_code} -sSL --output /dev/null -H "Authorization: Bearer $token" \
        "https://index.docker.io/v2/${repo}/tags/list" 2>/dev/null)

    if [[ $code != 200 ]]; then

        if ! [[ $repo =~ $IMAGE_PATTERN_WITH_USERNAME ]]; then
            repo="library/$repo"

            token=$(get_token "$repo")

            code=$(curl --write-out %{http_code} -sSL --output /dev/null -H "Authorization: Bearer $token" \
                "https://index.docker.io/v2/${repo}/tags/list" 2>/dev/null)

        fi

        if [[ $code != 200 ]]; then
            error "Response code from $repo was $code"
        fi
    fi

    result=("$repo" "$token")
}

IFS=: read base base_tag <<<$base
IFS=: read image image_tag <<<$image

check_if_library "$base"
base_repo=${result[0]}
base_token=${result[1]}
manifests_base=$(get_manifests $base_repo ${base_tag:-latest} $base_token)

check_if_library "$image"
image_repo=${result[0]}
image_token=${result[1]}
manifests_image=$(get_manifests $image_repo ${image_tag:-latest} $image_token)

diff=false
# loop through plafforms split by comma
for platform in $(echo $platforms | tr -s ',' ' '); do
    # get the digest for the platform
    digest_base=$(jq -r ".[] | select(.platform == \"$platform\") | .digest" <<<"$manifests_base")

    # if the digest is empty, then the platform is not present in the base image
    if [ -z "$digest_base" ]; then
        error "Platform $platform not found in the base image $base"
    fi

    # get the digest for the platform
    digest_image=$(jq -r ".[] | select(.platform == \"$platform\") | .digest" <<<"$manifests_image")

    # if the digest is empty, then the platform is not present in the image
    if [ -z "$digest_image" ]; then
        error "Platform $platform not found in the image $image"
    fi

    # get the layers for the base
    layers_base=$(get_layers $base_repo $digest_base $base_token)

    # get the layers for the image
    layers_image=$(get_layers $image_repo $digest_image $image_token)

    diff=$(jq '.base-.image | .!=[]' <<<"{\"base\": $layers_base, \"image\": $layers_image }")

    if [[ "$diff" == "true" ]]; then
        break
    fi

done

echo "$diff"
