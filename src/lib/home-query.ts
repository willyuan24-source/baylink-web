/** Short keywords stay in search; explicit questions enter the assistant. */
export const isHomeQuestion = (query: string) => /[?？]|怎么|如何|什么|哪[里个些]|能不能|可以|帮我|请|\b(how|what|where|can|could|help|please|why|which)\b/i.test(query);
