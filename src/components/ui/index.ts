/**
 * BAYLINK UI primitives (plan WEB-UI). Each component imports its own ui.css (no global CSS import, D6).
 * Covers: resolve with `getCover` / `resolveCovers` (src/lib/cover.ts), render with <EventCover>, <OfferCover>,
 * <OpeningCover> or <Cover>; facts come from src/lib/event-facts.ts.
 */
export { ProvenanceBadge, Sticker, StickerRow, StatusChip, type StickerTone, type StatusTone } from './Badges';
export { Button, IconButton, type ButtonProps, type ButtonVariant, type IconButtonProps } from './Button';
export { FilterChip, ChipRow, type FilterChipProps } from './Chip';
export { SaveButton } from './SaveButton';
export { CoverImage, type CoverImageProps, type CoverRatio } from './CoverImage';
export { COVER_SIZES } from './cover-sizes';
export { TypeCover, EventTypeCover, OfferTypeCover, OpeningTypeCover, type TypeCoverProps } from './TypeCover';
export { offerBrandLine } from './offer-brand';
export { Cover, EventCover, OfferCardMeta, OfferCover, OpeningCover } from './Cover';
export { FeedCard, RowCard, type FeedCardProps, type RowCardProps } from './Card';
export { HeroCard, type HeroCardProps } from './HeroCard';
export { PageHeader, PageContainer, type PageHeaderProps } from './PageHeader';
export { Carousel, type CarouselProps } from './Carousel';
export { CoverCredit, FeedGrid, FeedItem, FeedLayoutToggle, type FeedGridProps } from './FeedGrid';
export { useFeedLayout, readFeedLayout, writeFeedLayout, automaticLayout, FEED_LAYOUT_KEY, PHONE_QUERY, type FeedLayout } from './feed-layout';
export { Sheet, type SheetProps } from './Sheet';
export { SegmentedTabs, SegmentedControl, type SegmentItem, type SegmentedTabsProps, type SegmentedControlProps } from './Segmented';
export { SkeletonCard, SkeletonRow, SkeletonFeed } from './SkeletonCard';
export { EmptyState, ErrorState, type EmptyStateProps, type ErrorStateProps } from './States';
// UI9-F2 primitives: import them from their own files (./ui/Disclosure, ./ui/CloseButton, ./ui/TextLink). This barrel is
// imported on the home page, and a runtime re-export here would put their stylesheets into its render-blocking CSS whether
// or not a page uses them; only their types are re-exported.
export type { DisclosureProps } from './Disclosure';
export type { CloseButtonProps } from './CloseButton';
export type { TextLinkProps } from './TextLink';
