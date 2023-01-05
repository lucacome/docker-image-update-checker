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

    jq -r '[.layers[].digest]' <<<"$digestOutput"
}

get_token() {
    local repo=$1
    local url
    url="https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull"
    curl "$url" 2>/dev/null | jq -r '.token'
}

IFS=: read base base_tag <<<$base
IFS=: read image image_tag <<<$image

layers_base=$(get_layers $base ${base_tag:-latest})
layers_image=$(get_layers $image ${image_tag:-latest})

jq '.base-.image | .!=[]' <<<"{\"base\": $layers_base, \"image\": $layers_image }"
