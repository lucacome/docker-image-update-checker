#!/usr/bin/env bash

get_digest() {
    local repo=$1
    local tag=$2

    manifestOutput=$(curl -H "Authorization: Bearer $(get_token $repo)" -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" "https://index.docker.io/v2/${repo}/manifests/${tag}" 2>/dev/null)

    manifest_lists=$(jq -r '.manifests' <<<"$manifestOutput")

    for manifest in $(jq -r '.[] | @text' <<<"$manifest_lists"); do
        platform=$(jq -r '.platform.architecture' <<<"$manifest")
        if [ $platform == "amd64" ]; then
            echo $(jq -r '.digest' <<<"$manifest")
            break
        fi
    done
}

get_layers() {
    local repo=$1
    local digest=$2

    digestOutput=$(curl -H "Authorization: Bearer $(get_token $repo)" -H "Accept: application/vnd.docker.distribution.manifest.v2+json" "https://index.docker.io/v2/${repo}/manifests/${digest}" 2>/dev/null)

    jq -r '[.layers[].digest]' <<<$digestOutput
}

get_token() {
    local repo=$1
    echo $(curl 'https://auth.docker.io/token?service=registry.docker.io&scope=repository:'${repo}':pull' 2>/dev/null | jq -r '.token')
}

IFS=: read base base_tag <<<$base
IFS=: read image image_tag <<<$image

digest_base=$(get_digest $base $base_tag)
layers_base=$(get_layers $base $digest_base)

digest_image=$(get_digest $image $image_tag)
layers_image=$(get_layers $image $digest_image)

jq '.base-.image | .!=[]' <<<"{\"base\": $layers_base, \"image\": $layers_image }"
