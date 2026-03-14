# TASKS.md — Checklist de Migração FiberOps FTTH

**Stack origem:** Cloudflare Worker + D1 SQLite + HTML/JS puro
**Stack destino:** Next.js 16 (App Router) + MongoDB (Mongoose) + MapLibre GL + NextAuth v5
**Última atualização:** 2026-03-14

---

## Legenda

- `[x]` Concluído (arquivo existe e está implementado)
- `[ ]` Pendente (não existe ou precisa ser criado/validado)
- `[~]` Parcial (existe mas falta complementar)

---

## FASE 1 — Setup do Ambiente

### 1.1 Infraestrutura

- [ ] Criar conta no MongoDB Atlas (tier M0 gratuito para testes)
- [ ] Criar cluster, usuário de banco e whitelist de IPs (`0.0.0.0/0` para Vercel)
- [ ] Copiar connection string para `.env.local` → `MONGODB_URI`
- [ ] Gerar `AUTH_SECRET` via `openssl rand -base64 32` e adicionar ao `.env.local`
- [ ] Definir `NEXTAUTH_URL=http://localhost:3000` em `.env.local` (staging/prod: URL real)
- [ ] Confirmar que `.env.local` está no `.gitignore` (já está: `.env*`)

### 1.2 Build e Execução Local

- [ ] Executar `npm install` e confirmar que não há erros
- [ ] Executar `npm run build` sem erros de compilação
- [ ] Executar `npm run dev` e acessar `http://localhost:3000`
- [ ] Confirmar que o Next.js conecta ao MongoDB nos primeiros requests (checar log)

---

## FASE 2 — Migração de Dados (ETL D1 → MongoDB)

### 2.1 Exportar Dados do D1

- [ ] Exportar `users` → `users.sql`
- [ ] Exportar `projetos` → `projetos.sql`
- [ ] Exportar `ctos` → `ctos.sql`
- [ ] Exportar `caixas_emenda_cdo` → `caixas.sql`
- [ ] Exportar `rotas` → `rotas.sql`
- [ ] Exportar `postes` → `postes.sql`
- [ ] Exportar `olts` → `olts.sql`
- [ ] Exportar `movimentacoes_d1` → `movimentacoes.sql`
- [ ] Exportar `registros_pendentes` → `registros_pendentes.sql`
- [ ] Exportar `log_eventos` → `log_eventos.sql`

### 2.2 Converter SQL para JSON

- [ ] Converter cada `.sql` para `.json` (ex.: ferramenta `sql-to-json` ou script manual)

### 2.3 Executar ETL com Script

O script base está em `scripts/migrate-d1-to-mongo.mjs` (a ser criado com base no plano).

- [ ] Criar/adaptar `scripts/migrate-d1-to-mongo.mjs` para cada coleção
- [ ] Migrar `users` — verificar formato de `password_hash` (PBKDF2 vs SHA-256)
- [ ] Migrar `projetos` — campo `config` TEXT JSON → subdocumento nativo
- [ ] Migrar `ctos` — normalizar `CTO_ID` (maiúsc.) para `cto_id`; garantir `cdo_id` e `porta_cdo`
- [ ] Migrar `caixas_emenda_cdo` — mapeamento direto
- [ ] Migrar `rotas` — inverter coordenadas `[lat,lng]` → `[lng,lat]` (GeoJSON 2dsphere); usar `Rota.latLngToGeoJSON()`; filtrar rotas com menos de 2 pontos
- [ ] Migrar `postes` — mapeamento direto
- [ ] Migrar `olts` — mapeamento direto
- [ ] Migrar `movimentacoes_d1` → `movimentacoes` — normalizar campos de maiúsculas (`CTO_ID`, `Tipo`, `Cliente`) para snake_case
- [ ] Migrar `registros_pendentes` — mapeamento direto
- [ ] Migrar `log_eventos` — adicionar campo `expireAt` para TTL index

### 2.4 Criar Índices no MongoDB Antes de Importar

