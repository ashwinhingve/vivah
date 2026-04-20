import type { VendorProfile } from '@smartshaadi/types';

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

function PackageCard({ pkg }: { pkg: PortfolioPackage }) {
  return (
    <div className="border border-[#C5A47E]/40 rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-[#2E2E38] text-sm">{pkg.name ?? 'Package'}</h4>
        {pkg.price != null && (
          <span className="text-[#0E7C7B] font-bold text-sm shrink-0">
            ₹{pkg.price.toLocaleString('en-IN')}
            {pkg.priceUnit && (
              <span className="text-slate-500 font-normal text-xs"> / {pkg.priceUnit.replace(/_/g, ' ').toLowerCase()}</span>
            )}
          </span>
        )}
      </div>

      {pkg.inclusions && pkg.inclusions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pkg.inclusions.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5 text-slate-600 text-xs">
              <svg className="w-3.5 h-3.5 text-[#059669] shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
          <h2 className="text-lg font-semibold font-heading text-[#7B2D42] mb-3">About</h2>
          <p className="text-slate-600 leading-relaxed">{portfolio.about}</p>
        </section>
      )}

      {/* Photo gallery */}
      {portfolio?.portfolio && portfolio.portfolio.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-[#7B2D42] mb-3">Portfolio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {portfolio.portfolio.map((item, i) => (
              <div key={i} className="border border-[#C5A47E]/30 rounded-xl p-3 bg-white">
                {item.title && (
                  <p className="font-medium text-[#7B2D42] text-sm mb-1">{item.title}</p>
                )}
                {item.eventType && (
                  <span className="inline-block bg-[#7B2D42]/10 text-[#7B2D42] text-xs px-2 py-0.5 rounded-full mb-2">
                    {item.eventType}
                  </span>
                )}
                {item.description && (
                  <p className="text-slate-500 text-xs">{item.description}</p>
                )}
                {item.photoKeys && item.photoKeys.length > 0 && (
                  <p className="text-slate-400 text-xs mt-1">
                    {item.photoKeys.length} photo{item.photoKeys.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Packages */}
      {portfolio?.packages && portfolio.packages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-[#7B2D42] mb-3">Packages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {portfolio.packages.map((pkg, i) => (
              <PackageCard key={i} pkg={pkg} />
            ))}
          </div>
        </section>
      )}

      {/* Services from PG */}
      {vendor.services.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-[#7B2D42] mb-3">Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vendor.services.map((svc) => (
              <div key={svc.id} className="border border-[#C5A47E]/30 rounded-xl p-3 bg-white">
                <p className="font-medium text-[#2E2E38] text-sm">{svc.name}</p>
                {svc.description && (
                  <p className="text-slate-500 text-xs mt-1">{svc.description}</p>
                )}
                <p className="text-[#0E7C7B] font-semibold text-sm mt-2">
                  ₹{svc.priceFrom.toLocaleString('en-IN')}
                  {svc.priceTo && svc.priceTo !== svc.priceFrom
                    ? ` – ₹${svc.priceTo.toLocaleString('en-IN')}`
                    : ''}
                  <span className="text-slate-500 font-normal text-xs"> / {svc.unit.replace(/_/g, ' ').toLowerCase()}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQs */}
      {portfolio?.faqs && portfolio.faqs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-[#7B2D42] mb-3">FAQs</h2>
          <div className="space-y-3">
            {portfolio.faqs.map((faq, i) => (
              <div key={i} className="border border-[#C5A47E]/30 rounded-xl p-4 bg-white">
                {faq.question && (
                  <p className="font-medium text-[#2E2E38] text-sm mb-1">{faq.question}</p>
                )}
                {faq.answer && (
                  <p className="text-slate-600 text-sm">{faq.answer}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Awards */}
      {portfolio?.awards && portfolio.awards.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold font-heading text-[#7B2D42] mb-3">Awards & Recognition</h2>
          <ul className="flex flex-wrap gap-2">
            {portfolio.awards.map((award, i) => (
              <li key={i} className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1 rounded-full">
                {award}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
