// The guide corpus for /guides' full-text search, loaded on the first search (GuidesHome). A module of its own so the corpus
// stays in the chunk the other pages share with it instead of becoming an entry (and splitting its neighbours) itself.
export { guides } from '../../data/guides';
