#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

// VAMO CRIAR O SERVIDOR MCP BRABOOOO!!
const server = new McpServer({
  name: "DevOps Assistant",
  version: "1.0.0",
  description: "Assistente DevOps pessoal do Mateus - integra Docker, Git e terminal!"
});

// 🔧 FERRAMENTA: Pegar histórico do terminal
server.tool(
  "get_terminal_history",
  {
    limit: z.number().default(50).describe("Número de comandos para retornar")
  },
  async ({ limit }) => {
    try {
      const historyPath = join(homedir(), ".zsh_history");
      const historyContent = await readFile(historyPath, "utf-8");

      // Parsear o histórico do Zsh (formato especial)
      const lines = historyContent.split("\n");
      const commands = lines
        .filter(line => line && !line.startsWith(":"))
        .slice(-limit)
        .reverse();

      return {
        content: [{
          type: "text",
          text: `🔥 Últimos ${commands.length} comandos do terminal:\n\n${commands.join("\n")}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Erro ao ler histórico: ${error instanceof Error ? error.message : String(error)}\n\nDica: Verifica se o arquivo ~/.zsh_history existe!`
        }]
      };
    }
  }
);

// 🐳 FERRAMENTA: Listar containers Docker
server.tool(
  "list_docker_containers",
  {
    all: z.boolean().default(true).describe("Mostrar todos containers (incluindo parados)")
  },
  async ({ all }) => {
    try {
      const flag = all ? "-a" : "";
      const { stdout } = await execAsync(
        `docker ps ${flag} --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"`
      );

      return {
        content: [{
          type: "text",
          text: `🐳 Containers Docker:\n\n${stdout}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Erro ao listar containers: ${error instanceof Error ? error.message : String(error)}\n\nVerifica se o Docker tá rodando: systemctl status docker`
        }]
      };
    }
  }
);

// 🐳 FERRAMENTA: Pegar logs de container
server.tool(
  "get_docker_logs",
  {
    container: z.string().describe("Nome ou ID do container"),
    lines: z.number().default(100).describe("Número de linhas do log")
  },
  async ({ container, lines }) => {
    try {
      const { stdout } = await execAsync(
        `docker logs --tail ${lines} ${container} 2>&1`
      );

      return {
        content: [{
          type: "text",
          text: `📋 Logs do container "${container}" (últimas ${lines} linhas):\n\n${stdout}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Erro ao pegar logs: ${error instanceof Error ? error.message : String(error)}\n\nVerifica se o container existe: docker ps -a`
        }]
      };
    }
  }
);

// 📊 RESOURCE: Status do Docker
server.resource(
  "docker_status",
  "docker://status",
  async (uri) => {
    try {
      const { stdout: info } = await execAsync("docker info --format json");
      const dockerInfo = JSON.parse(info);

      const { stdout: containers } = await execAsync("docker ps -a --format json");
      const containerList = containers.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));

      const running = containerList.filter(c => c.State === "running").length;
      const total = containerList.length;

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: `🐳 STATUS DO DOCKER:
          
Servidor: ${dockerInfo.ServerVersion}
Containers: ${running} rodando / ${total} total
Imagens: ${dockerInfo.Images}
Memória: ${Math.round(dockerInfo.MemTotal / 1024 / 1024 / 1024)}GB
Driver: ${dockerInfo.Driver}

Containers Rodando:
${containerList
              .filter(c => c.State === "running")
              .map(c => `- ${c.Names}: ${c.Image}`)
              .join("\n") || "Nenhum container rodando"}

Use "list_docker_containers" pra ver todos!`
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: `❌ Erro ao pegar status do Docker: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

// 📊 RESOURCE: Info do sistema
server.resource(
  "system_info",
  "system://info",
  async (uri) => {
    try {
      const { stdout: hostname } = await execAsync("hostname");
      const { stdout: uptime } = await execAsync("uptime -p");
      const { stdout: memory } = await execAsync("free -h | grep Mem");
      const { stdout: disk } = await execAsync("df -h / | tail -1");

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: `🖥️ INFORMAÇÕES DO SISTEMA:
          
Hostname: ${hostname.trim()}
Uptime: ${uptime.trim()}
Memória: ${memory.trim()}
Disco: ${disk.trim()}

Sistema: Ubuntu 24.04 LTS
Ambiente: DevOps Workstation
Usuário: Mateus (YOUX GROUP)`
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: `❌ Erro ao pegar info do sistema: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

// 📝 FERRAMENTA: Executar comando do terminal
server.tool(
  "run_command",
  {
    command: z.string().describe("Comando para executar"),
    cwd: z.string().optional().describe("Diretório de trabalho")
  },
  async ({ command, cwd }) => {
    try {
      // SEGURANÇA: Lista de comandos permitidos
      const allowedCommands = [
        "ls", "pwd", "echo", "cat", "grep", "find", "df", "du",
        "docker", "docker-compose", "git", "npm", "node"
      ];

      const firstWord = command.split(" ")[0];
      if (!allowedCommands.includes(firstWord)) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Comando não permitido por segurança: ${firstWord}\n\nComandos permitidos: ${allowedCommands.join(", ")}`
          }]
        };
      }

      const { stdout, stderr } = await execAsync(command, { cwd });

      return {
        content: [{
          type: "text",
          text: `✅ Comando executado: ${command}\n\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Erro ao executar comando: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

// 🎯 PROMPT: Analisar deploy
server.prompt(
  "analyze_deployment",
  {
    appName: z.string().describe("Nome da aplicação"),
    issue: z.string().optional().describe("Problema específico")
  },
  ({ appName, issue }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Analise o deploy da aplicação "${appName}"${issue ? ` com o seguinte problema: ${issue}` : ""}.

Por favor:
1. Liste os containers relacionados
2. Verifique os logs recentes
3. Cheque o status dos serviços
4. Sugira possíveis soluções
5. Documente o que foi encontrado

Contexto: Sou estagiário DevOps e preciso de ajuda para debugar e documentar.`
      }
    }]
  })
);

// 🚀 INICIAR O SERVIDOR
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP DevOps Assistant rodando! Conecte no Claude Desktop!");
}

main().catch(console.error);