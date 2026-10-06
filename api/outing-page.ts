import { renderPublicSharePage, type PublicShareDependencies } from '../server/public-share-page.js';

export const renderPublicOutingPage = (request: Request, dependencies: PublicShareDependencies = {}) => renderPublicSharePage(request, 'outing', dependencies);
export default { fetch: (request: Request) => renderPublicOutingPage(request) };