- [ ] Criar índice `2dsphere` em `rotas`: `db.rotas.createIndex({"geojson":"2dsphere"})`
- [ ] Criar TTL index em `log_eventos`: `db.log_eventos.createIndex({"expireAt":1},{expireAfterSeconds:0})`
- [ ] Confirmar índices únicos em `ctos` (projeto_id + cto_id)

### 2.5 Validações Pós-ETL

- [ ] Comparar contagens: `db.<colecao>.countDocuments()` vs contagem no D1
- [ ] Verificar exemplo de CTO com diagrama: `db.ctos.findOne({ diagrama: { $ne: null } })`
- [ ] Verificar exemplo de rota com GeoJSON válido: `db.rotas.findOne({}, { geojson: 1 })`
- [ ] Verificar que todos os usuários têm `projeto_id` (não nulo)
- [ ] Verificar índices únicos sem duplicatas

### 2.6 Script de Criação do Superadmin

- [ ] Executar `scripts/create-superadmin.mjs` para criar o primeiro usuário superadmin
- [ ] Confirmar login com o superadmin criado

---

## FASE 3 — Autenticação NextAuth v5

### 3.1 Arquivos Implementados (verificar funcionamento)

- [x] `src/lib/auth.js` — Credentials provider, PBKDF2 + SHA-256 legado, rate limiting, single-session
- [x] `src/lib/auth.config.js` — Configuração NextAuth
- [x] `src/lib/password.js` — `verifyPassword` + `hashPassword` (PBKDF2 / SHA-256)
- [x] `src/middleware.js` — Rate limiting + proteção de rotas + RBAC
- [x] `src/app/api/auth/[...nextauth]/route.js` — Handler NextAuth v5

### 3.2 Testes de Autenticação

- [ ] Testar login com usuário legado formato SHA-256 (64 hex chars)
- [ ] Testar login com usuário legado formato PBKDF2 (`pbkdf2$...`)
- [ ] Testar rate limiting: 6 tentativas inválidas devem bloquear o IP por 15 min
- [ ] Testar rate limiting por username: 10 falhas em 10 min → bloqueio de 30 min
- [ ] Testar que login com usuário bloqueado retorna erro claro
- [ ] Testar single-session: novo login invalida sessão anterior
- [ ] Testar JWT: expirar em 8h (verificar `maxAge` na config)
- [ ] Testar `must_change_password=true` redireciona para `/perfil/senha`

### 3.3 Proteção de Rotas (Middleware)

- [ ] `/login` redireciona para `/` se já autenticado
- [ ] `/cadastro` redireciona para `/` se já autenticado
- [ ] `/superadmin/*` bloqueia roles menores que `superadmin`
- [ ] `/admin/*` bloqueia roles menores que `admin`
- [ ] `/` e demais rotas autenticadas redirecionam para `/login` sem sessão

---

## FASE 4 — Páginas e Componentes

### 4.1 Páginas Existentes (verificar funcionamento)

- [x] `src/app/(auth)/login/page.js` — Formulário de login
- [x] `src/app/(auth)/cadastro/page.js` — Auto-cadastro público
- [x] `src/app/(dashboard)/page.js` — Mapa principal
- [x] `src/app/(admin)/ctos/page.js` — Painel CTOs
- [x] `src/app/(admin)/usuarios/page.js` — Painel de usuários
- [x] `src/app/(superadmin)/projetos/page.js` — Gerenciar projetos
- [x] `src/app/(superadmin)/registros/page.js` — Aprovar/rejeitar registros

### 4.2 Páginas Faltando (criar)

- [x] `src/app/(auth)/layout.js` — Layout sem sidebar (já existe, verificar)
- [x] `src/app/(admin)/caixas/page.js` — Painel CE/CDOs
- [x] `src/app/(admin)/rotas/page.js` — Painel de Rotas
- [x] `src/app/(admin)/postes/page.js` — Painel de Postes
- [x] `src/app/(admin)/olts/page.js` — Painel de OLTs
- [x] `src/app/(admin)/movimentacoes/page.js` — Painel de Movimentações
- [x] `src/app/(admin)/diagramas/page.js` — Editor de Diagramas
- [x] `src/app/(admin)/topologia/page.js` — Topologia OLT→CDO→CTO
- [x] `src/app/(superadmin)/stats/page.js` — Dashboard de estatísticas
- [x] `src/app/(dashboard)/perfil/senha/page.js` — Troca de senha obrigatória

