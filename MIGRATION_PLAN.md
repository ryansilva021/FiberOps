# Plano de Migração — FiberOps FTTH

## De: Cloudflare Worker + D1 (SQLite) para Next.js 16 + MongoDB

**Data de elaboração:** 2026-03-13
**Stack origem:** Cloudflare Workers (`worker.js` 2785 linhas) + D1 SQLite + HTML/CSS/JS puro (PWA)
**Stack destino:** Next.js 16 (App Router) + MongoDB (Mongoose) + MapLibre GL + NextAuth v5

---

## Visão Geral da Arquitetura

### Sistema Legado (Cloudflare Worker + D1)

```
Browser (HTML/JS puro)  ──►  Cloudflare Worker (worker.js)  ──►  D1 SQLite
  service-worker.js              CORS + Rotas + Auth                 tabelas SQL
  localStorage cache             PBKDF2 / SHA-256                    migrations/
  GPS + MapLibre
```

### Sistema Novo (Next.js + MongoDB)

```
Next.js 16 App Router
├── Server Components (data fetching no servidor)
├── Server Actions ('use server') — substitui as rotas do Worker
├── Client Components ('use client') — MapLibre, GPS, offline queue
├── Middleware (NextAuth v5 + rate limiting em memória)
└── MongoDB Atlas (Mongoose ODM)
     ├── users              (era: users)
     ├── projetos           (era: projetos)
     ├── ctos               (era: ctos)
     ├── caixas_emenda_cdo  (era: caixas_emenda_cdo)
     ├── rotas              (era: rotas)
     ├── postes             (era: postes)
     ├── olts               (era: olts)
     ├── movimentacoes      (era: movimentacoes_d1)
     ├── registros_pendentes(era: registros_pendentes)
     ├── log_eventos        (era: log_eventos)
     ├── login_attempts     (novo — rate limiting persistido)
     └── topologias         (novo — vínculos OLT → CDO → CTO)
```

---

## Estado Atual da Migração

### Ja Implementado

| Camada | Status | Arquivos |
|---|---|---|
| Modelos MongoDB | Completo | `src/models/*.js` (11 modelos) |
| Autenticacao NextAuth v5 | Completo | `src/lib/auth.js` |
| Conexao MongoDB singleton | Completo | `src/lib/db.js` |
| Hashing de senhas (PBKDF2 + SHA-256 legado) | Completo | `src/lib/password.js` |
| Middleware de rotas + rate limiting | Completo | `src/middleware.js` |
| Server Actions | Completo | `src/actions/*.js` (10 arquivos) |
| Mapa MapLibre (dynamic import SSR false) | Completo | `src/components/map/MapaFTTH.js` |
| Hooks do mapa (useMap, useMapLayers, useMapEvents) | Completo | `src/hooks/use*.js` |
| GPS tracking | Completo | `src/hooks/useGPS.js` |
| Offline queue (localStorage) | Completo | `src/hooks/useOfflineQueue.js` |
| Paginas (dashboard, admin, superadmin, auth) | Completo | `src/app/**` |
| Componentes admin (formularios CRUD) | Completo | `src/components/admin/*.js` |
| Componentes UI (base) | Completo | `src/components/ui/*.jsx` |

### Pendente para Go-live

- Criar cluster MongoDB Atlas e coletar `MONGODB_URI`
- Gerar `AUTH_SECRET` (`openssl rand -base64 32`)
- Executar ETL de dados do D1 para MongoDB
- Validar login com usuarios legados (PBKDF2 e SHA-256 simples)
- Testes end-to-end com usuarios reais em staging
- DNS cutover e monitoramento pos-deploy

---

## Dependencias

Todas as dependencias ja estao instaladas no `package.json`.

