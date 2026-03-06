import {GitHubContainerRegistry} from '../src/github.js'
import {getDiffs} from '../src/image-utils.js'

describe('GitHub', () => {
  const gitHubRegistry = new GitHubContainerRegistry()

  test('getImageInfo', async () => {
    const repository = 'nginx/nginx-gateway-fabric/nginx'
    const tag = '2.3.0'
    const nginxImageInfo = await gitHubRegistry.getImageInfo({repository, tag})

    expect(nginxImageInfo).not.toBeNull()
    expect(nginxImageInfo.has('linux|amd64|')).toBe(true)
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('architecture', 'amd64')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('digest')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('layers')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('os', 'linux')
    expect(nginxImageInfo.get('linux|amd64|')).toHaveProperty('variant', undefined)

    const repository2 = 'nginx/nginx-gateway-fabric/nginx'
    const tag2 = '2.4.0'
    const newNginxImageInfo = await gitHubRegistry.getImageInfo({repository: repository2, tag: tag2})

    expect(newNginxImageInfo).not.toBeNull()
    expect(newNginxImageInfo.has('linux|amd64|')).toBe(true)
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty('architecture', 'amd64')
    expect(newNginxImageInfo.get('linux|amd64|')).toHaveProperty(
      'digest',
      'sha256:449636cc4d9b68da30db9b32575992c949d98a3b9231dba60e5ad5e1c8176d1d',
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
        digest: 'sha256:449636cc4d9b68da30db9b32575992c949d98a3b9231dba60e5ad5e1c8176d1d',
        layers: [
          'sha256:589002ba0eaed121a1dbf42f6648f29e5be55d5c8a6ee0f8eaa0285cc21ac153',
          'sha256:9331cd6029cbf318c5576c03d779488ecadd7dd7425d199cbfd0906a6235ffce',
          'sha256:211bae00ea5606b36896883a2b8f10e9622638d7d5b3a33da6af615d868e4402',
          'sha256:9739627526d74285cefbf02d43bcbc00fc946527670d43db2fa258e6082c876b',
          'sha256:6c2f4c63521d43b201a4c0c5d24e71aeb94ed3e67217bb0b91e8fb040382ed06',
          'sha256:76fc765fd3b0af90def0c6f9d14b2fb36c59d2ab6efc3f330cba39d3fb62f500',
          'sha256:cd835559902ab574fc1dbdd1e32130771477ac163c5502057ab6dc78e1f7b8fe',
          'sha256:55cbbd6285fe0ee5fcdef2dc641bfad7889b35d4542cb111968eb7f613bb6eaf',
          'sha256:c1db737ce32c2e08f4fee54dab5cf6f39b3a29a441c0ca838eea82d7c15eb804',
          'sha256:78f33eed696426522529e5570a2c5d32fa7c0b93eabc30847f1d493be4d01ec5',
          'sha256:6534df43d96cc8a50beafa43fc9a1701ae6068b9808e1c917aff9fb100b94819',
          'sha256:7874c2100b7bb26d8b64a85ce6e92fab51daad5bb9e3d2b3256fd7a70cc43e73',
          'sha256:74b88b904f6cc097a9368a8e3ab531fa137b55d246996eacf6f53f3ea9e00339',
          'sha256:e461315ac2621823120487ca4094a2c994edb9e111b9dab0b466be94715fcc2f',
          'sha256:376f04dcc7fa0606445cd1d61fd662d94fddd328ea5510520aaa169b925b0eb8',
          'sha256:464099d27bb70252aa0f6c58c28a5091d2e53f5eba3b6980b72526e041c335e6',
          'sha256:5f556c8aa860adcf77512cc4938e5ebaf455b3566f3ea8bcb57972e8484f58f6',
          'sha256:ffcdedb89da0026be34fc73f0cdd8fc6ed5f9a05724932544c24c2df21800909',
          'sha256:535f3d850e81b0be03065be7d5941110f773fc7f2decc095518eab5f165c575b',
        ],
        os: 'linux',
        variant: undefined,
      },
    ])
  })

  test('getImageInfo with variant', async () => {
    const repository = 'ghcr.io/nginx/nginx-prometheus-exporter'
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
