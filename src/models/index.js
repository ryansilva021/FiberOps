/**
 * src/models/index.js
 * Ponto central de exportação dos modelos Mongoose para o FiberOps (FTTH).
 *
 * Uso em API routes do Next.js:
 *
 *   import { connectDB, CTO, OLT, Movimentacao } from "@/models";
 *
 *   export async function GET(request) {
 *     await connectDB();
 *     const ctos = await CTO.find({ projeto_id: "minha_empresa" }).lean();
 *     return Response.json({ ctos });
 *   }
 *
 * Variável de ambiente necessária:
 *   MONGODB_URI=mongodb+srv://user:pass@cluster/ftthdb?retryWrites=true&w=majority
 */

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Conexão Mongoose com singleton (evita múltiplas conexões em hot reload)
// ---------------------------------------------------------------------------

/** @type {{ conn: import("mongoose").Connection | null; promise: Promise | null }} */
const cached = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

/**
 * Garante uma única conexão ativa com o MongoDB.
 * Deve ser chamado no início de cada API route.
 *
 * @returns {Promise<import("mongoose").Connection>}
 */
export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI não definida. Adicione ao arquivo .env.local:\n" +
          "MONGODB_URI=mongodb+srv://user:pass@cluster/ftthdb"
      );
    }

    cached.promise = mongoose
      .connect(uri, {
        // Configurações recomendadas para Next.js (serverless/edge-aware)
        bufferCommands: false,
        maxPoolSize:    10,
      })
      .then((m) => m.connection);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

// ---------------------------------------------------------------------------
// Re-export de todos os modelos
// ---------------------------------------------------------------------------

export { Projeto }         from "./Projeto.js";
export { User }            from "./User.js";
export { CTO }             from "./CTO.js";
export { CaixaEmendaCDO }  from "./CaixaEmendaCDO.js";
export { Rota }            from "./Rota.js";
export { Poste }           from "./Poste.js";
export { OLT }             from "./OLT.js";
export { Topologia }       from "./Topologia.js";
export { Movimentacao }    from "./Movimentacao.js";
export { RegistroPendente } from "./RegistroPendente.js";
export { LogEvento }       from "./LogEvento.js";
export { LoginAttempt }    from "./LoginAttempt.js";
