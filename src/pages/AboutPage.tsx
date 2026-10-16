import { AboutContent } from '../components/AboutContent';
import { useApp } from '../app/context';
import '../components/about-baylink.css';

export default function AboutPage() {
  const { openBayBay } = useApp();
  return <AboutContent onAskBayBay={() => openBayBay()} />;
}
