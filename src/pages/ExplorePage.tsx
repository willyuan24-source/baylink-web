import { AttractionExplorer } from '../components/AttractionExplorer';
import { useApp } from '../app/context';
import '../styles/attractions.css';

export default function ExplorePage() {
  const { openBayBay } = useApp();
  return <AttractionExplorer onAsk={openBayBay} />;
}