### 4.3 Componentes Admin (verificar funcionamento)

- [x] `src/components//ctosClient.js` — Tabela + diálogo de CTOs
- [x] `src/components/admin/CTOForm.js` — Formulário CTO (criar/editar)
- [x] `src/components/admin/CaixaForm.js` — Formulário CE/CDO
- [x] `src/components/admin/RotaForm.js` — Formulário de Rota
- [x] `src/components/admin/PosteForm.js` — Formulário de Poste
- [x] `src/components/admin/OLTForm.js` — Formulário de OLT
- [x] `src/components/admin/MovimentacaoForm.js` — Formulário de Movimentação
- [x] `src/components/admin/UsuariosClient.js` — Gerenciar usuários do projeto
- [x] `src/components/admin/CaixasClient.js` — Tabela + diálogo de CE/CDOs
- [x] `src/components/admin/RotasClient.js` — Tabela + diálogo de Rotas
- [x] `src/components/admin/PostesClient.js` — Tabela + diálogo de Postes
- [x] `src/components/admin/OLTsClient.js` — Tabela + diálogo de OLTs
- [x] `src/components/admin/MovimentacoesClient.js` — Tabela de Movimentações
- [x] `src/components/admin/DiagramaCTOEditor.js` — Editor visual de diagrama CTO
- [x] `src/components/admin/DiagramaCDOEditor.js` — Editor visual de diagrama CDO

### 4.4 Componentes Superadmin (verificar)

- [x] `src/components/superadmin/ProjetosClient.js`
- [x] `src/components/superadmin/RegistrosClient.js`
- [x] `src/components/superadmin/SuperadminSidebarLayout.js`
- [x] `src/components/superadmin/StatsClient.js` — Dashboard de estatísticas

### 4.5 Componentes de Mapa (verificar funcionamento)

- [x] `src/components/map/MapaFTTH.js` — Componente principal do mapa (CSR, dynamic import)
- [x] `src/components/map/MapaFTTHClient.js` — Wrapper client-side
- [x] `src/components/map/BottomSheet.js` — Painel deslizante de detalhes
- [x] `src/components/map/LayerToggles.js` — Controles de visibilidade de camadas

### 4.6 Layouts (verificar)

- [x] `src/app/layout.js` — Root layout
- [x] `src/app/(auth)/layout.js`
- [x] `src/app/(dashboard)/layout.js`
- [x] `src/app/(admin)/layout.js`
- [x] `src/app/(superadmin)/layout.js`
- [x] `src/components/layout/Sidebar.js`
- [x] `src/components/shared/SidebarLayout.js`

---

## FASE 5 — Features Avançadas

### 5.1 API Routes Faltando

- [x] `src/app/api/reverse_geocode/route.js` — Proxy para Nominatim (GPS reverse geocoding)
- [x] `src/app/api/health/route.js` — Verificação de saúde (MongoDB conectado)

### 5.2 Offline Queue

- [x] `src/hooks/useOfflineQueue.js` — Fila offline persistida no `localStorage`
- [ ] Integrar `useOfflineQueue` nos formulários de CTO, Caixa, Rota, Poste com `enqueue` quando offline
- [ ] Testar: criar CTO offline → reconectar → verificar sync automático

### 5.3 GPS e Geolocalização

- [x] `src/hooks/useGPS.js` — Geolocation API + follow mode
- [ ] Testar GPS tracking: botão liga/desliga; Follow Mode centraliza mapa no usuário
- [ ] Integrar reverse geocoding com a nova route handler `api/reverse_geocode`

### 5.4 Busca Global

- [x] Implementar Server Action `searchGlobal` em `src/actions/search.js` — busca com `$regex` em CTOs, CDOs, Rotas, Postes
- [ ] Criar componente de busca na sidebar ou header
- [ ] Testar busca por endereço, nome de CTO, nome de cliente

