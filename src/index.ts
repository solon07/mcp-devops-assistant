#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { readdir, readFile, writeFile } from "fs/promises";
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

// 🔍 FERRAMENTA: Status do Git
server.tool("git_status", {
  path: z.string().optional().describe("Caminho do repositório (padrão: diretório atual)")
}, async ({ path }) => {
  try {
    const cwd = path || process.cwd();
    const { stdout } = await execAsync("git status --porcelain", { cwd });
    
    if (!stdout.trim()) {
      return {
        content: [{
          type: "text",
          text: "✅ Repositório limpo! Nenhuma mudança pendente."
        }]
      };
    }
    
    // Formata o output bonitinho
    const lines = stdout.trim().split("\n");
    const formatted = lines.map(line => {
      const [status, ...file] = line.split(" ");
      const fileName = file.join(" ");
      const statusMap: Record<string, string> = {
        "M": "📝 Modificado",
        "A": "➕ Adicionado", 
        "D": "❌ Deletado",
        "??": "❓ Não rastreado",
        "MM": "📝 Modificado (staged + unstaged)"
      };
      return `${statusMap[status] || status}: ${fileName}`;
    }).join("\n");
    
    return {
      content: [{
        type: "text",
        text: `📊 Status do Git:\n\n${formatted}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro: ${error instanceof Error ? error.message : String(error)}\n\nCertifica que tá dentro de um repo Git!`
      }]
    };
  }
});

