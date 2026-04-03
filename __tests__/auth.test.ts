import {jest, describe, it, expect, beforeEach} from '@jest/globals'

// Mock child_process BEFORE auth.ts is imported so spawnSync is intercepted.
const spawnSyncMock = jest.fn()
jest.unstable_mockModule('child_process', () => ({spawnSync: spawnSyncMock}))

// Dynamic imports must come AFTER the mock registration above.
const {getRegistryAuth} = await import('../src/auth.js')
const {Docker} = await import('@docker/actions-toolkit/lib/docker/docker.js')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REGISTRY = 'registry.example.com'

type ConfigShape = {
  auths?: Record<string, {username?: string; password?: string; auth?: string}>
  credsStore?: string
  credHelpers?: Record<string, string>
}

function mockConfig(cfg: ConfigShape | undefined): ReturnType<typeof Docker.configFile> {
  return cfg as unknown as ReturnType<typeof Docker.configFile>
}

function spawnOk(username: string, secret: string) {
  return {pid: 1, output: [], stdout: JSON.stringify({Username: username, Secret: secret}), stderr: '', status: 0, signal: null}
}

function spawnFailed() {
  return {pid: 1, output: [], stdout: '', stderr: 'not found', status: 1, signal: null}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getRegistryAuth', () => {
  beforeEach(() => {
    jest.spyOn(Docker, 'configFile').mockReturnValue(mockConfig(undefined))
    spawnSyncMock.mockReturnValue(spawnFailed())
  })

  it('should return undefined when no Docker config exists', () => {
    expect(getRegistryAuth(REGISTRY)).toBeUndefined()
  })

  it('should return username and password directly from auths config', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({auths: {[REGISTRY]: {username: 'user', password: 'pass'}}}))
    expect(getRegistryAuth(REGISTRY)).toEqual({username: 'user', password: 'pass'})
  })

  it('should decode base64-encoded auth field and split on the first colon', () => {
    const encoded = Buffer.from('myuser:mypass:extra').toString('base64')
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({auths: {[REGISTRY]: {auth: encoded}}}))
    expect(getRegistryAuth(REGISTRY)).toEqual({username: 'myuser', password: 'mypass:extra'})
  })

  it('should return empty password when base64 auth has no colon', () => {
    const encoded = Buffer.from('tokenonly').toString('base64')
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({auths: {[REGISTRY]: {auth: encoded}}}))
    expect(getRegistryAuth(REGISTRY)).toEqual({username: 'tokenonly', password: ''})
  })

  it('should use credHelpers[registry] and return the helper credentials', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credHelpers: {[REGISTRY]: 'myhelper'}}))
    spawnSyncMock.mockReturnValue(spawnOk('helperuser', 'helperpass'))
    expect(getRegistryAuth(REGISTRY)).toEqual({username: 'helperuser', password: 'helperpass'})
  })

  it('should return undefined when the credHelpers helper exits with a non-zero status', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credHelpers: {[REGISTRY]: 'myhelper'}}))
    // spawnSyncMock returns spawnFailed() from beforeEach
    expect(getRegistryAuth(REGISTRY)).toBeUndefined()
  })

  it('should use credsStore when no per-registry credHelper is configured', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credsStore: 'osxkeychain'}))
    spawnSyncMock.mockReturnValue(spawnOk('storeuser', 'storepass'))
    expect(getRegistryAuth(REGISTRY)).toEqual({username: 'storeuser', password: 'storepass'})
  })

  it('should return undefined when the credsStore helper exits with a non-zero status', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credsStore: 'osxkeychain'}))
    // spawnSyncMock returns spawnFailed() from beforeEach
    expect(getRegistryAuth(REGISTRY)).toBeUndefined()
  })

  it('should throw when the helper binary fails to execute', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credsStore: 'badhelper'}))
    spawnSyncMock.mockReturnValue({
      pid: 0,
      output: [],
      stdout: '',
      stderr: '',
      status: null,
      signal: null,
      error: new Error('ENOENT: no such file or directory'),
    })
    expect(() => getRegistryAuth(REGISTRY)).toThrow('failed to execute')
  })

  it('should throw when the helper returns invalid JSON', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credsStore: 'badhelper'}))
    spawnSyncMock.mockReturnValue({pid: 1, output: [], stdout: 'not-valid-json', stderr: '', status: 0, signal: null})
    expect(() => getRegistryAuth(REGISTRY)).toThrow('Failed to parse credential helper output')
  })

  it('should throw when the helper JSON is missing Username or Secret fields', () => {
    jest.mocked(Docker.configFile).mockReturnValue(mockConfig({credsStore: 'badhelper'}))
    spawnSyncMock.mockReturnValue({
      pid: 1,
      output: [],
      stdout: JSON.stringify({User: 'wrong', Token: 'wrong'}),
      stderr: '',
      status: 0,
      signal: null,
    })
    expect(() => getRegistryAuth(REGISTRY)).toThrow('Failed to parse credential helper output')
  })
})
