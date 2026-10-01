import { expect, test } from '@playwright/test'
import { describeDevice, entryLabel, failuresToReport, type AccessEntry } from '../../src/access'

const e = (at: string, ok: boolean, locked = false): AccessEntry => ({ at: `2026-09-30T${at}:00.000Z`, ok, locked })

test('descreve o aparelho pelo user-agent', () => {
  expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36')).toBe('Chrome no Windows')
  expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0 Safari/537.36 Edg/139.0')).toBe('Edge no Windows')
  expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari no iOS')
  expect(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36')).toBe('Chrome no Android')
  expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/130.0')).toBe('Firefox no macOS')
  expect(describeDevice('curl/8.0')).toBe('Navegador')
  expect(describeDevice('')).toBe('Aparelho desconhecido')
  expect(describeDevice(null)).toBe('Aparelho desconhecido')
})

test('rótulos das tentativas', () => {
  expect(entryLabel(e('10:00', true))).toBe('Entrou')
  expect(entryLabel(e('10:00', false))).toBe('Senha ou e-mail errado')
  expect(entryLabel(e('10:00', false, true))).toContain('Bloqueada')
})

test('o aviso conta só as tentativas erradas desde o login anterior e ignora o erro de digitação logo antes do login', () => {
  const entries = [
    e('08:00', true), // login anterior
    e('09:00', false), // tentativa errada (não foi o usuário)
    e('09:05', false),
    e('11:58', false), // erro de digitação a 2 minutos do login: ignorado
    e('12:00', true), // login atual
  ]
  expect(failuresToReport(entries, '').map((x) => x.at.slice(11, 16))).toEqual(['09:05', '09:00'])
  // depois de dispensar, só o que vier depois
  expect(failuresToReport(entries, '2026-09-30T09:05:00.000Z')).toEqual([])
  expect(failuresToReport([...entries, e('13:00', false)], '2026-09-30T09:05:00.000Z').map((x) => x.at.slice(11, 16))).toEqual(['13:00']) // alguém tentando agora
  // antes do login anterior não conta
  expect(failuresToReport([e('06:00', false), e('08:00', true), e('12:00', true)], '')).toEqual([])
  // bloqueios também são tentativas suspeitas
  expect(failuresToReport([e('08:00', true), e('09:00', false, true), e('12:00', true)], '')).toHaveLength(1)
  // sem nada: nada
  expect(failuresToReport([], '')).toEqual([])
  // primeiro login da vida: tentativas antes dele (fora da janela de erro de digitação) contam
  expect(failuresToReport([e('05:00', false), e('12:00', true)], '')).toHaveLength(1)
})
