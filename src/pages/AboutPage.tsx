import { AboutContent } from '../components/AboutContent';
import { useApp } from '../app/context';

export default function AboutPage() {
  const { openBayBay } = useApp();
  return <AboutContent onAskBayBay={() => openBayBay()} />;
}
