import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { setPageMetadata } from '../lib/seo';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  useEffect(() => {
    setPageMetadata({ title: '页面不存在｜BAYLINK', description: '没有找到这个页面。请检查链接，或返回 BAYLINK 首页和生活指南。', path: pathname, noindex: true });
  }, [pathname]);
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-semibold text-baylink-green">404</p>
      <h1 className="mt-2 text-2xl font-bold text-baylink-text">没有找到这个页面</h1>
      <p className="mt-3 text-sm leading-relaxed text-baylink-text-secondary">链接可能有误，或内容已被移除。你可以回到首页继续浏览。</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary px-5 py-2.5 text-sm">返回首页</Link>
        <Link to="/guides" className="rounded-xl border border-baylink-border bg-white px-5 py-2.5 text-sm font-semibold text-baylink-text">查看生活指南</Link>
      </div>
    </section>
  );
}
