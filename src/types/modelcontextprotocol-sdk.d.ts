declare module "@modelcontextprotocol/sdk/dist/esm/server/stdio.js" {
  export class StdioServerTransport {
    constructor(stdin?: NodeJS.ReadableStream, stdout?: NodeJS.WritableStream);
    onmessage?: (msg: unknown) => void;
    onerror?: (err: unknown) => void;
    onclose?: () => void;
    start(): Promise<void>;
    close(): Promise<void>;
    send(message: unknown): Promise<void>;
  }
}
