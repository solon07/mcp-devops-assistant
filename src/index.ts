import { McpServer } from "@modelcontextprotocol/sdk/server";

/**
 * Inicializa o servidor MCP DevOps Assistant
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: "DevOps Assistant MCP",
    version: "0.1.0",
    description: "Servidor MCP raiz do Mateus, só pra testar se levanta."
  });

  // Evento de inicialização
  server.on("initialized", () => {
    console.log("🔥 MCP DevOps Assistant rodando bonito! 🔥");
  });

  // Inicia o servidor padrão (stdin/stdout)
  await server.listen();
}

// Execução direta com tratamento de erro
main().catch((err) => {
  console.error("EITA, BICHO, DEU RUIM PRA INICIAR O SERVIDOR:", err);
  process.exit(1);
});
