import type { VendorProfile } from '@smartshaadi/types';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorPortfolioGallery } from './VendorPortfolioGallery.client';

export interface PortfolioPackage {
  name?: string;
  price?: number;
  priceUnit?: string;
  inclusions?: string[];
  exclusions?: string[];
}

export interface PortfolioItem {
  title?: string;
  description?: string;
  eventType?: string;
  photoKeys?: string[];
}

export interface PortfolioDoc {
  about?: string;
  tagline?: string;
  portfolio?: PortfolioItem[];
  packages?: PortfolioPackage[];
  faqs?: Array<{ question?: string; answer?: string }>;
  awards?: string[];
}

interface VendorPortfolioProps {
  vendor: VendorProfile & { portfolio: PortfolioDoc | null };
}

function PackageCard({ pkg, popular }: { pkg: PortfolioPackage; popular?: boolean }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-surface p-4 transition-shadow',
        popular ? 'border-gold/60 shadow-md ring-1 ring-gold/30' : 'border-gold/40',
      )}
    >
      {popular && (
        <span className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-white shadow-sm">
          <Star className="h-3 w-3" aria-hidden="true" />
          Most Popular
        </span>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{pkg.name ?? 'Package'}</h4>
        {pkg.price != null && (
          <span className="shrink-0 text-sm font-bold text-teal">
            ₹{pkg.price.toLocaleString('en-IN')}
            {pkg.priceUnit && (
              <span className="text-xs font-normal text-muted-foreground"> / {pkg.priceUnit.replace(/_/g, ' ').toLowerCase()}</span>
            )}
          </span>
        )}
      </div>

      {pkg.inclusions && pkg.inclusions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pkg.inclusions.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg className="h-3.5 w-3.5 shrink-0 text-success" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VendorPortfolio({ vendor }: VendorPortfolioProps) {
  const portfolio = vendor.portfolio;

  return (
    <div className="space-y-8">
      {/* About */}
      {portfolio?.about && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-primary mb-3">About</h2>
          <p className="text-muted-foreground leading-relaxed">{portfolio.about}</p>
        </section>
      )}

      {/* Photo gallery — aggregate all portfolio item photos into a single gallery */}
      {portfolio?.portfolio && portfolio.portfolio.length > 0 && (() => {
        const allKeys = portfolio.portfolio.flatMap((item) => item.photoKeys ?? []);
        return (
          <section>
            <h2 className="text-lg font-semibold font-heading text-primary mb-3">Portfolio</h2>
            {allKeys.length > 0 ? (
              <VendorPortfolioGallery photoKeys={allKeys} vendorName={vendor.businessName} />
            ) : null}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portfolio.portfolio.map((item, i) => (
                <div key={i} className="border border-gold/30 rounded-xl p-3 bg-surface">
                  {item.title && (
                    <p className="font-medium text-primary text-sm mb-1">{item.title}</p>
                  )}
                  {item.eventType && (
                    <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full mb-2">
                      {item.eventType}
                    </span>
                  )}
                  {item.description && (
                    <p className="text-muted-foreground text-xs">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Packages — highest-priced gets the "Most Popular" ribbon */}
      {portfolio?.packages && portfolio.packages.length > 0 && (() => {
        const pkgs = portfolio.packages;
        let popularIdx = 0;
        let topPrice = -1;
        pkgs.forEach((p, i) => {
          if (p.price != null && p.price > topPrice) { popularIdx = i; topPrice = p.price; }
        });
        return (
          <section>
            <h2 className="text-lg font-semibold font-heading text-primary mb-4">Packages</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pkgs.map((pkg, i) => (
                <PackageCard key={i} pkg={pkg} popular={pkgs.length > 1 && i === popularIdx && topPrice > 0} />
              ))}
            </div>
          </section>
        );
      })()}

      {/* Services from PG */}
      {vendor.services.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-primary mb-3">Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vendor.services.map((svc) => (
              <div key={svc.id} className="border border-gold/30 rounded-xl p-3 bg-surface">
                <p className="font-medium text-foreground text-sm">{svc.name}</p>
                {svc.description && (
                  <p className="text-muted-foreground text-xs mt-1">{svc.description}</p>
                )}
                <p className="text-teal font-semibold text-sm mt-2">
                  ₹{svc.priceFrom.toLocaleString('en-IN')}
                  {svc.priceTo && svc.priceTo !== svc.priceFrom
                    ? ` – ₹${svc.priceTo.toLocaleString('en-IN')}`
                    : ''}
                  <span className="text-muted-foreground font-normal text-xs"> / {svc.unit.replace(/_/g, ' ').toLowerCase()}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQs */}
      {portfolio?.faqs && portfolio.faqs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-primary mb-3">FAQs</h2>
          <div className="space-y-3">
            {portfolio.faqs.map((faq, i) => (
              <div key={i} className="border border-gold/30 rounded-xl p-4 bg-surface">
                {faq.question && (
                  <p className="font-medium text-foreground text-sm mb-1">{faq.question}</p>
                )}
                {faq.answer && (
                  <p className="text-muted-foreground text-sm">{faq.answer}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Awards */}
      {portfolio?.awards && portfolio.awards.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-primary mb-3">Awards & Recognition</h2>
          <ul className="flex flex-wrap gap-2">
            {portfolio.awards.map((award, i) => (
              <li key={i} className="bg-warning/10 border border-warning/30 text-warning text-xs font-medium px-3 py-1 rounded-full">
                {award}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
