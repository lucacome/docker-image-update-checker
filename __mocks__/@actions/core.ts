/* eslint-disable @typescript-eslint/no-explicit-any */
import {jest} from '@jest/globals'
export const ExitCode = {Success: 0, Failure: 1}
export const addPath = jest.fn()
export const debug = jest.fn()
export const endGroup = jest.fn()
export const error = jest.fn()
export const exportVariable = jest.fn()
export const getBooleanInput = (jest.fn() as jest.MockedFunction<any>).mockReturnValue(false)
export const getIDToken = jest.fn()
export const getInput = (jest.fn() as jest.MockedFunction<any>).mockReturnValue('')
export const getMultilineInput = (jest.fn() as jest.MockedFunction<any>).mockReturnValue([])
export const getState = (jest.fn() as jest.MockedFunction<any>).mockReturnValue('')
export const group = (jest.fn() as jest.MockedFunction<any>).mockImplementation(async (_name: string, fn?: () => unknown) => {
  if (typeof fn === 'function') {
    return await fn()
  }
})
export const info = jest.fn()
export const isDebug = (jest.fn() as jest.MockedFunction<any>).mockReturnValue(false)
export const markdownSummary = {}
export const notice = jest.fn()
export const platform = {}
export const saveState = jest.fn()
export const setCommandEcho = jest.fn()
export const setFailed = jest.fn()
export const setOutput = jest.fn()
export const setSecret = jest.fn()
export const startGroup = jest.fn()
export const summary = {}
export const toPlatformPath = (jest.fn() as jest.MockedFunction<any>).mockImplementation((p: string) => p)
export const toPosixPath = (jest.fn() as jest.MockedFunction<any>).mockImplementation((p: string) => p)
export const toWin32Path = (jest.fn() as jest.MockedFunction<any>).mockImplementation((p: string) => p)
export const warning = jest.fn()
