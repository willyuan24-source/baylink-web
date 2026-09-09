import { useApp } from '../app/context';
import { ToolsHub } from '../components/tools/ToolsHub';

export default function ToolsPage() {
  const { user, showToast } = useApp();
  return <ToolsHub key={user?.id || 'guest'} storageScope={user ? `user:${user.id}` : 'guest'} onToast={showToast} />;
}