```json
{
  "dependencies": {
    "mongoose":        "^9.3.0",
    "next-auth":       "^5.0.0-beta.29",
    "maplibre-gl":     "^4.7.1",
    "bcryptjs":        "^3.0.3",
    "next":            "16.1.6",
    "react":           "19.2.3",
    "clsx":            "^2.1.1",
    "tailwind-merge":  "^3.5.0",
    "class-variance-authority": "^0.7.1",
    "lucide-react":    "^0.577.0",
    "@base-ui/react":  "^1.3.0"
  }
}
```

Para reinstalar do zero:

```bash
npm install
```

---

## Variaveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto com as seguintes variaveis:

```bash
# Conexao com MongoDB (obrigatorio)
MONGODB_URI=mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/ftthdb?retryWrites=true&w=majority

# Chave secreta do NextAuth v5 (obrigatorio — minimo 32 caracteres)
# Gerar com: openssl rand -base64 32
AUTH_SECRET=<chave_gerada>

# URL publica da aplicacao (obrigatorio em producao)
NEXTAUTH_URL=http://localhost:3000
```

> **Seguranca:** nunca commite `.env.local`. O arquivo ja deve estar listado no `.gitignore`.

---

## Fase 1 — Setup do Ambiente (Dia 1)

### Tarefas

- [ ] Criar conta no MongoDB Atlas (tier M0 gratuito suficiente para testes)
- [ ] Criar cluster, usuario de banco e whitelist de IPs
- [ ] Copiar a connection string para `.env.local` (`MONGODB_URI`)
- [ ] Gerar `AUTH_SECRET` via `openssl rand -base64 32`
- [ ] Executar `npm install` para confirmar dependencias
- [ ] Executar `npm run build` e verificar que nao ha erros de compilacao
- [ ] Executar `npm run dev` e acessar `http://localhost:3000`

### Verificacao

```bash
# Deve compilar sem erros
npm run build

# Deve iniciar e conectar ao MongoDB nos primeiros requests
npm run dev
```

---

## Fase 2 — Migracao de Dados D1 para MongoDB (Dias 2-3)

### Exportar Dados do D1

```bash
# Exportar banco D1 completo via Wrangler
wrangler d1 export ftth-db --output=ftth_export.sql

# Ou exportar por tabela (mais confiavel para grandes volumes)
wrangler d1 export ftth-db --table=ctos       --output=ctos.sql
wrangler d1 export ftth-db --table=caixas_emenda_cdo --output=caixas.sql
wrangler d1 export ftth-db --table=rotas      --output=rotas.sql
wrangler d1 export ftth-db --table=postes     --output=postes.sql
wrangler d1 export ftth-db --table=olts       --output=olts.sql
wrangler d1 export ftth-db --table=users      --output=users.sql
wrangler d1 export ftth-db --table=projetos   --output=projetos.sql
wrangler d1 export ftth-db --table=movimentacoes_d1 --output=movimentacoes.sql
```

### Mapeamento de Tabelas SQL para Colecoes MongoDB

| Tabela D1 (SQL) | Colecao MongoDB | Observacoes |
|---|---|---|
| `ctos` | `ctos` | `CTO_ID` (maiusc.) → `cto_id`; sem `cdo_id` no schema original — adicionar |
| `caixas_emenda_cdo` | `caixas_emenda_cdo` | Campo `id` mantido como string |
| `rotas` | `rotas` | `geojson` TEXT → subdocumento nativo; coordenadas precisam inversao [lat,lng] → [lng,lat] |
| `postes` | `postes` | Mapeamento direto |
| `olts` | `olts` | Campo `id` mantido como string |
| `users` | `users` | `password_hash` precisa verificar formato (PBKDF2 vs SHA-256) |
| `projetos` | `projetos` | Campo `config` TEXT JSON → subdocumento nativo |
| `movimentacoes_d1` | `movimentacoes` | Campos em maiusc. (`CTO_ID`, `Tipo`, `Cliente`) → snake_case |
| `registros_pendentes` | `registros_pendentes` | Mapeamento direto |
| `log_eventos` | `log_eventos` | Adicionar campo `expireAt` via TTL index |

