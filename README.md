# 🚀 MCP DevOps Assistant

> **MCP Server para automação DevOps** - Assistente inteligente que resolve seus problemas de infraestrutura enquanto você toma café ☕

## 🎯 O Problema

Sou estagiário de DevOps na YOUX GROUP e cansei de:

- Perder HORAS documentando processos manualmente
- Entrar em loops infinitos debugando containers
- IAs que perdem contexto quando dá erro
- Trabalhar até tarde por coisas que deveriam ser automáticas

## 💡 A Solução

Um MCP Server que **REALMENTE** entende seu ambiente DevOps e automatiza tudo que é repetitivo!

## ⚡ Features

- 🐳 **Docker Management** - Lista containers, analisa logs, troubleshooting automático
- 📊 **System Monitoring** - Disk usage, portas, performance analysis
- 🔧 **Git Integration** - Status, branches, commits sem precisar decorar comandos
- 📝 **Auto Documentation** - Gera docs técnicas baseado no seu código
- 🧹 **Environment Cleanup** - Limpa Docker, logs, temp files
- 💾 **Smart Backup** - Backup de configs importantes
- 🚀 **Deploy Helper** - Checklists e validações de deployment

> **Construído por um estagiário DevOps, para estagiários DevOps que querem trabalhar SMART, não HARD!**

## 🛠️ Stack Técnica

- **TypeScript** - Type safety é vida
- **MCP SDK** - Integração nativa com Claude
- **Zod** - Validação de schemas
- **Node.js** - Runtime confiável

## 🚀 Como Usar

### Pré-requisitos

```bash
# Node.js 18+
# NPM ou Yarn
# Git
```

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/mcp-devops-assistant.git

# Entre na pasta
cd mcp-devops-assistant

# Instale dependências
npm install

# Build do projeto
npm run build

# Execute
npm start
```

### Configuração no Claude Desktop

Adicione no seu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "devops-assistant": {
      "command": "node",
      "args": ["/caminho/para/mcp-devops-assistant/dist/index.js"],
      "env": {}
    }
  }
}
```

## 📋 Comandos Disponíveis

| Função | Descrição |
|--------|-----------|
| `docker_analysis` | Analisa containers em execução |
| `system_health` | Check completo do sistema |
| `auto_cleanup` | Limpeza inteligente do ambiente |
| `backup_configs` | Backup de configurações |
| `deploy_validation` | Valida deploy antes da produção |

## 🤝 Contribuindo

**PRs são MUITO bem-vindos!**

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/MinhaFeature`)
3. Commit as mudanças (`git commit -m 'Add: nova feature incrível'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

MIT License - Use à vontade!

## 👨‍💻 Sobre o Autor

**Mateus** - Estagiário DevOps na YOUX GROUP  
🎓 Engenharia de Software - UnB  
🏠 Brasília-DF  

**LinkedIn:** linkedin.com/in/mateus-solon-739350313  
**Email:** <mateusolon@gmail.com>

---

> *"Automatizar o que é chato para focar no que é divertido!"* 🚀

**⭐ Se este projeto te ajudou, deixa uma estrela! Isso me motiva MUITO a continuar desenvolvendo!**
