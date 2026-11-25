import { useState, type KeyboardEvent } from 'react';
import {
  ExternalLink,
  AlertCircle,
  Star,
  RefreshCw,
  Copy,
  Check,
  ClipboardCheck,
} from 'lucide-react';
import type { BusinessConfig } from '../../shared/config.ts';
import { getContrastTextColor, validateGoogleReviewUrl } from '../../shared/config.ts';
import { composeNaturalReview } from '../lib/reviewComposer.ts';
import { BrandMark } from './BrandMark.tsx';

interface CustomerLandingCardProps {
  config: BusinessConfig;
  isPreview?: boolean;
  compact?: boolean;
}

export function CustomerLandingCard({
  config,
  isPreview = false,
  compact = false,
}: CustomerLandingCardProps) {
  // Rating and review text remain strictly in ephemeral local state and are never saved or used to filter.
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [copiedReview, setCopiedReview] = useState(false);
  const [handoffState, setHandoffState] = useState<{
    opened: boolean;
    clipboardCopied: boolean;
  } | null>(null);

  const urlCheck = validateGoogleReviewUrl(config.googleReviewUrl);
  const safeGoogleUrl = urlCheck.valid && urlCheck.normalizedUrl ? urlCheck.normalizedUrl : null;
  const ctaTextColor = getContrastTextColor(config.ctaColor);
  const activeVisualRating = hoveredStar ?? selectedRating ?? 0;

  const selectRatingAndGenerate = (starNumber: number) => {
    setSelectedRating(starNumber);
    setReviewText(composeNaturalReview(starNumber, config.businessName));
    setCopiedReview(false);
    setHandoffState(null);
  };

  const handleClearSelection = () => {
    setSelectedRating(null);
    setReviewText('');
    setCopiedReview(false);
    setHandoffState(null);
  };

  const copyExactReviewToClipboard = async (): Promise<boolean> => {
    if (!reviewText) return false;
    let copied = false;

    try {
      const temp = document.createElement('textarea');
      temp.value = reviewText;
      temp.setAttribute('readonly', '');
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      temp.setSelectionRange(0, temp.value.length);
      copied = document.execCommand('copy');
      document.body.removeChild(temp);
    } catch {
      copied = false;
    }

    if (!copied && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(reviewText);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedReview(true);
      setTimeout(() => setCopiedReview(false), 2500);
    }
    return copied;
  };

  const handleOpenGoogleClick = async () => {
    let clipboardCopied = false;
    if (reviewText.length > 0) {
      clipboardCopied = await copyExactReviewToClipboard();
    }
    if (!isPreview) {
      setHandoffState({ opened: true, clipboardCopied });
    }
  };

  const handleStarKeyDown = (e: KeyboardEvent<HTMLButtonElement>, starNumber: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(5, starNumber + 1);
      selectRatingAndGenerate(next);
      const nextBtn = document.getElementById(`rating-star-${isPreview ? 'preview-' : ''}${next}`);
      nextBtn?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(1, starNumber - 1);
      selectRatingAndGenerate(prev);
      const prevBtn = document.getElementById(`rating-star-${isPreview ? 'preview-' : ''}${prev}`);
      prevBtn?.focus();
    } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      const chosen = Number(e.key);
      selectRatingAndGenerate(chosen);
      const targetBtn = document.getElementById(`rating-star-${isPreview ? 'preview-' : ''}${chosen}`);
      targetBtn?.focus();
    } else if (e.key === 'Escape' || e.key === '0') {
      handleClearSelection();
    }
  };

  return (
    <section
      aria-label="Customer Review"
      className={`w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      {/* Business Identity */}
      <div className="flex flex-col items-center text-center">
        <BrandMark
          logoUrl={config.logoUrl}
          businessName={config.businessName}
          primaryColor={config.primaryColor}
          ctaColor={config.ctaColor}
          size={compact ? 'md' : 'lg'}
        />

        <p
          className="mt-3 text-base font-semibold tracking-tight text-slate-900"
          style={{ color: config.primaryColor }}
        >
          {config.businessName}
        </p>

        {config.welcomeMessage.trim() && (
          <p className="mt-1 text-sm text-slate-600 max-w-md leading-relaxed">
            {config.welcomeMessage}
          </p>
        )}
      </div>

      <div className="my-5 border-t border-slate-100" />

      {/* Heading & Supporting Copy */}
      <div className="text-center">
        <h1
          className={`font-display font-bold tracking-tight text-slate-900 text-balance ${
            compact ? 'text-2xl' : 'text-2xl sm:text-3xl'
          }`}
          style={{ color: config.primaryColor }}
        >
          {config.heading}
        </h1>
        <p className="mt-2 text-sm sm:text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
          {config.supportingText}
        </p>
      </div>

      {/* Accessible 1-5 Star Selector */}
      <div className="mt-6">
        <div
          role="radiogroup"
          aria-label="Star rating from 1 to 5"
          className="flex items-center justify-center gap-2 sm:gap-3"
          onMouseLeave={() => setHoveredStar(null)}
        >
          {[1, 2, 3, 4, 5].map((starNumber) => {
            const isSelected = selectedRating === starNumber;
            const isFilled = starNumber <= activeVisualRating;

            return (
              <button
                key={starNumber}
                id={`rating-star-${isPreview ? 'preview-' : ''}${starNumber}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${starNumber} ${starNumber === 1 ? 'star' : 'stars'} out of 5`}
                onClick={() => selectRatingAndGenerate(starNumber)}
                onMouseEnter={() => setHoveredStar(starNumber)}
                onKeyDown={(e) => handleStarKeyDown(e, starNumber)}
                className={`group flex flex-col items-center justify-center min-w-[48px] min-h-[54px] sm:min-w-[54px] sm:min-h-[58px] rounded-2xl border transition-all duration-150 cursor-pointer select-none ${
                  isFilled
                    ? 'border-amber-300 bg-amber-50/80 shadow-xs'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/70'
                }`}
              >
                <Star
                  className={`h-6 w-6 sm:h-7 sm:w-7 transition-transform duration-150 group-active:scale-90 ${
                    isFilled
                      ? 'fill-amber-400 text-amber-500'
                      : 'fill-transparent text-slate-300 group-hover:text-slate-400'
                  }`}
                  strokeWidth={1.75}
                />
                <span
                  className={`mt-1 text-[11px] font-medium tabular-nums leading-none ${
                    isFilled ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  {starNumber}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          {selectedRating
            ? `Selected ${selectedRating} of 5 · review ready below (edit anytime)`
            : 'Tap a star to automatically generate a review, or continue directly below'}
        </p>
      </div>

      {/* Editable Review Textarea (Synchronized with selected star rating) */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <label
            htmlFor={isPreview ? 'preview-feedback-notes' : 'customer-feedback-notes'}
            className="text-sm font-medium text-slate-700"
          >
            {config.feedbackLabel}
          </label>
          <div className="flex items-center gap-3 text-xs">
            {selectedRating !== null && (
              <button
                type="button"
                onClick={() => selectRatingAndGenerate(selectedRating)}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Regenerate</span>
              </button>
            )}
            {reviewText.trim().length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => void copyExactReviewToClipboard()}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                >
                  {copiedReview ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Clear
                </button>
              </>
            )}
            {selectedRating === null && reviewText.trim().length === 0 && (
              <span className="text-slate-400">Optional</span>
            )}
          </div>
        </div>

        <textarea
          id={isPreview ? 'preview-feedback-notes' : 'customer-feedback-notes'}
          rows={compact ? 3 : 4}
          value={reviewText}
          onChange={(e) => {
            setReviewText(e.target.value);
            setHandoffState(null);
          }}
          placeholder="Tap a star above to generate a natural review, or write your own experience..."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 leading-relaxed placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition-colors resize-y"
        />
      </div>

      {/* Simple Direct Google Review CTA (No checkbox, same destination for all ratings 1-5) */}
      <div className="mt-5">
        {safeGoogleUrl ? (
          <>
            <a
              href={safeGoogleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void handleOpenGoogleClick()}
              className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2.5 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all duration-150"
              style={{
                backgroundColor: config.ctaColor,
                color: ctaTextColor,
              }}
            >
              <span>{config.buttonText}</span>
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>

            {handoffState?.opened && !isPreview && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <ClipboardCheck className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>
                      {reviewText.length > 0 && handoffState.clipboardCopied
                        ? 'Your exact review was copied to your clipboard'
                        : 'Google Reviews opened in a new tab'}
                    </span>
                  </div>
                  {reviewText.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void copyExactReviewToClipboard()}
                      className="text-xs font-semibold text-slate-800 underline underline-offset-2 shrink-0 cursor-pointer"
                    >
                      {copiedReview ? 'Copied!' : 'Copy Review'}
                    </button>
                  )}
                </div>

                {(selectedRating !== null || reviewText.length > 0) && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    On Google Reviews, select{' '}
                    {selectedRating !== null ? (
                      <strong className="font-semibold text-slate-900">
                        {selectedRating} {selectedRating === 1 ? 'star' : 'stars'}
                      </strong>
                    ) : (
                      'your star rating'
                    )}
                    {reviewText.length > 0
                      ? ' and paste your exact review text before submitting.'
                      : ' and share your review.'}
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  Didn&apos;t open automatically?{' '}
                  <a
                    href={safeGoogleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 text-slate-800"
                  >
                    Open Google Reviews directly
                  </a>
                </p>
              </div>
            )}
          </>
        ) : (
          <div
            role="status"
            className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3 text-left"
          >
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Google Review link is temporarily unavailable
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                The business owner needs to verify the official Google Review URL in the admin dashboard.
              </p>
            </div>
          </div>
        )}

        <p className="mt-3.5 text-center text-xs text-slate-500 leading-relaxed">
          {config.privacyNote}
        </p>
      </div>
    </section>
  );
}