### Script ETL de Referencia (Node.js)

O script abaixo e um ponto de partida. Adapte os paths e a logica de parse conforme o SQL exportado.

```javascript
// scripts/migrate-d1-to-mongo.mjs
import mongoose from 'mongoose'
import fs from 'fs'

const MONGODB_URI = process.env.MONGODB_URI
await mongoose.connect(MONGODB_URI)

// Exemplo: migrar CTOs de um JSON intermediario
// (converter o SQL para JSON primeiro com uma ferramenta como sql-to-json)
const ctos = JSON.parse(fs.readFileSync('ctos.json', 'utf8'))

for (const row of ctos) {
  await mongoose.connection.collection('ctos').updateOne(
    { projeto_id: row.projeto_id, cto_id: row.CTO_ID ?? row.cto_id },
    {
      $set: {
        cto_id:     row.CTO_ID ?? row.cto_id,
        projeto_id: row.projeto_id ?? 'default',
        nome:       row.NOME       ?? row.nome       ?? null,
        rua:        row.RUA        ?? row.rua         ?? null,
        bairro:     row.BAIRRO     ?? row.bairro      ?? null,
        lat:        Number(row.LAT ?? row.lat),
        lng:        Number(row.LNG ?? row.lng),
        capacidade: Number(row.CAPACIDADE ?? row.capacidade ?? 0),
        cdo_id:     row.cdo_id     ?? null,
        porta_cdo:  row.porta_cdo  ?? null,
        splitter_cto: row.splitter_cto ?? null,
        diagrama:   row.diagrama ? JSON.parse(row.diagrama) : null,
        updated_at: new Date(row.updated_at ?? Date.now()),
      }
    },
    { upsert: true }
  )
}

console.log(`Migradas ${ctos.length} CTOs`)
await mongoose.disconnect()
```

### Atencao ao Migrar Rotas (GeoJSON)

O sistema legado armazenava coordenadas em formato `[lat, lng]` (padrao geografico).
O GeoJSON e o indice `2dsphere` do MongoDB exigem `[lng, lat]` (padrao cartesiano).

```javascript
// Inverter coordenadas ao migrar rotas
const coordenadasGeoJSON = row.coordinates.map(([lat, lng]) => [lng, lat])
```

O modelo `Rota.js` ja inclui o metodo estatico `Rota.latLngToGeoJSON()` para essa conversao.

### Validacoes Pos-ETL

```javascript
// Verificar contagens
db.ctos.countDocuments()
db.caixas_emenda_cdo.countDocuments()
db.rotas.countDocuments()
db.postes.countDocuments()
db.users.countDocuments()

// Verificar indices unicos (nao pode haver duplicatas)
db.ctos.getIndexes()

// Verificar exemplo de CTO com diagrama
db.ctos.findOne({ diagrama: { $ne: null } })

// Verificar exemplo de rota com GeoJSON valido
db.rotas.findOne({}, { geojson: 1 })
```

---

## Fase 3 — Autenticacao NextAuth (Dias 3-4)

### Arquitetura de Autenticacao

O sistema implementa:

- **Credentials provider** (NextAuth v5) com suporte a PBKDF2 e SHA-256 legado
- **Rate limiting por IP:** 5 falhas em 5 min → bloqueio de 15 min (persistido no MongoDB, colecao `login_attempts`)
- **Rate limiting por username:** 10 falhas em 10 min → bloqueio de 30 min
- **Single-session enforcement:** login invalida sessao anterior via `sessionToken` em memória
- **JWT de 8 horas** com campos: `id`, `username`, `role`, `projeto_id`, `projeto_nome`, `sessionToken`
- **Troca de senha obrigatoria:** `must_change_password=true` redireciona para `/perfil/senha`

### Hierarquia de Roles