### 5.5 Editor de Diagrama CTO/CDO

- [x] Criar `src/components/admin/DiagramaCTOEditor.js` — editor visual de portas
- [x] Criar `src/components/admin/DiagramaCDOEditor.js` — editor visual de portas
- [x] Integrado com `src/actions/ctos.js` → `saveDiagramaCTO`
- [x] Integrado com `src/actions/caixas.js` → `saveDiagramaCaixa`
- [ ] Testar: abrir diagrama de CTO existente, editar porta, salvar, recarregar

### 5.6 Topologia OLT → CDO → CTO

- [x] `src/models/Topologia.js` — modelo de vínculos
- [x] Criar `src/app/(admin)/topologia/page.js` — visualização da topologia
- [x] Criar `src/components/admin/TopologiaClient.js` — componente de visualização
- [x] `getTopologia` já existia em `src/actions/olts.js`
- [ ] Testar: visualizar árvore OLT → CDO → CTO no painel

### 5.7 Importação em Bulk

- [x] `src/actions/imports.js` — Server Action para importação em massa
- [ ] Criar UI de importação (botão "Importar CSV/JSON" no painel admin)
- [ ] Testar importação de CTOs, CDOs, Rotas e Postes via bulk

### 5.8 Troca de Senha Obrigatória

- [x] Criar `src/app/(dashboard)/perfil/senha/page.js`
- [x] Criar formulário de troca de senha (senha atual + nova senha + confirmação)
- [x] Implementar Server Action `changePassword` em `src/actions/usuarios.js`
- [ ] Testar: usuário com `must_change_password=true` é redirecionado e não consegue acessar outras rotas até trocar a senha

---

## FASE 6 — Testes de UI (End-to-End)

### 6.1 Mapa Principal

- [ ] Mapa renderiza sem erros de console em localhost
- [ ] Camada CTOs exibe dados do MongoDB
- [ ] Camada CE/CDOs exibe dados do MongoDB
- [ ] Camada Rotas exibe traçados do MongoDB
- [ ] Camada Postes exibe dados do MongoDB
- [ ] Bottom Sheet abre ao clicar em elemento do mapa
- [ ] Toggles de camada ligam/desligam corretamente
- [ ] Modo satélite alterna corretamente
- [ ] GPS tracking: botão liga/desliga; Follow Mode centraliza mapa no usuário
- [ ] Banner "Offline" aparece ao desconectar a rede; some ao reconectar

### 6.2 Operações CRUD via Painel Admin

- [ ] CTO: criar → aparece no mapa após revalidação
- [ ] CTO: editar → atualiza no mapa após revalidação
- [ ] CTO: deletar → remove do mapa após revalidação
- [ ] CE/CDO: criar, editar, deletar
- [ ] Rota: criar, editar, deletar
- [ ] Poste: criar, editar, deletar
- [ ] OLT: criar, editar
- [ ] Movimentação: técnico consegue registrar; role `user` não consegue

### 6.3 Painel de Usuários (Admin)

- [ ] Listar usuários do projeto
- [ ] Criar novo usuário com role
- [ ] Desativar/reativar usuário
- [ ] Usuário desativado não consegue fazer login

### 6.4 Painel Superadmin

- [ ] Listar todos os projetos
- [ ] Ativar/desativar projeto
- [ ] Aprovar auto-cadastro → projeto criado + usuário admin criado
- [ ] Rejeitar auto-cadastro → registro marcado como rejeitado
- [ ] Dashboard de estatísticas exibe contagens corretas

### 6.5 Autenticação (regressão)

- [ ] Login correto → redireciona para `/`
- [ ] Login com senha errada → mensagem de erro clara
- [ ] Sessão expira em 8h (verificar comportamento)
- [ ] Logout limpa sessão e redireciona para `/login`

---

## FASE 7 — Deploy e Cutover

### 7.1 Pré-Deploy

