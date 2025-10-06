import {DockerHub} from '../src/docker-hub.js'
import {getDiffs} from '../src/image-utils.js'

describe('DockerHub', () => {
  const dockerHub = new DockerHub()

  test('getImageInfo', async () => {
    const repository = 'library/nginx'
    const tag = '1.23.4'
    const nginxImageInfo = await dockerHub.getImageInfo({repository, tag})

    expect(nginxImageInfo).not.toBeNull()
    expect(nginxImageInfo.has('linux|amd64|')).toBe(true)
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('architecture', 'amd64')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('digest')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('layers')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('os', 'linux')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('variant', undefined)

    const repository2 = 'nginx/nginx-ingress'
    const tag2 = '3.1.0'
    const nginxIngressImageInfo = await dockerHub.getImageInfo({repository: repository2, tag: tag2})

    expect(nginxIngressImageInfo).not.toBeNull()
    expect(nginxIngressImageInfo.has('linux|amd64|')).toBe(true)
    expect(nginxIngressImageInfo.get('linux|amd64|')).toHaveProperty('architecture', 'amd64')
    expect(nginxIngressImageInfo.get('linux|amd64|')).toHaveProperty(
      'digest',
      'sha256:01f441a40d8782fdf82ced4b5efa58afdc4be5753217f12d15b9ad53ed5c31af',
    )
    expect(nginxIngressImageInfo.get('linux|amd64|')).toHaveProperty('layers')
    expect(nginxIngressImageInfo.get('linux|amd64|')).toHaveProperty('os', 'linux')
    expect(nginxIngressImageInfo.get('linux|amd64|')).toHaveProperty('variant', undefined)

    const diffs = getDiffs(['linux/amd64'], nginxImageInfo, nginxIngressImageInfo)

    expect(diffs).not.toBeNull()
    expect(diffs.length).toBe(1)

    expect(diffs).toEqual([
      {
        architecture: 'amd64',
        digest: 'sha256:01f441a40d8782fdf82ced4b5efa58afdc4be5753217f12d15b9ad53ed5c31af',
        layers: [
          'sha256:f1f26f5702560b7e591bef5c4d840f76a232bf13fd5aefc4e22077a1ae4440c7',
          'sha256:84181e80d10e844350789d3324e848cf728df4f3d0f6c978789dd489f493934a',
          'sha256:1ff0f94a80076ab49af75159e23f062a30a75d333a8e9c021bf39669230afcfe',
          'sha256:d776269cad101c9f8e33e2baa0a05993ed0786604d86ea525f62d5d7ae7b9540',
          'sha256:e9427fcfa8642f8ddf5106f742a75eca0dbac676cf8145598623d04fa45dd74e',
          'sha256:d4ceccbfc2696101c94fbf2149036e4ff815e4723e518721ff85105ce5aa8afc',
          'sha256:20d303c988056055cd3278497c39b934757bee14bd1ef8f830f5ea04e2db1fcd',
          'sha256:4f4fb700ef54461cfa02571ae0db9a0dc1e0cdb5577484a6d75e68dc38e8acc1',
          'sha256:4f4fb700ef54461cfa02571ae0db9a0dc1e0cdb5577484a6d75e68dc38e8acc1',
          'sha256:4f4fb700ef54461cfa02571ae0db9a0dc1e0cdb5577484a6d75e68dc38e8acc1',
          'sha256:88b0e7f3304bce7254389c8242d11cc3ce84027874ad4dcf55c7b85c32743621',
          'sha256:d94cdb39e3428e3745fe1b142cff1146807d46786c234b53722d2592286ede15',
        ],
        os: 'linux',
        variant: undefined,
      },
    ])
  })

  test('getToken', async () => {
    const repository = 'library/nginx'
    const token = await dockerHub.getToken(repository)

    expect(token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/)
  })
})
