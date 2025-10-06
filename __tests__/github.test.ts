import {GitHubContainerRegistry} from '../src/github.js'
import {getDiffs} from '../src/image-utils.js'

describe('GitHub', () => {
  const gitHubRegistry = new GitHubContainerRegistry()

  test('getImageInfo', async () => {
    const repository = 'ghcr.io/nginxinc/nginx-gateway-fabric/nginx'
    const tag = '1.1.0'
    const nginxImageInfo = await gitHubRegistry.getImageInfo({repository, tag})

    expect(nginxImageInfo).not.toBeNull()
    expect(nginxImageInfo.has('linux|amd64|')).toBe(true)
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('architecture', 'amd64')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('digest')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('layers')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('os', 'linux')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('variant', undefined)

    const repository2 = 'ghcr.io/nginxinc/nginx-gateway-fabric/nginx'
    const tag2 = '1.3.0'
    const newNginxImageInfo = await gitHubRegistry.getImageInfo({repository: repository2, tag: tag2})

    expect(newNginxImageInfo).not.toBeNull()
    expect(newNginxImageInfo.has('linux|amd64|')).toBe(true)
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty('architecture', 'amd64')
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty(
      'digest',
      'sha256:b54460b2a2c70743fc2d43e2ad78376cd0abaecba4fcd48dfe8c034e19c15b23',
    )
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty('layers')
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty('os', 'linux')
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty('variant', undefined)

    const diffs = getDiffs(['linux/amd64'], nginxImageInfo, newNginxImageInfo)

    expect(diffs).not.toBeNull()
    expect(diffs.length).toBe(1)

    expect(diffs).toEqual([
      {
        architecture: 'amd64',
        digest: 'sha256:b54460b2a2c70743fc2d43e2ad78376cd0abaecba4fcd48dfe8c034e19c15b23',
        layers: [
          'sha256:4abcf20661432fb2d719aaf90656f55c287f8ca915dc1c92ec14ff61e67fbaf8',
          'sha256:b1e69ebc7f924a03f4e1d3906db5423920d8b40d8f315db72445e6a7041c6237',
          'sha256:628158b45bceaf19d9e86fbfb08c925d75e1e2ab888cd9b97b7c8a8181232be4',
          'sha256:346e52e95fa0a52e495913d9d99e4766d1164631ddbf3a79b1b7860c44a4582a',
          'sha256:8c57fb1cd6448c27acb916942fed2522079e5256bc92466c1351f1b6d5f201e9',
          'sha256:dc3800d1d0f27990204f4c7f60ef0a8fdbf41a3199d38467475aba551823ccd4',
          'sha256:e3227d68030df2f1c6db2654cf30f1e42d5700dc7b5c73eb1a4585bbd588affa',
          'sha256:8c50e1264d11b6f97944fb962f743063fbe75e06535780bb4919d491cf9ccde4',
          'sha256:e73705b81978bae07455da98270fcf00d50303c3ced48c2d0e0412c041058906',
          'sha256:08f3247bafb95323f81bd617dc9fe210b361b00e49dda69d6ce419a525423db8',
          'sha256:7c33792ff5a2bb827715a58b43fd2383cc53a7c3404d7570a0d06f4502f239a4',
          'sha256:e286804e58a8ad6b276e66d47563a8986ea8e95749c511980dbc5f116d90fed3',
          'sha256:ba8ea7cf37cb0661494adeddd2c0c9c3bdd7b0ddc866dfa61cc48f269d6276d1',
          'sha256:e6e0f1ed3be3d015d254554788a89638102f4d854dd9814204ad648269c672b6',
          'sha256:caf1493c2109a431cd01ebb80dc57e53c3f39dddebc376298648b0763f44a704',
        ],
        os: 'linux',
        variant: undefined,
      },
    ])
  })

  test('getImageInfo with variant', async () => {
    const repository = 'ghcr.io/nginxinc/nginx-prometheus-exporter'
    const tag = '1.3.0'
    const nginxImageInfo = await gitHubRegistry.getImageInfo({repository, tag})

    expect(nginxImageInfo).not.toBeNull()
    expect(nginxImageInfo.has('linux|arm|v7')).toBe(true)
    expect(nginxImageInfo.get('linux|arm|v7')).toHaveProperty('architecture', 'arm')
    expect(nginxImageInfo.get('linux|arm|v7')).toHaveProperty(
      'digest',
      'sha256:7f170c221a19738fb70c98d0920fcebf4581145a34179b1c935be956c4213229',
    )
    expect(nginxImageInfo.get('linux|arm|v7')).toHaveProperty('layers')
    expect(nginxImageInfo.get('linux|arm|v7')).toHaveProperty('os', 'linux')
    expect(nginxImageInfo.get('linux|arm|v7')).toHaveProperty('variant', 'v7')
  })
})