| Role | Rank | Permissoes |
|---|---|---|
| `superadmin` | 4 | Acesso total a todos os projetos, gerencia projetos e usuarios |
| `admin` | 3 | Gerencia o proprio projeto (CTOs, CDOs, rotas, postes, OLTs, usuarios) |
| `tecnico` | 2 | Leitura + escrita de movimentacoes e diagramas |
| `user` | 1 | Somente leitura |

### Verificar Login com Usuarios Legados

Os usuarios migrados do D1 podem ter senha em dois formatos:

```
1. PBKDF2:     "pbkdf2$<iterations>$<salt_b64>$<hash_b64>"
2. SHA-256:    64 caracteres hexadecimais (sem salt — formato legado inseguro)
```

O modulo `src/lib/password.js` detecta o formato automaticamente e verifica com `timingSafeEqual`.
Apos o primeiro login bem-sucedido, considere reencriptografar a senha para PBKDF2 moderno.

### Testes de Autenticacao

```bash
# Teste manual: login com usuario legado
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"senha123","redirect":false}'

# Verificar rate limiting: 6 tentativas invalidas devem bloquear o IP
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/auth/callback/credentials \
    -d '{"username":"admin","password":"errada"}'
done
```

### Protecao de Rotas (Middleware)

| Rota | Acesso | Comportamento |
|---|---|---|
| `/login`, `/cadastro` | Publico | Redireciona para `/` se ja autenticado |
| `/api/auth/*` | Publico | Sempre permitido (NextAuth) |
| `/api/registro*` | Publico | Auto-cadastro de empresas |
| `/superadmin/*` | `superadmin` | Redireciona para `/` se role insuficiente |
| `/admin/*` | `admin` ou superior | Redireciona para `/` se role insuficiente |
| `/` e demais | Qualquer autenticado | Redireciona para `/login` se nao autenticado |

---

## Fase 4 — Paginas e Componentes (Dias 4-6)

### Estrutura de Paginas

```
src/app/
├── layout.js                    # Root layout (fonte, meta, providers)
├── globals.css                  # Tailwind base
├── (auth)/
│   ├── layout.js                # Layout sem sidebar (tela cheia centrada)
│   ├── login/page.js            # Formulario de login
│   └── cadastro/page.js         # Auto-cadastro publico
├── (dashboard)/
│   ├── layout.js                # Layout com sidebar
│   └── page.js                  # Mapa principal (SSR: auth(); CSR: MapaFTTH)
├── (admin)/
│   ├── layout.js                # Layout admin + verificacao de role
│   ├── ctos/page.js             # Painel CTOs (listar, criar, editar, deletar)
│   └── usuarios/page.js         # Gerenciar usuarios do projeto
└── (superadmin)/
    ├── layout.js                # Layout superadmin
    ├── projetos/page.js         # Gerenciar todos os projetos
    └── registros/page.js        # Aprovar/rejeitar auto-cadastros
```

### Mapa MapLibre (Client Component)

O componente `MapaFTTH` e carregado com `dynamic import` e `ssr: false` para evitar erros de SSR com a API do browser:

```javascript
// src/app/(dashboard)/page.js
const MapaFTTH = dynamic(() => import('@/components/map/MapaFTTH'), {
  ssr: false,
  loading: () => <div>Carregando mapa...</div>,
})
```

**Camadas do mapa disponíveis:**

| Camada | Toggle | Descricao |
|---|---|---|
| CTOs | `ctos` | Marcadores de Caixas de Terminacao Optica |
| CE/CDOs | `caixas` | Marcadores de Caixas de Emenda/Distribuicao |
| Rotas | `rotas` | Traçados de fibra (LineString GeoJSON) |
| Postes | `postes` | Marcadores de postes de infraestrutura |
| Satelite | `satellite` | Camada de satelite (toggle separado) |

### Checklist de Testes de UI

