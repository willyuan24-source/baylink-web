import { renderPublicSharePage, type PublicShareDependencies } from '../server/public-share-page.js';

export const renderPublicUserCardPage = (request: Request, dependencies: PublicShareDependencies = {}) => renderPublicSharePage(request, 'user', dependencies);
export default { fetch: (request: Request) => renderPublicUserCardPage(request) };
