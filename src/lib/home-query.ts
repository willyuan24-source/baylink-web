/**
 * Short keywords stay in search; explicit questions enter the assistant. Traditional spellings count too (怎麼, 什麼,
 * 哪裡, 幫我, 請), written into the pattern so the home page needs no converter for it. Either way the reader keeps both
 * paths: search results always end with a pinned "交给 BayBay" row (QuickExplore), and BayBay answers with site links.
 */
export const isHomeQuestion = (query: string) => /[?？]|怎[么麼]|如何|什[么麼]|哪[里裡裏个個些]|能不能|可以|[帮幫]我|[请請]|\b(how|what|where|can|could|help|please|why|which)\b/i.test(query);
