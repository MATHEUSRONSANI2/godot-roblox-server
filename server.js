const http = require("http")
const os = require("os")

let players = {}
let chat = []

// 🔧 Funções de status
function getRAM() {
    const total = os.totalmem() / 1024 / 1024
    const free = os.freemem() / 1024 / 1024
    const used = total - free

    return `${used.toFixed(0)}MB / ${total.toFixed(0)}MB`
}

function getCPU() {
    return os.loadavg()[0].toFixed(2) + "%"
}

const server = http.createServer((req, res) => {

    // Permitir conexão externa
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    // 📥 Receber dados
    if (req.method === "POST") {
        let body = ""

        req.on("data", chunk => {
            body += chunk.toString()
        })

        req.on("end", () => {
            try {
                const data = JSON.parse(body)

                // 📍 POSIÇÃO
                if (req.url === "/player") {
                    players[data.name] = {
                        x: data.x,
                        y: data.y,
                        z: data.z
                    }
                    res.end("player atualizado")
                }

                // 💬 CHAT
                else if (req.url === "/chat") {
                    chat.push({
                        name: data.name,
                        msg: data.msg
                    })

                    // limita chat
                    if (chat.length > 20) {
                        chat.shift()
                    }

                    res.end("mensagem enviada")
                }

                else {
                    res.end("rota inválida")
                }

            } catch {
                res.end("erro json")
            }
        })
    }

    // 📤 Enviar dados
    else if (req.method === "GET") {

        // Jogadores
        if (req.url === "/players") {
            res.end(JSON.stringify(players))
        }

        // Chat
        else if (req.url === "/chat") {
            res.end(JSON.stringify(chat))
        }

        // Status
        else if (req.url === "/status") {
            res.end(JSON.stringify({
                ram: getRAM(),
                cpu: getCPU()
            }))
        }

        else {
            res.end("servidor online")
        }
    }
})

server.listen(3000, () => {
    console.log("🔥 Servidor rodando na porta 3000")
})