const http = require("http");
const os = require("os");
const si = require("systeminformation");

// Armazenamento
let players = {}; // { playerId: { name, x, y, z } }
let chat = [];

// Controle de rate limiting simples: { ip: [timestamps] }
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 10;      // máximo de requisições
const RATE_LIMIT_WINDOW = 10000; // em milissegundos (10s)

// Helpers
function sanitizeString(str, maxLength = 16) {
    if (typeof str !== "string") return null;
    return str.trim().substring(0, maxLength).replace(/[<>'"&]/g, ""); // evita XSS básico
}

function isValidNumber(val) {
    return typeof val === "number" && isFinite(val);
}

function getClientIP(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
}

function isRateLimited(ip) {
    const now = Date.now();
    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, [now]);
        return false;
    }

    const timestamps = rateLimitStore.get(ip).filter(t => now - t < RATE_LIMIT_WINDOW);
    if (timestamps.length >= RATE_LIMIT_MAX) {
        return true; // bloqueado
    }

    timestamps.push(now);
    rateLimitStore.set(ip, timestamps);
    return false;
}

// Métricas
async function getSystemStatus() {
    const ram = await si.mem();
    const cpu = await si.currentLoad();

    return {        ram: `${Math.round((ram.total - ram.available) / 1024 / 1024)}MB / ${Math.round(ram.total / 1024 / 1024)}MB`,
        cpu: `${cpu.currentLoad.toFixed(2)}%`
    };
}

// Servidor
const server = http.createServer(async (req, res) => {
    const ip = getClientIP(req);

    // Rate limiting
    if (isRateLimited(ip)) {
        res.statusCode = 429;
        return res.end("Muitas requisições. Tente novamente mais tarde.");
    }

    // CORS – ajuste conforme seu frontend
    const allowedOrigin = "*"; // ⚠️ Troque por "https://seudominio.com" em produção!
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Rotas OPTIONS (pré-voo CORS)
    if (req.method === "OPTIONS") {
        return res.end();
    }

    // POST
    if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const data = JSON.parse(body);

                // Rota /player
                if (req.url === "/player") {
                    const name = sanitizeString(data.name, 16);
                    const x = data.x; const y = data.y; const z = data.z;

                    if (!name || !isValidNumber(x) || !isValidNumber(y) || !isValidNumber(z)) {
                        res.statusCode = 400;
                        return res.end("Dados inválidos: nome (string ≤16), x/y/z (números) obrigatórios.");
                    }

                    // Gera ou reutiliza ID baseado no nome (ou use UUID se quiser sessões reais)
                    const playerId = Buffer.from(name).toString("base64").substring(0, 12);
                    players[playerId] = { name, x, y, z };
                    return res.end("player atualizado");
                }

                // Rota /chat
                else if (req.url === "/chat") {
                    const name = sanitizeString(data.name, 16);
                    const msg = sanitizeString(data.msg, 100); // limite de 100 chars

                    if (!name || !msg) {
                        res.statusCode = 400;
                        return res.end("Nome e mensagem são obrigatórios.");
                    }

                    chat.push({ name, msg, time: Date.now() });
                    if (chat.length > 20) chat.shift();

                    return res.end("mensagem enviada");
                }

                else {
                    res.statusCode = 404;
                    return res.end("rota inválida");
                }
            } catch (e) {
                console.error("Erro ao processar POST:", e.message);
                res.statusCode = 400;
                return res.end("erro json ou dados inválidos");
            }
        });

        req.on("error", () => {
            res.statusCode = 400;
            res.end("erro na requisição");
        });
    }

    // GET
    else if (req.method === "GET") {
        if (req.url === "/players") {
            return res.end(JSON.stringify(players));
        }
        else if (req.url === "/chat") {
            return res.end(JSON.stringify(chat));
        }
        else if (req.url === "/status") {
            const status = await getSystemStatus();
            return res.end(JSON.stringify(status));
        }
        else {            return res.end("servidor online");
        }
    }

    // Métodos não suportados
    else {
        res.statusCode = 405;
        return res.end("método não permitido");
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});