// 📜 FERRAMENTA: Histórico de commits
server.tool("git_log", {
  limit: z.number().default(10).describe("Número de commits para mostrar"),
  path: z.string().optional().describe("Caminho do repositório")
}, async ({ limit, path }) => {
  try {
    const cwd = path || process.cwd();
    const { stdout } = await execAsync(
      `git log --oneline --graph --decorate --all -n ${limit}`,
      { cwd }
    );
    
    return {
      content: [{
        type: "text",
        text: `📜 Últimos ${limit} commits:\n\n${stdout}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao pegar log: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🌿 FERRAMENTA: Listar branches
server.tool("git_branches", {
  all: z.boolean().default(false).describe("Mostrar branches remotas também")
}, async ({ all }) => {
  try {
    const flag = all ? "-a" : "";
    const { stdout } = await execAsync(`git branch ${flag}`);
    
    return {
      content: [{
        type: "text",
        text: `🌿 Branches:\n\n${stdout}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 💻 FERRAMENTA: Abrir projeto no VS Code
server.tool("vscode_open", {
  path: z.string().describe("Caminho do projeto para abrir"),
  newWindow: z.boolean().default(false).describe("Abrir em nova janela")
}, async ({ path, newWindow }) => {
  try {
    const flag = newWindow ? "-n" : "-r";
    await execAsync(`code ${flag} "${path}"`);
    
    return {
      content: [{
        type: "text",
        text: `✅ VS Code aberto ${newWindow ? "em nova janela" : ""} com: ${path}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao abrir VS Code: ${error instanceof Error ? error.message : String(error)}\n\nVerifica se o VS Code tá no PATH!`
      }]
    };
  }
});

// 📋 FERRAMENTA: Listar workspaces do VS Code
server.tool("vscode_workspaces", {}, async () => {
  try {
    const workspacesPath = join(homedir(), ".config/Code/User/workspaceStorage");
    const files = await readdir(workspacesPath);
    
    // Pega info de cada workspace
    const workspaces = [];
    for (const file of files) {
      const workspaceFile = join(workspacesPath, file, "workspace.json");
      try {
        const content = await readFile(workspaceFile, "utf-8");
        const data = JSON.parse(content);
        if (data.folder) {
          workspaces.push(data.folder.replace("file://", ""));
        }
      } catch {
        // Ignora workspaces sem arquivo válido
      }
    }
    
    return {
      content: [{
        type: "text",
        text: `📋 Workspaces do VS Code:\n\n${workspaces.map(w => `• ${w}`).join("\n")}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao listar workspaces: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 📝 FERRAMENTA: Gerar documentação automática
server.tool("generate_docs", {
  projectPath: z.string().describe("Caminho do projeto"),
  type: z.enum(["docker", "general", "api"]).describe("Tipo de documentação")
}, async ({ projectPath, type }) => {
  try {
    let documentation = `# 📚 Documentação do Projeto\n\n`;
    documentation += `**Gerado em:** ${new Date().toLocaleString("pt-BR")}\n\n`;
    
    // Analisa estrutura do projeto
    const files = await readdir(projectPath);
    
    if (type === "docker" || files.includes("docker-compose.yml")) {
      // Documenta Docker
      documentation += `## 🐳 Docker\n\n`;
      
      // Lê docker-compose.yml
      if (files.includes("docker-compose.yml")) {
        const dockerCompose = await readFile(
          join(projectPath, "docker-compose.yml"), 
          "utf-8"
        );
        
        // Extrai serviços (parsing básico)
        const services = dockerCompose.match(/^\s{2}(\w+):/gm);
        if (services) {
          documentation += `### Serviços:\n`;
          services.forEach(service => {
            const serviceName = service.trim().replace(":", "");
            documentation += `- **${serviceName}**\n`;
          });
          documentation += "\n";
        }
        
        // Extrai portas
        const ports = dockerCompose.match(/ports:\s*\n\s*-\s*"?(\d+:\d+)"?/g);
        if (ports) {
          documentation += `### Portas expostas:\n`;
          ports.forEach(port => {
            const portNum = port.match(/(\d+:\d+)/)?.[1];
            documentation += `- ${portNum}\n`;
          });
          documentation += "\n";
        }
      }
      
      // Lê Dockerfile se existir
      if (files.includes("Dockerfile")) {
        documentation += `### Dockerfile presente ✅\n\n`;
      }
    }
    
    // Documentação geral
    documentation += `## 📁 Estrutura do Projeto\n\n`;
    documentation += "```\n";
    const { stdout: tree } = await execAsync(
      `find "${projectPath}" -maxdepth 3 -name "node_modules" -prune -o -name ".git" -prune -o -type f -print | head -20`,
      { cwd: projectPath }
    );
    documentation += tree;
    documentation += "\n```\n\n";
    
    // Variáveis de ambiente
    if (files.includes(".env.example") || files.includes(".env")) {
      documentation += `## 🔐 Variáveis de Ambiente\n\n`;
      const envFile = files.includes(".env.example") ? ".env.example" : ".env";
      const envContent = await readFile(join(projectPath, envFile), "utf-8");
      const envVars = envContent.split("\n").filter(line => line.includes("="));
      
      documentation += "| Variável | Descrição |\n";
      documentation += "|----------|----------|\n";
      envVars.forEach(envVar => {
        const [key] = envVar.split("=");
        documentation += `| ${key} | TODO: Adicionar descrição |\n`;
      });
      documentation += "\n";
    }
    
    // Como rodar
    documentation += `## 🚀 Como Executar\n\n`;
    if (files.includes("docker-compose.yml")) {
      documentation += "```bash\n";
      documentation += "# Clone o repositório\n";
      documentation += "git clone <url-do-repo>\n\n";
      documentation += "# Entre no diretório\n";
      documentation += "cd " + projectPath.split("/").pop() + "\n\n";
      documentation += "# Configure as variáveis de ambiente\n";
      documentation += "cp .env.example .env\n";
      documentation += "# Edite o arquivo .env com suas configurações\n\n";
      documentation += "# Suba os containers\n";
      documentation += "docker-compose up -d\n";
      documentation += "```\n\n";
    }
    
    // Salva a documentação
    const docPath = join(projectPath, "README.md");
    await writeFile(docPath, documentation);
    
    return {
      content: [{
        type: "text",
        text: `✅ Documentação gerada com sucesso!\n📄 Arquivo: ${docPath}\n\n${documentation.substring(0, 500)}...\n\n[Documento completo salvo]`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao gerar docs: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🧹 FERRAMENTA: Limpar ambiente
server.tool("cleanup_environment", {
  type: z.enum(["docker", "logs", "temp"]).describe("Tipo de limpeza")
}, async ({ type }) => {
  try {
    let result = `🧹 Limpeza ${type} iniciada...\n\n`;
    
    switch (type) {
      case "docker":
        // Remove containers parados
        const { stdout: stopped } = await execAsync("docker ps -aq -f status=exited");
        if (stopped.trim()) {
          await execAsync("docker rm $(docker ps -aq -f status=exited)");
          result += "✅ Containers parados removidos\n";
        }
        
        // Remove imagens sem tag
        const { stdout: dangling } = await execAsync("docker images -f dangling=true -q");
        if (dangling.trim()) {
          await execAsync("docker rmi $(docker images -f dangling=true -q)");
          result += "✅ Imagens órfãs removidas\n";
        }
        
        // Docker system prune
        const { stdout: prune } = await execAsync("docker system prune -f");
        result += `✅ Docker system prune executado\n${prune}\n`;
        break;
        
      case "logs":
        // Limpa logs antigos
        const logsDir = "/var/log";
        const { stdout: oldLogs } = await execAsync(
          `find ${logsDir} -name "*.log" -mtime +7 -size +100M 2>/dev/null | head -10`
        );
        result += `📋 Logs grandes e antigos encontrados:\n${oldLogs}\n`;
        result += "⚠️  Use 'sudo' para remover se necessário\n";
        break;
        
      case "temp":
        // Limpa arquivos temporários
        const tmpDirs = ["/tmp", "/var/tmp", join(homedir(), ".cache")];
        for (const dir of tmpDirs) {
          try {
            const { stdout: tmpSize } = await execAsync(`du -sh ${dir} 2>/dev/null`);
            result += `📁 ${dir}: ${tmpSize}`;
          } catch {
            // Ignora erros de permissão
          }
        }
        break;
    }
    
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro na limpeza: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 💾 FERRAMENTA: Backup de configurações
server.tool("backup_configs", {
  destination: z.string().default("~/backups").describe("Destino do backup")
}, async ({ destination }) => {
  try {
    const backupDir = destination.replace("~", homedir());
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const backupPath = join(backupDir, `config-backup-${timestamp}`);
    
    // Cria diretório de backup
    await execAsync(`mkdir -p "${backupPath}"`);
    
    // Lista de configs pra fazer backup
    const configs = [
      { src: "~/.zshrc", dest: "zshrc" },
      { src: "~/.gitconfig", dest: "gitconfig" },
      { src: "~/.ssh/config", dest: "ssh-config" },
      { src: "~/.config/Code/User/settings.json", dest: "vscode-settings.json" },
      { src: "/etc/docker/daemon.json", dest: "docker-daemon.json" }
    ];
    
    let backedUp = [];
    for (const config of configs) {
      try {
        const srcPath = config.src.replace("~", homedir());
        await execAsync(`cp "${srcPath}" "${backupPath}/${config.dest}" 2>/dev/null`);
        backedUp.push(config.dest);
      } catch {
        // Ignora arquivos que não existem
      }
    }
    
    // Cria arquivo de info
    const info = `Backup criado em: ${new Date().toLocaleString("pt-BR")}\n`;
    await writeFile(join(backupPath, "backup-info.txt"), info);
    
    return {
      content: [{
        type: "text",
        text: `✅ Backup criado em: ${backupPath}\n\n📦 Arquivos salvos:\n${backedUp.map(f => `• ${f}`).join("\n")}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro no backup: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🔍 FERRAMENTA: Verificar portas em uso
server.tool("check_ports", {
  port: z.number().optional().describe("Porta específica ou todas se vazio")
}, async ({ port }) => {
  try {
    const cmd = port 
      ? `lsof -i :${port} -P -n | grep LISTEN`
      : `lsof -i -P -n | grep LISTEN | head -20`;
    
    const { stdout } = await execAsync(cmd);
    
    if (!stdout.trim()) {
      return {
        content: [{
          type: "text",
          text: port ? `✅ Porta ${port} está livre!` : "✅ Nenhuma porta em uso encontrada"
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `🔍 Portas em uso:\n\n${stdout}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro: ${error instanceof Error ? error.message : String(error)}\n\nTenta com sudo se precisar!`
      }]
    };
  }
});

// 📊 FERRAMENTA: Análise de disco
server.tool("disk_analysis", {
  path: z.string().default("/").describe("Caminho para analisar")
}, async ({ path }) => {
  try {
    // Espaço geral
    const { stdout: dfOutput } = await execAsync(`df -h ${path}`);
    
    // Top 10 diretórios grandes
    const { stdout: duOutput } = await execAsync(
      `du -h ${path} 2>/dev/null | sort -rh | head -10`
    );
    
    return {
      content: [{
        type: "text",
        text: `📊 Análise de Disco:\n\n🔸 Espaço Geral:\n${dfOutput}\n\n🔸 Top 10 Maiores:\n${duOutput}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro na análise: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🚀 FERRAMENTA: Deploy helper
server.tool("deploy_helper", {
  action: z.enum(["checklist", "validate", "rollback"]).describe("Ação do deploy")
}, async ({ action }) => {
  try {
    switch (action) {
      case "checklist":
        return {
          content: [{
            type: "text",
            text: `📋 CHECKLIST DE DEPLOY:\n
✅ 1. Código atualizado? (git pull)
✅ 2. .env configurado?
✅ 3. Containers buildados? (docker-compose build)
✅ 4. Volumes com backup?
✅ 5. Healthchecks configurados?
✅ 6. Monitoramento ativo? (Prometheus/Grafana)
✅ 7. Logs centralizados?
✅ 8. Rollback testado?
✅ 9. Documentação atualizada?
✅ 10. Time avisado?

Use 'deploy_helper' com action='validate' pra verificar!`
          }]
        };
        
      case "validate":
        let validation = "🔍 VALIDANDO AMBIENTE...\n\n";
        
        // Verifica Docker
        try {
          await execAsync("docker --version");
          validation += "✅ Docker instalado\n";
        } catch {
          validation += "❌ Docker não encontrado\n";
        }
        
        // Verifica docker-compose
        try {
          await execAsync("docker-compose --version");
          validation += "✅ Docker Compose instalado\n";
        } catch {
          validation += "❌ Docker Compose não encontrado\n";
        }
        
        // Verifica Git
        try {
          const { stdout } = await execAsync("git status --porcelain");
          validation += stdout.trim() ? "⚠️  Git tem mudanças não commitadas\n" : "✅ Git limpo\n";
        } catch {
          validation += "❌ Não é um repositório Git\n";
        }
        
        return {
          content: [{
            type: "text",
            text: validation
          }]
        };
        
      case "rollback":
        return {
          content: [{
            type: "text",
            text: `🔙 GUIA DE ROLLBACK:\n
1. Para a aplicação atual:
   docker-compose down

2. Restaura backup do banco (se aplicável):
   docker exec -i db_container mysql < backup.sql

3. Volta pro commit anterior:
   git log --oneline -5  # pega o hash
   git checkout <hash-anterior>

4. Rebuilda e sobe:
   docker-compose build
   docker-compose up -d

5. Verifica logs:
   docker-compose logs -f

⚠️  SEMPRE teste o rollback ANTES de precisar dele!`
          }]
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 📝 PROMPT: Gerar documentação completa
server.prompt("generate_full_docs", {
  projectName: z.string().describe("Nome do projeto"),
  projectPath: z.string().describe("Caminho do projeto"),
  techStack: z.string().optional().describe("Stack tecnológica")
}, ({ projectName, projectPath, techStack }) => ({
  messages: [{
    role: "user",
    content: {
      type: "text",
      text: `Por favor, gere uma documentação completa para o projeto "${projectName}".

Caminho: ${projectPath}
Stack: ${techStack || "A ser identificada"}

Inclua:
1. Visão geral do projeto
2. Requisitos e dependências
3. Instruções de instalação
4. Configuração de ambiente
5. Como executar
6. Estrutura do projeto
7. Endpoints/Funcionalidades principais
8. Troubleshooting comum
9. Contribuindo para o projeto

Use as ferramentas disponíveis para analisar o projeto e gerar uma documentação profissional e completa.`
    }
  }]
}));

// 📁 FERRAMENTA: Ler arquivo
server.tool("read_file", {
  path: z.string().describe("Caminho completo do arquivo"),
  lines: z.number().optional().describe("Número de linhas para ler (opcional)")
}, async ({ path, lines }) => {
  try {
    // Verificação de segurança - só permite certos diretórios
    const safePaths = [
      "/home/mateus",
      "/tmp", 
      "/etc/nginx",
      "/etc/apache2",
      "/var/log"
    ];
    
    const isPathSafe = safePaths.some(safePath => path.startsWith(safePath));
    if (!isPathSafe) {
      return {
        content: [{
          type: "text", 
          text: `🔒 Acesso negado por segurança ao caminho: ${path}\n\nCaminhos permitidos:\n${safePaths.join("\n")}`
        }]
      };
    }

    const content = await readFile(path, "utf-8");
    
    if (lines) {
      const limitedContent = content.split("\n").slice(0, lines).join("\n");
      return {
        content: [{
          type: "text",
          text: `📄 Arquivo: ${path} (primeiras ${lines} linhas)\n\n${limitedContent}`
        }]
      };
    }
    
    // Se arquivo muito grande, limita automaticamente
    if (content.length > 10000) {
      const preview = content.substring(0, 10000);
      return {
        content: [{
          type: "text",
          text: `📄 Arquivo: ${path} (preview - arquivo muito grande)\n\n${preview}\n\n... [arquivo continua]`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `📄 Arquivo: ${path}\n\n${content}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao ler arquivo: ${error instanceof Error ? error.message : String(error)}\n\nVerifica se o arquivo existe e você tem permissão!`
      }]
    };
  }
});

// ✏️ FERRAMENTA: Escrever/criar arquivo
server.tool("write_file", {
  path: z.string().describe("Caminho completo do arquivo"),
  content: z.string().describe("Conteúdo do arquivo"),
  backup: z.boolean().default(true).describe("Fazer backup se arquivo existir")
}, async ({ path, content, backup }) => {
  try {
    // Verificação de segurança
    const safePaths = [
      "/home/mateus",
      "/tmp"
    ];
    
    const isPathSafe = safePaths.some(safePath => path.startsWith(safePath));
    if (!isPathSafe) {
      return {
        content: [{
          type: "text",
          text: `🔒 Escrita negada por segurança ao caminho: ${path}\n\nCaminhos permitidos para escrita:\n${safePaths.join("\n")}`
        }]
      };
    }

    // Fazer backup se arquivo existir
    if (backup) {
      try {
        const existingContent = await readFile(path, "utf-8");
        const backupPath = `${path}.backup.${Date.now()}`;
        await writeFile(backupPath, existingContent);
        
        await writeFile(path, content);
        
        return {
          content: [{
            type: "text",
            text: `✅ Arquivo escrito: ${path}\n💾 Backup criado: ${backupPath}\n\n📝 Conteúdo (${content.length} caracteres) salvo com sucesso!`
          }]
        };
      } catch {
        // Se não existe, cria novo
        await writeFile(path, content);
        return {
          content: [{
            type: "text",
            text: `✅ Novo arquivo criado: ${path}\n📝 Conteúdo (${content.length} caracteres) salvo!`
          }]
        };
      }
    } else {
      await writeFile(path, content);
      return {
        content: [{
          type: "text",
          text: `✅ Arquivo escrito: ${path}\n📝 Conteúdo (${content.length} caracteres) salvo!`
        }]
      };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao escrever arquivo: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 📁 FERRAMENTA: Listar diretório
server.tool("list_directory", {
  path: z.string().describe("Caminho do diretório"),
  showHidden: z.boolean().default(false).describe("Mostrar arquivos ocultos"),
  details: z.boolean().default(false).describe("Mostrar detalhes (ls -la)")
}, async ({ path, showHidden, details }) => {
  try {
    if (details) {
      const hiddenFlag = showHidden ? "a" : "";
      const { stdout } = await execAsync(`ls -l${hiddenFlag} "${path}"`);
      return {
        content: [{
          type: "text",
          text: `📁 Diretório detalhado: ${path}\n\n${stdout}`
        }]
      };
    }
    
    const files = await readdir(path, { withFileTypes: true });
    
    let listing = `📁 Conteúdo de: ${path}\n\n`;
    
    const dirs = files.filter(f => f.isDirectory());
    const regularFiles = files.filter(f => f.isFile());
    
    if (dirs.length > 0) {
      listing += "📂 DIRETÓRIOS:\n";
      dirs.forEach(dir => {
        if (showHidden || !dir.name.startsWith('.')) {
          listing += `  📂 ${dir.name}/\n`;
        }
      });
      listing += "\n";
    }
    
    if (regularFiles.length > 0) {
      listing += "📄 ARQUIVOS:\n";
      regularFiles.forEach(file => {
        if (showHidden || !file.name.startsWith('.')) {
          listing += `  📄 ${file.name}\n`;
        }
      });
    }
    
    if (dirs.length === 0 && regularFiles.length === 0) {
      listing += "📭 Diretório vazio\n";
    }
    
    return {
      content: [{
        type: "text",
        text: listing
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao listar diretório: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 📁 FERRAMENTA: Criar diretório
server.tool("create_directory", {
  path: z.string().describe("Caminho do diretório para criar"),
  recursive: z.boolean().default(true).describe("Criar diretórios pais se necessário")
}, async ({ path, recursive }) => {
  try {
    // Verificação de segurança
    const safePaths = ["/home/mateus", "/tmp"];
    const isPathSafe = safePaths.some(safePath => path.startsWith(safePath));
    
    if (!isPathSafe) {
      return {
        content: [{
          type: "text",
          text: `🔒 Criação negada por segurança: ${path}\n\nCaminhos permitidos:\n${safePaths.join("\n")}`
        }]
      };
    }

    const flag = recursive ? "-p" : "";
    await execAsync(`mkdir ${flag} "${path}"`);
    
    return {
      content: [{
        type: "text",
        text: `✅ Diretório criado: ${path}${recursive ? " (com pais se necessário)" : ""}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao criar diretório: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🔄 FERRAMENTA: Mover/renomear arquivo
server.tool("move_file", {
  source: z.string().describe("Caminho de origem"),
  destination: z.string().describe("Caminho de destino"),
  backup: z.boolean().default(true).describe("Fazer backup se destino existir")
}, async ({ source, destination, backup }) => {
  try {
    // Verificação de segurança para ambos os caminhos
    const safePaths = ["/home/mateus", "/tmp"];
    const isSourceSafe = safePaths.some(safePath => source.startsWith(safePath));
    const isDestSafe = safePaths.some(safePath => destination.startsWith(safePath));
    
    if (!isSourceSafe || !isDestSafe) {
      return {
        content: [{
          type: "text",
          text: `🔒 Operação negada por segurança!\nOrigem: ${source} ${isSourceSafe ? "✅" : "❌"}\nDestino: ${destination} ${isDestSafe ? "✅" : "❌"}`
        }]
      };
    }

    // Fazer backup do destino se existir
    if (backup) {
      try {
        await readFile(destination, "utf-8");
        const backupPath = `${destination}.backup.${Date.now()}`;
        await execAsync(`cp "${destination}" "${backupPath}"`);
        
        await execAsync(`mv "${source}" "${destination}"`);
        
        return {
          content: [{
            type: "text",
            text: `✅ Arquivo movido: ${source} → ${destination}\n💾 Backup do destino: ${backupPath}`
          }]
        };
      } catch {
        // Destino não existe, move normalmente
        await execAsync(`mv "${source}" "${destination}"`);
        return {
          content: [{
            type: "text",
            text: `✅ Arquivo movido: ${source} → ${destination}`
          }]
        };
      }
    } else {
      await execAsync(`mv "${source}" "${destination}"`);
      return {
        content: [{
          type: "text",
          text: `✅ Arquivo movido: ${source} → ${destination}`
        }]
      };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao mover arquivo: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🔍 FERRAMENTA: Buscar arquivos por conteúdo
server.tool("search_files", {
  pattern: z.string().describe("Padrão de busca (regex suportado)"),
  path: z.string().default("/home/mateus").describe("Diretório para buscar"),
  fileType: z.string().optional().describe("Tipo de arquivo (ex: .js, .md, .yml)")
}, async ({ pattern, path, fileType }) => {
  try {
    let searchCmd = `grep -r "${pattern}" "${path}"`;
    
    if (fileType) {
      searchCmd += ` --include="*${fileType}"`;
    }
    
    // Limita resultados para não quebrar o output
    searchCmd += " | head -20";
    
    const { stdout } = await execAsync(searchCmd);
    
    if (!stdout.trim()) {
      return {
        content: [{
          type: "text",
          text: `🔍 Nenhum resultado encontrado para: "${pattern}"\nCaminho: ${path}${fileType ? `\nTipo: ${fileType}` : ""}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `🔍 Resultados da busca por "${pattern}":\n\n${stdout}\n\n💡 Mostrando primeiros 20 resultados`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro na busca: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 📊 FERRAMENTA: Informações do arquivo
server.tool("file_info", {
  path: z.string().describe("Caminho do arquivo")
}, async ({ path }) => {
  try {
    const { stdout: statOutput } = await execAsync(`stat "${path}"`);
    const { stdout: fileOutput } = await execAsync(`file "${path}"`);
    
    return {
      content: [{
        type: "text",
        text: `📊 Informações de: ${path}\n\n🔍 Tipo:\n${fileOutput}\n\n📈 Detalhes:\n${statOutput}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro ao obter info: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 💾 FERRAMENTA: Backup rápido de arquivo
server.tool("quick_backup", {
  path: z.string().describe("Caminho do arquivo para backup"),
  destination: z.string().optional().describe("Destino do backup (opcional)")
}, async ({ path, destination }) => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const backupPath = destination || `${path}.backup.${timestamp}`;
    
    await execAsync(`cp "${path}" "${backupPath}"`);
    
    return {
      content: [{
        type: "text",
        text: `💾 Backup criado!\nOriginal: ${path}\nBackup: ${backupPath}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Erro no backup: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
});

// 🚀 INICIAR O SERVIDOR
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP DevOps Assistant rodando! Conecte no Claude Desktop!");
}

main().catch(console.error);