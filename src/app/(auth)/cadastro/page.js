'use client'

import { useState } from 'react'
import Link from 'next/link'
import { checkLoginDisponivel, criarRegistro } from '@/actions/registros'

const PLANOS = [
  {
    id: 'basico',
    nome: 'Básico',
    preco: 'Grátis',
    descricao: 'Até 200 CTOs, 3 usuários',
    destaque: false,
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$ 49/mês',
    descricao: 'CTOs ilimitadas, usuários ilimitados',
    destaque: true,
  },
]

export default function CadastroPage() {
  const [passo, setPasso] = useState(1)
  const [empresa, setEmpresa] = useState('')
  const [username, setUsername] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [plano, setPlano] = useState('basico')
  const [verificandoLogin, setVerificandoLogin] = useState(false)
  const [loginDisponivel, setLoginDisponivel] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)

  async function verificarLogin(valor) {
    if (!valor || valor.length < 3) {
      setLoginDisponivel(null)
      return
    }
    setVerificandoLogin(true)
    try {
      const res = await checkLoginDisponivel(valor)
      setLoginDisponivel(res.disponivel)
    } catch {
      setLoginDisponivel(null)
    } finally {
      setVerificandoLogin(false)
    }
  }

  async function handleSubmit() {
    setErro(null)
    setEnviando(true)
    try {
      const res = await criarRegistro({
        username,
        password: senha,
        projeto_id: empresa.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        empresa,
        nome_completo: empresa,
      })
      setResultado({ ...res, plano })
      setPasso(5)
    } catch (e) {
      setErro(e.message || 'Erro ao enviar cadastro.')
    } finally {
      setEnviando(false)
    }
  }

  function avancar() {
    setErro(null)
    setPasso((p) => p + 1)
  }

  function voltar() {
    setErro(null)
    setPasso((p) => p - 1)
  }

  const inputStyle = {
    backgroundColor: '#0b1220',
    border: '1px solid #1f2937',
    color: '#f1f5f9',
  }

  const cardStyle = {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
  }

  return (
    <div className="w-full max-w-md px-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">FiberOps</h1>
        <p className="text-sm text-slate-400 mt-1">Criar nova conta</p>
      </div>

      <div style={cardStyle} className="rounded-2xl p-8">
        {/* Indicador de passos */}
        {passo <= 4 && (
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-1 flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: passo >= n ? '#0284c7' : '#1f2937',
                    color: passo >= n ? '#fff' : '#64748b',
                  }}
                >
                  {n}
                </div>
                {n < 4 && (
                  <div
                    className="flex-1 h-0.5 mx-1"
                    style={{ backgroundColor: passo > n ? '#0284c7' : '#1f2937' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Passo 1: Nome da empresa */}
        {passo === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Nome da empresa</h2>
            <p className="text-sm text-slate-400 mb-6">
              Como sua empresa é chamada? Isso identificará seu projeto no sistema.
            </p>
            <div className="flex flex-col gap-1 mb-6">
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Nome da empresa
              </label>
              <input
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex: Fibra Rápida Telecom"
                style={inputStyle}
                className="rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-600"
              />
            </div>
            <button
              onClick={avancar}
              disabled={!empresa.trim() || empresa.trim().length < 2}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Passo 2: Usuário e senha */}
        {passo === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Suas credenciais</h2>
            <p className="text-sm text-slate-400 mb-6">
              Defina o nome de usuário e senha para acessar o sistema.
            </p>

            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Nome de usuário
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setLoginDisponivel(null)
                    }}
                    onBlur={(e) => verificarLogin(e.target.value)}
                    placeholder="ex: joao.silva"
                    style={inputStyle}
                    className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-600 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {verificandoLogin && (
                      <span className="text-slate-500">...</span>
                    )}
                    {!verificandoLogin && loginDisponivel === true && (
                      <span className="text-green-400">✓</span>
                    )}
                    {!verificandoLogin && loginDisponivel === false && (
                      <span className="text-red-400">✗</span>
                    )}
                  </span>
                </div>
                {loginDisponivel === false && (
                  <p className="text-xs text-red-400">Nome de usuário já está em uso.</p>
                )}
                {loginDisponivel === true && (
                  <p className="text-xs text-green-400">Nome de usuário disponível.</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  style={inputStyle}
                  className="rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-600"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={senhaConfirm}
                  onChange={(e) => setSenhaConfirm(e.target.value)}
                  placeholder="repita a senha"
                  style={inputStyle}
                  className="rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-600"
                />
                {senhaConfirm && senha !== senhaConfirm && (
                  <p className="text-xs text-red-400">As senhas não coincidem.</p>
                )}
              </div>
            </div>

            {erro && (
              <div
                style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
              >
                {erro}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={voltar}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 hover:bg-slate-800 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={avancar}
                disabled={
                  !username.trim() ||
                  loginDisponivel !== true ||
                  senha.length < 6 ||
                  senha !== senhaConfirm
                }
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 3: Plano */}
        {passo === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Escolha seu plano</h2>
            <p className="text-sm text-slate-400 mb-6">
              Comece grátis e faça upgrade quando precisar.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              {PLANOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlano(p.id)}
                  style={{
                    backgroundColor: plano === p.id ? '#0c2340' : '#0b1220',
                    border: `1px solid ${plano === p.id ? '#0284c7' : '#1f2937'}`,
                  }}
                  className="rounded-xl p-4 text-left transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{p.nome}</span>
                        {p.destaque && (
                          <span
                            style={{ backgroundColor: '#0369a1', color: '#bae6fd' }}
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                          >
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{p.descricao}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">{p.preco}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={voltar}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 hover:bg-slate-800 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={avancar}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Passo 4: Confirmação */}
        {passo === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Confirmar cadastro</h2>
            <p className="text-sm text-slate-400 mb-6">Revise os dados antes de enviar.</p>

            <div
              style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
              className="rounded-xl p-4 mb-6 flex flex-col gap-2"
            >
              <Row label="Empresa" value={empresa} />
              <Row label="Usuário" value={username} />
              <Row label="Plano" value={PLANOS.find((p) => p.id === plano)?.nome} />
            </div>

            {erro && (
              <div
                style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
              >
                {erro}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={voltar}
                disabled={enviando}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 hover:bg-slate-800 disabled:opacity-40 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={enviando}
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {enviando ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        )}

        {/* Passo 5: Resultado */}
        {passo === 5 && resultado && (
          <div className="text-center">
            <div className="text-4xl mb-4">
              {resultado.plano === 'basico' ? '✅' : '⏳'}
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              {resultado.plano === 'basico' ? 'Cadastro aprovado!' : 'Solicitação enviada!'}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {resultado.plano === 'basico'
                ? 'Seu acesso básico foi criado. Aguarde a aprovação do administrador para fazer login.'
                : 'Sua solicitação pro está em análise. Você receberá acesso após aprovação.'}
            </p>
            <p className="text-xs text-slate-500 mb-6">{resultado.mensagem}</p>
            <Link
              href="/login"
              className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors"
            >
              Ir para o login
            </Link>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-sky-400 hover:text-sky-300 transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  )
}