- [ ] Mapa renderiza sem erros de console em localhost
- [ ] Camadas CTOs, CDOs, Rotas e Postes exibem dados do MongoDB
- [ ] Bottom Sheet abre ao clicar em elemento do mapa
- [ ] Toggles de camada ligam/desligam corretamente
- [ ] Modo satelite alterna corretamente
- [ ] GPS tracking: botao Liga/Desliga; Follow Mode centraliza mapa
- [ ] Banner "Offline" aparece ao desconectar rede; some ao reconectar
- [ ] Formulario de CTO: criar, editar e deletar refletem no mapa apos revalidacao
- [ ] Formulario CE/CDO: idem
- [ ] Formulario de Rota: idem
- [ ] Formulario de Poste: idem
- [ ] Formulario de OLT: criar e editar
- [ ] Registro de Movimentacao: tecnico consegue registrar; user nao consegue
- [ ] Painel de Usuarios (admin): listar, criar, desativar
- [ ] Painel de Projetos (superadmin): listar, ativar/desativar
- [ ] Painel de Registros (superadmin): aprovar/rejeitar

---

## Fase 5 — Features Avancadas (Dias 7-10)

### Editor de Diagrama (CTO e CE/CDO)

O diagrama e armazenado como subdocumento MongoDB:

```javascript
// Estrutura DiagramaCTO
{
  entrada: { ce_id: "CDO-01", porta_cdo: 3 },
  portas: {
    "1": { cliente: "Joao Silva", obs: "Instalado 2025-01-10", ativo: true },
    "2": { cliente: null, obs: null, ativo: true },
    // ...
  }
}
```

**Server Action para salvar diagrama:**

```javascript
// Requer role: admin, tecnico ou superior
await saveDiagramaCTO({ cto_id, projeto_id, diagrama })
```

O editor visual (canvas) e o componente de maior complexidade. Migrar por ultimo, apos todos os outros CRUDs estarem funcionando.

### Offline Queue

O hook `useOfflineQueue` persiste operacoes no `localStorage` sob a chave `ftth_queue`.
Quando o evento `online` dispara, o hook chama o `syncHandler` para cada item enfileirado.

```javascript
const { isOnline, queueSize, enqueue, flush } = useOfflineQueue(async (op) => {
  // Re-executar a operacao: chamar Server Action novamente
  await upsertCTO(op.data)
})

// Ao tentar salvar offline:
if (!isOnline) {
  enqueue({ type: 'upsertCTO', data: formData })
  // Notificar usuario que a operacao sera sincronizada
}
```

### GPS e Reverse Geocoding

O hook `useGPS` usa a `Geolocation API` do browser. O Worker legado proxeava o reverse geocoding para Nominatim (`/api/reverse_geocode`). No Next.js, criar uma Route Handler em `src/app/api/reverse_geocode/route.js` com fetch para `https://nominatim.openstreetmap.org/reverse`.

### Busca Global

O Worker legado implementava busca com scoring sobre CTOs, CDOs, Rotas e Postes.
No Next.js, implementar como Server Action que executa queries MongoDB com `$regex` ou Atlas Search.

---

## Fase 6 — Deploy e Cutover (Dias 11-14)

### Opcoes de Deploy

| Plataforma | Observacoes |
|---|---|
| Vercel | Recomendado; suporte nativo a Next.js App Router; serverless functions |
| Railway | Self-hosted; bom para MongoDB co-locado |
| VPS (Hetzner, DigitalOcean) | `npm run build && npm start` com PM2 ou Docker |
| Coolify | Self-hosted PaaS; deploy via Docker Compose |

### Deploy em Vercel

```bash
# Instalar CLI
npm i -g vercel

# Deploy
vercel deploy --prod

# Configurar variaveis de ambiente no dashboard Vercel:
# MONGODB_URI, AUTH_SECRET, NEXTAUTH_URL
```

### Verificacoes Pre-Deploy

```bash
# Build de producao sem erros
npm run build

# Verificar bundle size de client components (especialmente MapLibre ~1.5MB)
# Acceptable: MapLibre e carregado com dynamic import (code splitting)

# Verificar que .env.local NAO esta no git
git status --short | grep env
```

