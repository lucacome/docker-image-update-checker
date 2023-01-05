#!/usr/bin/env bash

set -o nounset
set -o errexit
set -o pipefail
if [ "${TRACE-0}" -eq 1 ]; then set -o xtrace; fi

get_layers() {
    local repo=$1
    local digest=$2
    local token
    token=$(get_token "$repo")

    digestOutput=$(curl -H "Authorization: Bearer $token" \
        -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
        "https://index.docker.io/v2/${repo}/manifests/${digest}" 2>/dev/null)
    
    if jq -e -r '.errors[0].code' <<<"$digestOutput" >/dev/null; then
        jq -r '.errors[0].code' <<<"$digestOutput"
    else
        jq -r '[.layers[].digest]' <<<"$digestOutput"
    fi
}

get_token() {
    local repo=$1
    local url
    url="https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull"
    curl "$url" 2>/dev/null | jq -r '.token'
}

# if we get a "UNAUTHORIZED" response and the $base does not match a image with username -> fallback to a version with "library" as prefix
retry_if_necessary() {
    local IMAGE_PATTERN_WITH_USERNAME="^.+/.+$"
    local repo=$1
    local digest=$2
    local result

    result=$(get_layers "$repo" "$digest")

    if [[ $result == "UNAUTHORIZED" ]] && ! [[ $repo =~ $IMAGE_PATTERN_WITH_USERNAME ]] ; then
        result=$(get_layers "library/$repo" "$digest")
    fi

    echo "$result"
}

IFS=: read base base_tag <<<$base
IFS=: read image image_tag <<<$image

layers_base=$(retry_if_necessary $base ${base_tag:-latest})
layers_image=$(retry_if_necessary $image ${image_tag:-latest})

jq '.base-.image | .!=[]' <<<"{\"base\": $layers_base, \"image\": $layers_image }"