- [ ] `npm run build` sem erros em modo produção
- [ ] Verificar que `.env.local` **não** está no git: `git status | grep env` (deve ser vazio)
- [ ] Verificar bundle size do MapLibre (dinâmico, não deve estar no bundle principal)
- [ ] Configurar `NEXTAUTH_URL` com a URL real de produção/staging

### 7.2 Deploy em Staging

- [ ] Deploy para subdomínio de staging (ex.: `staging.fiberops.com`)
- [ ] Configurar variáveis de ambiente no painel da plataforma (Vercel / Railway / VPS)
- [ ] Testar login com usuários reais em staging
- [ ] Executar todos os testes de UI (Fase 6) em staging

### 7.3 ETL Delta (antes do cutover)

- [ ] Freeze de escrita no Cloudflare Worker (modo read-only ou desativar writes)
- [ ] Re-exportar registros criados após o ETL inicial
- [ ] Re-executar ETL apenas para registros novos (upsert — sem risco de duplicata)
- [ ] Validar contagens pós-ETL delta

### 7.4 Cutover de DNS

- [ ] DNS cutover: apontar domínio principal para Next.js
- [ ] Verificar `curl https://fiberops.com/api/health` retorna 200
- [ ] Testar login em produção
- [ ] Monitorar logs de erro nas primeiras 24h
- [ ] Manter Cloudflare Worker como fallback por 7 dias antes de desativar

### 7.5 Pós-Cutover

- [ ] Invalidar service worker legado (`sw.js`) para evitar cache stale nos browsers dos usuários
- [ ] Instruir usuários a limpar cache do browser se necessário
- [ ] Monitorar MongoDB Atlas → Performance Advisor para slow queries
- [ ] Verificar rate limiting em produção (não está bloqueando usuários legítimos)
- [ ] Reavaliar single-session enforcement: em produção multi-instância, migrar `activeSessionMap` para Redis

---

## Riscos de Alta Prioridade (Checar Antes do Cutover)

- [ ] **[CRÍTICO]** `NEXTAUTH_URL` incorreto em produção causa redirect loop — validar antes do cutover
- [ ] **[CRÍTICO]** MongoDB Atlas IP whitelist bloqueando Vercel — usar `0.0.0.0/0` ou VPC Peering
- [ ] **[CRÍTICO]** Página `/perfil/senha` não existe — usuários com `must_change_password=true` ficam presos
- [ ] **[ALTO]** Coordenadas GeoJSON invertidas — validar visualmente no mapa após ETL
- [ ] **[ALTO]** Campos `CTO_ID` em maiúsculas no D1 — ETL normaliza para lowercase (verificar script)
- [ ] **[ALTO]** `projeto_id` ausente em registros legados — usar default `"default"` e corrigir no ETL
- [ ] **[MÉDIO]** Índice `2dsphere` em `rotas` deve ser criado **antes** da importação dos dados
- [ ] **[MÉDIO]** Diagramas JSON corrompidos no D1 — parsear com `try/catch`, gravar `null` se inválido
- [ ] **[MÉDIO]** `next-auth@beta` (v5) — fixar versão `^5.0.0-beta.29`, não fazer upgrade automático
- [ ] **[BAIXO]** `bcryptjs` instalado mas não usado — remover do `package.json` ou documentar como alternativa futura

---

## Resumo de Progresso

| Fase                           | Status                         | Estimativa            |
| ------------------------------ | ------------------------------ | --------------------- |
| Fase 1 — Setup do Ambiente     | Pendente                       | 1 dia                 |
| Fase 2 — ETL D1 → MongoDB      | Pendente                       | 2-3 dias              |
| Fase 3 — Autenticação NextAuth | Implementado, testes pendentes | 1 dia                 |
| Fase 4 — Páginas e Componentes | **Concluído**                  | —                     |
| Fase 5 — Features Avançadas    | Parcial (~80% implementado)    | 1-2 dias              |
| Fase 6 — Testes End-to-End     | Pendente                       | 2 dias                |
| Fase 7 — Deploy e Cutover      | Pendente                       | 2-3 dias              |
| **Total estimado**             |                                | **~14-18 dias úteis** |