### Estrategia de Cutover Paralelo

1. Deploy do Next.js em subdominio de staging: `staging.fiberops.com`
2. Manter Worker Cloudflare ativo na URL de producao
3. Executar ETL de dados (Fase 2) com Worker ainda ativo
4. Testar autenticacao e fluxos completos em staging com usuarios reais
5. Freeze de escrita no Worker (colocar em modo read-only ou desativar writes)
6. ETL delta: migrar registros novos criados apos o ETL inicial
7. DNS cutover: `fiberops.com` apontar para Next.js
8. Monitorar logs de erro nas primeiras 24h
9. Manter Worker como fallback por mais 7 dias antes de desativar

### Monitoramento

```bash
# Verificar conexao MongoDB em producao (chamada de saude)
curl https://fiberops.com/api/health

# Verificar logs no Vercel
vercel logs --prod

# MongoDB Atlas: monitorar slow queries e conexoes
# Dashboard > Monitoring > Performance Advisor
```

---

## Riscos e Mitigacoes

| # | Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|---|
| 1 | Perda de dados no ETL (campos em maiusculas nao mapeados) | Alta | Alto | Validar contagem de registros pre/pos ETL; manter backup do D1 |
| 2 | Senhas legadas SHA-256 sem salt nao verificam | Media | Alto | Testar com usuarios reais antes do cutover; suporte a ambos os formatos esta implementado |
| 3 | Coordenadas GeoJSON invertidas (lat/lng vs lng/lat) | Alta | Medio | `Rota.latLngToGeoJSON()` esta disponível; validar visualmente no mapa apos ETL |
| 4 | MapLibre SSR error em Vercel Edge | Baixa | Alto | `dynamic import ssr:false` ja implementado; nao mover para Edge runtime |
| 5 | MongoDB Atlas IP whitelist bloqueando Vercel (IPs dinamicos) | Alta | Alto | Usar `0.0.0.0/0` em Vercel ou configurar VPC Peering no Atlas |
| 6 | Single-session enforcement quebra em deploy multi-instancia | Alta | Medio | `activeSessionMap` e em memoria por instancia; aceitar comportamento em producao single-instance ou migrar para Redis |
| 7 | Rate limiting do Worker legado nao replicado exatamente | Media | Baixo | Limites implementados em `src/lib/auth.js` e `src/middleware.js`; diferença de janelas e aceitavel |
| 8 | Diagrama CTO/CDO (JSON livre) corrompido no D1 | Media | Medio | Parsear com try/catch; gravar null se invalido; logar para revisao manual |
| 9 | Falta de indice 2dsphere para rotas | Alta | Medio | Criar indice antes de importar rotas: `db.rotas.createIndex({"geojson":"2dsphere"})` |
| 10 | TTL index de log_eventos nao criado | Alta | Baixo | O modelo registra o indice; confirmar criacao com `db.log_eventos.getIndexes()` |
| 11 | `NEXTAUTH_URL` incorreto em producao causa redirect loop | Media | Alto | Validar `NEXTAUTH_URL` antes do cutover; testar login em staging |
| 12 | Cold start do MongoDB em serverless causa timeout | Media | Medio | `maxPoolSize:10` configurado; warm-up via route periodica se necessario |
| 13 | `must_change_password=true` trava usuario sem rota `/perfil/senha` | Media | Alto | Implementar pagina `/perfil/senha` antes do cutover |
| 14 | Campos `CTO_ID` maiusculas na tabela D1 incompativeis com schema | Alta | Alto | ETL normaliza para lowercase conforme mapeamento na Fase 2 |
| 15 | Multi-tenancy: `projeto_id` ausente em registros legados | Media | Alto | Default `"default"` no schema; verificar e corrigir antes do ETL |
| 16 | `next-auth@beta` (v5) pode ter breaking changes | Baixa | Alto | Fixar versao `^5.0.0-beta.29`; nao fazer upgrade automatico ate stable |
| 17 | Mongoose re-compilacao de modelos em hot reload (Next.js dev) | Alta | Baixo | Padrao `models.X || model("X", XSchema)` ja implementado em todos os modelos |
| 18 | GeoJSON de rotas com apenas 1 ponto falha validacao `LineString` | Baixa | Medio | Validador no schema exige `length >= 2`; filtrar rotas invalidas no ETL |
| 19 | `bcryptjs` instalado mas sistema usa `crypto` nativo (PBKDF2) | N/A | Baixo | `bcryptjs` nao e usado nos fluxos atuais; remover ou documentar como alternativa futura |
| 20 | Service worker legado (`sw.js`) em cache no browser dos usuarios | Media | Medio | Versionar ou invalidar service worker legado; instruir usuarios a limpar cache |

---

## Estrutura Final de Arquivos

```
/home/brodrigues/Projects/ftth/
├── package.json
├── .env.local                        # NAO commitar
├── MIGRATION_PLAN.md                 # Este arquivo
│
├── projeto-atual/                    # Sistema legado (referencia)
│   ├── backend/
│   │   ├── worker.js                 # Cloudflare Worker (2785 linhas)
│   │   ├── wrangler.toml
│   │   └── migrations/
│   │       └── 0001_init.sql
│   └── frontend/
│       ├── index.html
│       ├── cadastro.html
│       ├── manifest.json
│       └── service-worker.js
│
└── src/
    ├── middleware.js                  # Rate limiting + protecao de rotas + RBAC
    │
    ├── lib/
    │   ├── auth.js                   # NextAuth v5 + PBKDF2 + rate limiting + single-session
    │   ├── db.js                     # Singleton de conexao MongoDB (Mongoose)
    │   ├── password.js               # verifyPassword + hashPassword (PBKDF2 / SHA-256)
    │   └── utils.js                  # Utilitarios compartilhados
    │
    ├── models/
    │   ├── index.js                  # Re-exports de todos os modelos
    │   ├── User.js                   # users — RBAC, multi-tenancy
    │   ├── Projeto.js                # projetos — tenant raiz
    │   ├── CTO.js                    # ctos — com DiagramaCTO embutido
    │   ├── CaixaEmendaCDO.js         # caixas_emenda_cdo — com DiagramaCDO embutido
    │   ├── Rota.js                   # rotas — GeoJSON LineString + 2dsphere
    │   ├── Poste.js                  # postes
    │   ├── OLT.js                    # olts — topo da hierarquia GPON
    │   ├── Movimentacao.js           # movimentacoes — instalacoes/desinstalacoes
    │   ├── RegistroPendente.js       # registros_pendentes — auto-cadastro
    │   ├── LogEvento.js              # log_eventos — auditoria com TTL
    │   ├── LoginAttempt.js           # login_attempts — rate limiting persistido
    │   └── Topologia.js              # topologias — vinculos OLT→CDO→CTO
    │
    ├── actions/                      # Server Actions ('use server')
    │   ├── auth.js                   # loginAction, logoutAction, getMeAction
    │   ├── ctos.js                   # getCTOs, upsertCTO, deleteCTO, getDiagramaCTO, saveDiagramaCTO
    │   ├── caixas.js                 # getCaixas, upsertCaixa, deleteCaixa
    │   ├── rotas.js                  # getRotas, upsertRota, deleteRota
    │   ├── postes.js                 # getPostes, upsertPoste, deletePoste
    │   ├── olts.js                   # getOLTs, upsertOLT, deleteOLT
    │   ├── movimentacoes.js          # getMovimentacoes, addMovimentacao
    │   ├── usuarios.js               # getUsuarios, upsertUsuario, toggleUsuario
    │   ├── projetos.js               # getProjetos, upsertProjeto, toggleProjeto
    │   ├── registros.js              # getRegistros, aprovarRegistro, rejeitarRegistro
    │   └── imports.js                # importar dados em bulk (CTOs, CDOs, Rotas, Postes)
    │
    ├── hooks/                        # Hooks de Client Components
    │   ├── useMap.js                 # Inicializacao do mapa MapLibre
    │   ├── useMapLayers.js           # Gerenciar camadas (CTOs, CDOs, Rotas, Postes)
    │   ├── useMapEvents.js           # Eventos de click e hover no mapa
    │   ├── useGPS.js                 # Geolocation API + follow mode
    │   └── useOfflineQueue.js        # Fila offline persistida no localStorage
    │
    ├── components/
    │   ├── map/
    │   │   ├── MapaFTTH.js           # Componente principal do mapa (CSR)
    │   │   ├── BottomSheet.js        # Painel deslizante de detalhes do elemento
    │   │   └── LayerToggles.js       # Controles de visibilidade de camadas
    │   ├── admin/
    │   │   ├── CTOsClient.js         # Tabela + dialogo de CTOs
    │   │   ├── CTOForm.js            # Formulario CTO (criar/editar)
    │   │   ├── CaixaForm.js          # Formulario CE/CDO
    │   │   ├── RotaForm.js           # Formulario de Rota
    │   │   ├── PosteForm.js          # Formulario de Poste
    │   │   ├── OLTForm.js            # Formulario de OLT
    │   │   ├── MovimentacaoForm.js   # Formulario de Movimentacao
    │   │   └── UsuariosClient.js     # Gerenciar usuarios do projeto
    │   ├── superadmin/
    │   │   ├── ProjetosClient.js     # Gerenciar todos os projetos
    │   │   ├── RegistrosClient.js    # Aprovar/rejeitar registros
    │   │   └── SuperadminSidebarLayout.js
    │   ├── layout/
    │   │   └── Sidebar.js            # Navegacao lateral
    │   ├── shared/
    │   │   ├── OcupacaoBar.js        # Barra de progresso de ocupacao de portas
    │   │   ├── RoleBadge.js          # Badge de role do usuario
    │   │   └── SidebarLayout.js      # Layout com sidebar para dashboard/admin
    │   └── ui/                       # Componentes base (base-ui/react)
    │       ├── button.jsx
    │       ├── card.jsx
    │       ├── dialog.jsx
    │       ├── input.jsx
    │       ├── label.jsx
    │       ├── select.jsx
    │       ├── table.jsx
    │       ├── tabs.jsx
    │       ├── badge.jsx
    │       ├── switch.jsx
    │       ├── textarea.jsx
    │       ├── tooltip.jsx
    │       ├── scroll-area.jsx
    │       ├── separator.jsx
    │       └── index.js              # Re-exports de todos os componentes UI
    │
    └── app/
        ├── layout.js                 # Root layout
        ├── globals.css               # Estilos globais Tailwind
        ├── favicon.ico
        ├── (auth)/
        │   ├── layout.js
        │   ├── login/page.js
        │   └── cadastro/page.js
        ├── (dashboard)/
        │   ├── layout.js
        │   └── page.js               # Mapa principal
        ├── (admin)/
        │   ├── layout.js
        │   ├── ctos/page.js
        │   └── usuarios/page.js
        ├── (superadmin)/
        │   ├── layout.js
        │   ├── projetos/page.js
        │   └── registros/page.js
        └── api/
            └── auth/
                └── [...nextauth]/
                    └── route.js      # Handler NextAuth v5
```

---

## Referencias

- [NextAuth v5 (Auth.js) — Documentacao oficial](https://authjs.dev)
- [Mongoose — Documentacao](https://mongoosejs.com/docs/)
- [MapLibre GL JS — Documentacao](https://maplibre.org/maplibre-gl-js/docs/)
- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [MongoDB Atlas — Quickstart](https://www.mongodb.com/docs/atlas/getting-started/)
- [Wrangler D1 Export](https://developers.cloudflare.com/workers/wrangler/commands/#d1-export)
